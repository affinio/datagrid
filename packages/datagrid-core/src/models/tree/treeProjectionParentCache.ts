import type { DataGridRowId, DataGridRowNode, DataGridTreeDataResolvedSpec } from "../rowModel.js"
import type {
  DataGridIncrementalAggregationGroupState,
  DataGridIncrementalAggregationLeafContribution,
} from "../aggregation/aggregationEngine.js"
import { createTreeParentGroupKey } from "./treeProjectionParentMaterializer.js"
import { isDataGridRowId, normalizeLeafRow } from "./treeProjectionPrimitives.js"
import type { TreeParentProjectionCache, TreeProjectionDiagnostics } from "./treeProjectionTypes.js"

export function buildTreeParentProjectionCache<T>(
  inputRows: readonly DataGridRowNode<T>[],
  treeData: Extract<DataGridTreeDataResolvedSpec<T>, { mode: "parent" }>,
  rowMatchesFilter: (row: DataGridRowNode<T>) => boolean,
  computeAggregates?: (rows: readonly DataGridRowNode<T>[]) => Record<string, unknown> | null,
  aggregationBasis: "filtered" | "source" = "filtered",
  createLeafContribution?: (
    row: DataGridRowNode<T>,
  ) => DataGridIncrementalAggregationLeafContribution | null,
  createEmptyGroupState?: () => DataGridIncrementalAggregationGroupState | null,
  applyContributionDelta?: (
    groupState: DataGridIncrementalAggregationGroupState,
    previous: DataGridIncrementalAggregationLeafContribution | null,
    next: DataGridIncrementalAggregationLeafContribution | null,
  ) => void,
  finalizeGroupState?: (groupState: DataGridIncrementalAggregationGroupState) => Record<string, unknown>,
  resolveTreeDataRow?: (row: DataGridRowNode<T>) => T,
): TreeParentProjectionCache<T> {
  const diagnostics: TreeProjectionDiagnostics = {
    orphans: 0,
    cycles: 0,
  }
  const rowById = new Map<DataGridRowId, DataGridRowNode<T>>()
  for (const row of inputRows) {
    rowById.set(row.rowId, normalizeLeafRow(row))
  }
  const rawParentById = new Map<DataGridRowId, DataGridRowId | null>()
  const dropped = new Set<DataGridRowId>()

  for (const row of inputRows) {
    const rowId = row.rowId
    const treeDataRow = resolveTreeDataRow
      ? resolveTreeDataRow(row)
      : row.data
    const resolved = treeData.getParentId(treeDataRow, row.sourceIndex)
    let parentId: DataGridRowId | null = resolved == null
      ? null
      : (isDataGridRowId(resolved) ? resolved : null)
    if (treeData.rootParentId != null && parentId === treeData.rootParentId) {
      parentId = null
    }
    if (parentId != null && !rowById.has(parentId)) {
      diagnostics.orphans += 1
      if (treeData.orphanPolicy === "drop") {
        dropped.add(rowId)
        continue
      }
      if (treeData.orphanPolicy === "error") {
        throw new Error(`[DataGridTreeData] Orphan row '${String(rowId)}' has missing parent '${String(parentId)}'.`)
      }
      parentId = null
    }
    if (parentId === rowId) {
      diagnostics.cycles += 1
      if (treeData.cyclePolicy === "error") {
        throw new Error(`[DataGridTreeData] Self-cycle for row '${String(rowId)}'.`)
      }
      parentId = null
    }
    rawParentById.set(rowId, parentId)
  }

  for (const row of inputRows) {
    if (dropped.has(row.rowId)) {
      continue
    }
    const rowId = row.rowId
    let parentId = rawParentById.get(rowId) ?? null
    if (parentId == null) {
      continue
    }
    const visited = new Set<DataGridRowId>([rowId])
    let cursor: DataGridRowId | null = parentId
    while (cursor != null) {
      if (visited.has(cursor)) {
        diagnostics.cycles += 1
        if (treeData.cyclePolicy === "error") {
          throw new Error(`[DataGridTreeData] Cycle detected for row '${String(rowId)}'.`)
        }
        parentId = null
        break
      }
      visited.add(cursor)
      cursor = rawParentById.get(cursor) ?? null
    }
    if (parentId == null) {
      rawParentById.set(rowId, null)
    }
  }

  const childrenById = new Map<DataGridRowId | null, DataGridRowId[]>()
  const pushChild = (parentId: DataGridRowId | null, rowId: DataGridRowId) => {
    const bucket = childrenById.get(parentId)
    if (bucket) {
      bucket.push(rowId)
      return
    }
    childrenById.set(parentId, [rowId])
  }
  for (const row of inputRows) {
    if (dropped.has(row.rowId)) {
      continue
    }
    const parentId = rawParentById.get(row.rowId) ?? null
    pushChild(parentId, row.rowId)
  }

  const matchedIds = new Set<DataGridRowId>()
  for (const row of inputRows) {
    if (dropped.has(row.rowId)) {
      continue
    }
    if (rowMatchesFilter(row)) {
      matchedIds.add(row.rowId)
    }
  }

  const includeIds = new Set<DataGridRowId>()
  const includeWithAncestors = (rowId: DataGridRowId) => {
    includeIds.add(rowId)
    let cursor = rawParentById.get(rowId) ?? null
    while (cursor != null) {
      includeIds.add(cursor)
      cursor = rawParentById.get(cursor) ?? null
    }
  }
  const includeDescendants = (rowId: DataGridRowId) => {
    const stack: DataGridRowId[] = [rowId]
    const visited = new Set<DataGridRowId>()
    while (stack.length > 0) {
      const current = stack.pop()
      if (typeof current === "undefined" || visited.has(current)) {
        continue
      }
      visited.add(current)
      includeIds.add(current)
      const children = childrenById.get(current) ?? []
      for (const childId of children) {
        stack.push(childId)
      }
    }
  }

  if (treeData.filterMode === "leaf-only") {
    for (const rowId of matchedIds) {
      const children = childrenById.get(rowId) ?? []
      if (children.length === 0) {
        includeIds.add(rowId)
      }
    }
  } else if (treeData.filterMode === "include-descendants") {
    for (const rowId of matchedIds) {
      includeWithAncestors(rowId)
      includeDescendants(rowId)
    }
  } else {
    for (const rowId of matchedIds) {
      includeWithAncestors(rowId)
    }
  }

  if (includeIds.size === 0) {
    return {
      diagnostics,
      rowById,
      parentById: new Map<DataGridRowId, DataGridRowId | null>(),
      includedChildrenById: new Map<DataGridRowId, DataGridRowId[]>(),
      groupRowIdByGroupKey: new Map<string, DataGridRowId>(),
      groupIndexByRowId: new Map<DataGridRowId, number>(),
      groupIndexShiftHistory: [],
      groupIndexBornAt: new Map<DataGridRowId, number>(),
      togglePreviousDescendantsBuffer: [],
      toggleNextDescendantsBuffer: [],
      rootIncluded: [],
      aggregatesByGroupRowId: new Map<DataGridRowId, Record<string, unknown>>(),
      aggregateStateByGroupRowId: new Map<DataGridRowId, DataGridIncrementalAggregationGroupState>(),
      leafContributionById: (computeAggregates || createLeafContribution)
        ? new Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>()
        : undefined,
      dirtyBranchRootIds: new Set<DataGridRowId>(),
    }
  }

  const parentById = new Map<DataGridRowId, DataGridRowId | null>()
  for (const rowId of includeIds) {
    parentById.set(rowId, rawParentById.get(rowId) ?? null)
  }

  const includedChildrenById = new Map<DataGridRowId, DataGridRowId[]>()
  for (const rowId of includeIds) {
    const children = childrenById.get(rowId) ?? []
    if (children.length === 0) {
      continue
    }
    const includedChildren = children.filter(childId => includeIds.has(childId))
    if (includedChildren.length > 0) {
      includedChildrenById.set(rowId, includedChildren)
    }
  }

  const rootIncluded: DataGridRowId[] = []
  for (const row of inputRows) {
    const rowId = row.rowId
    if (!includeIds.has(rowId)) {
      continue
    }
    const parentId = rawParentById.get(rowId) ?? null
    if (parentId == null || !includeIds.has(parentId)) {
      rootIncluded.push(rowId)
    }
  }

  const groupRowIdByGroupKey = new Map<string, DataGridRowId>()
  for (const [rowId, children] of includedChildrenById.entries()) {
    if (children.length === 0) {
      continue
    }
    groupRowIdByGroupKey.set(createTreeParentGroupKey(rowId), rowId)
  }

  const aggregatesByGroupRowId = new Map<DataGridRowId, Record<string, unknown>>()
  const aggregateStateByGroupRowId = (
    createLeafContribution &&
    createEmptyGroupState &&
    applyContributionDelta &&
    finalizeGroupState
  )
    ? new Map<DataGridRowId, DataGridIncrementalAggregationGroupState>()
    : undefined
  const leafContributionById = (computeAggregates || createLeafContribution)
    ? new Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>()
    : undefined
  if (
    aggregateStateByGroupRowId &&
    leafContributionById &&
    createLeafContribution &&
    createEmptyGroupState &&
    applyContributionDelta &&
    finalizeGroupState
  ) {
    const aggregateChildrenById = aggregationBasis === "source" ? childrenById : includedChildrenById
    const collectLeafContributions = (
      rowId: DataGridRowId,
    ): DataGridIncrementalAggregationLeafContribution[] => {
      const children = aggregateChildrenById.get(rowId) ?? []
      if (children.length === 0) {
        const leaf = rowById.get(rowId)
        if (!leaf) {
          return []
        }
        const contribution = createLeafContribution(leaf)
        if (!contribution) {
          return []
        }
        leafContributionById.set(rowId, contribution)
        return [contribution]
      }
      const contributions: DataGridIncrementalAggregationLeafContribution[] = []
      for (const childId of children) {
        contributions.push(...collectLeafContributions(childId))
      }
      const groupState = createEmptyGroupState()
      if (!groupState) {
        return contributions
      }
      for (const contribution of contributions) {
        applyContributionDelta(groupState, null, contribution)
      }
      aggregateStateByGroupRowId.set(rowId, groupState)
      const aggregates = finalizeGroupState(groupState)
      if (Object.keys(aggregates).length > 0) {
        aggregatesByGroupRowId.set(rowId, { ...aggregates })
      }
      return contributions
    }
    for (const rootId of rootIncluded) {
      collectLeafContributions(rootId)
    }
  } else if (computeAggregates) {
    const aggregateChildrenById = aggregationBasis === "source" ? childrenById : includedChildrenById
    const leafRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()
    for (const [rowId, row] of rowById.entries()) {
      if ((aggregateChildrenById.get(rowId) ?? []).length === 0) {
        leafRowsById.set(rowId, row)
        if (leafContributionById) {
          leafContributionById.set(rowId, {})
        }
      }
    }
    const leafMemo = new Map<DataGridRowId, DataGridRowNode<T>[]>()
    const collectLeafRows = (rowId: DataGridRowId): DataGridRowNode<T>[] => {
      const cached = leafMemo.get(rowId)
      if (cached) {
        return cached
      }
      const children = aggregateChildrenById.get(rowId) ?? []
      if (children.length === 0) {
        const leaf = leafRowsById.get(rowId)
        const leafRows = leaf ? [leaf] : []
        leafMemo.set(rowId, leafRows)
        return leafRows
      }
      const leafRows: DataGridRowNode<T>[] = []
      for (const childId of children) {
        leafRows.push(...collectLeafRows(childId))
      }
      const aggregates = computeAggregates(leafRows)
      if (aggregates && Object.keys(aggregates).length > 0) {
        aggregatesByGroupRowId.set(rowId, { ...aggregates })
      }
      leafMemo.set(rowId, leafRows)
      return leafRows
    }
    for (const rootId of rootIncluded) {
      collectLeafRows(rootId)
    }
  }

  return {
    diagnostics,
    rowById,
    parentById,
    includedChildrenById,
    groupRowIdByGroupKey,
    groupIndexByRowId: new Map<DataGridRowId, number>(),
    groupIndexShiftHistory: [],
    groupIndexBornAt: new Map<DataGridRowId, number>(),
    togglePreviousDescendantsBuffer: [],
    toggleNextDescendantsBuffer: [],
    rootIncluded,
    aggregatesByGroupRowId,
    aggregateStateByGroupRowId,
    leafContributionById,
    dirtyBranchRootIds: new Set<DataGridRowId>(),
  }
}

