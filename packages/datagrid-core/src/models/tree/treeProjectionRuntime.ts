import type { TreeGroupIndexShift } from "./treeProjectionExpansion.js"
import {
  createTreeParentGroupKey,
  materializeTreeParentProjection,
} from "./treeProjectionParentMaterializer.js"
import { materializeTreePathProjection } from "./treeProjectionPathMaterializer.js"
import {
  tryProjectTreeParentSubtreeToggle,
  tryProjectTreePathSubtreeToggle,
} from "./treeProjectionToggleRuntime.js"
import type {
  TreeParentProjectionCache,
  TreeParentProjectionCacheState,
  TreeParentSubtreeToggleInput,
  TreePathBranch,
  TreePathProjectionCache,
  TreePathProjectionCacheState,
  TreePathSubtreeToggleInput,
  TreeProjectionDiagnostics,
  TreeProjectionResult,
} from "./treeProjectionTypes.js"
export type {
  TreeParentProjectionCacheState,
  TreeParentSubtreeToggleInput,
  TreePathProjectionCache,
  TreePathProjectionCacheState,
  TreePathSubtreeToggleInput,
  TreeProjectionResult,
} from "./treeProjectionTypes.js"
import {
  type DataGridGroupExpansionSnapshot,
  type DataGridRowId,
  type DataGridRowNode,
  type DataGridTreeDataResolvedSpec,
} from "../rowModel.js"
import type {
  DataGridIncrementalAggregationGroupState,
  DataGridIncrementalAggregationLeafContribution,
} from "../aggregation/aggregationEngine.js"

export interface TreeProjectRowsFromCacheInput<T> {
  inputRows: readonly DataGridRowNode<T>[]
  treeData: DataGridTreeDataResolvedSpec<T>
  expansionSnapshot: DataGridGroupExpansionSnapshot
  expansionToggledKeys?: ReadonlySet<string>
  rowMatchesFilter: (row: DataGridRowNode<T>) => boolean
  pathCacheState: TreePathProjectionCacheState<T> | null
  parentCacheState: TreeParentProjectionCacheState<T> | null
  cacheKey: string
  computeAggregates?: (rows: readonly DataGridRowNode<T>[]) => Record<string, unknown> | null
  aggregationBasis?: "filtered" | "source"
  createLeafContribution?: (row: DataGridRowNode<T>) => DataGridIncrementalAggregationLeafContribution | null
  createEmptyGroupState?: () => DataGridIncrementalAggregationGroupState | null
  applyContributionDelta?: (
    groupState: DataGridIncrementalAggregationGroupState,
    previous: DataGridIncrementalAggregationLeafContribution | null,
    next: DataGridIncrementalAggregationLeafContribution | null,
  ) => void
  finalizeGroupState?: (groupState: DataGridIncrementalAggregationGroupState) => Record<string, unknown>
  resolveTreeDataRow?: (row: DataGridRowNode<T>) => T
}

export interface TreeProjectRowsFromCacheResult<T> {
  result: TreeProjectionResult<T>
  pathCache: TreePathProjectionCacheState<T> | null
  parentCache: TreeParentProjectionCacheState<T> | null
}

export interface TreeProjectionRuntime<T> {
  buildCacheKey: (input: {
    treeCacheRevision: number
    filterRevision: number
    sortRevision: number
    treeData: DataGridTreeDataResolvedSpec<T>
  }) => string
  projectRowsFromCache: (input: TreeProjectRowsFromCacheInput<T>) => TreeProjectRowsFromCacheResult<T>
  patchPathCacheRowsByIdentity: (
    cache: TreePathProjectionCache<T>,
    sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
    changedRowIds?: readonly DataGridRowId[],
  ) => TreePathProjectionCache<T>
  patchParentCacheRowsByIdentity: (
    cache: TreeParentProjectionCache<T>,
    sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
    changedRowIds?: readonly DataGridRowId[],
  ) => TreeParentProjectionCache<T>
  tryProjectPathSubtreeToggle: (input: TreePathSubtreeToggleInput<T>) => TreeProjectionResult<T> | null
  tryProjectParentSubtreeToggle: (input: TreeParentSubtreeToggleInput<T>) => TreeProjectionResult<T> | null
}

export interface TreeProjectionRuntimeOptions<T> {
  resolveTreeDataRow?: (row: DataGridRowNode<T>) => T
}

function isDataGridRowId(value: unknown): value is DataGridRowId {
  return typeof value === "string" || typeof value === "number"
}

function patchProjectedRowsByIdentity<T>(
  inputRows: readonly DataGridRowNode<T>[],
  byId: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
): DataGridRowNode<T>[] {
  const patched: DataGridRowNode<T>[] = []
  for (const row of inputRows) {
    const next = byId.get(row.rowId)
    if (!next) {
      patched.push(row)
      continue
    }
    if (row.data === next.data && row.row === next.row) {
      patched.push(row)
      continue
    }
    patched.push({
      ...row,
      data: next.data,
      row: next.row,
    })
  }
  return patched
}

function normalizeLeafRow<T>(row: DataGridRowNode<T>): DataGridRowNode<T> {
  if (row.kind === "leaf" && row.state.group === false) {
    return row
  }
  return {
    ...row,
    kind: "leaf",
    state: {
      ...row.state,
      group: false,
    },
    groupMeta: undefined,
  }
}

function normalizeTreePathSegments(raw: readonly (string | number)[]): string[] {
  const segments: string[] = []
  for (const value of raw) {
    const normalized = String(value).trim()
    if (normalized.length === 0) {
      continue
    }
    segments.push(normalized)
  }
  return segments
}

function createTreePathGroupKey(segments: readonly string[]): string {
  let encoded = "tree:path:"
  for (const segment of segments) {
    encoded += `${segment.length}:${segment}`
  }
  return encoded
}

function patchTreePathProjectionCacheRowsByIdentity<T>(
  cache: TreePathProjectionCache<T>,
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  changedRowIds: readonly DataGridRowId[] = [],
): TreePathProjectionCache<T> {
  if (changedRowIds.length > 0) {
    const patchArrayIndex = (
      rows: DataGridRowNode<T>[],
      index: number | undefined,
      next: DataGridRowNode<T>,
    ): void => {
      if (typeof index !== "number" || index < 0 || index >= rows.length) {
        return
      }
      const current = rows[index]
      if (!current || current.rowId !== next.rowId || (current.data === next.data && current.row === next.row)) {
        return
      }
      rows[index] = normalizeLeafRow(next)
    }

    for (const rowId of changedRowIds) {
      const next = sourceById.get(rowId)
      if (next) {
        patchArrayIndex(cache.rootLeaves, cache.rootLeafIndexByRowId.get(rowId), next)
        patchArrayIndex(cache.leafOnlyRows, cache.leafOnlyRowIndexByRowId.get(rowId), next)
        const branch = cache.leafBranchByLeafRowId.get(rowId)
        patchArrayIndex(branch?.leaves ?? [], cache.branchLeafIndexByLeafRowId.get(rowId), next)
      }
      const branchPath = cache.branchPathByLeafRowId.get(rowId)
      if (!branchPath) {
        continue
      }
      for (const branchKey of branchPath) {
        cache.dirtyBranchKeys.add(branchKey)
      }
    }
    return cache
  }
  cache.rootLeaves = patchProjectedRowsByIdentity(cache.rootLeaves, sourceById)
  cache.leafOnlyRows = patchProjectedRowsByIdentity(cache.leafOnlyRows, sourceById)
  const patchBranch = (branch: TreePathBranch<T>) => {
    branch.leaves = patchProjectedRowsByIdentity(branch.leaves, sourceById)
    for (const child of branch.groups.values()) {
      patchBranch(child)
    }
  }
  for (const branch of cache.rootGroups.values()) {
    patchBranch(branch)
  }
  for (const rowId of changedRowIds) {
    const branchPath = cache.branchPathByLeafRowId.get(rowId)
    if (!branchPath) {
      continue
    }
    for (const branchKey of branchPath) {
      cache.dirtyBranchKeys.add(branchKey)
    }
  }
  return cache
}

function patchTreeParentProjectionCacheRowsByIdentity<T>(
  cache: TreeParentProjectionCache<T>,
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  changedRowIds: readonly DataGridRowId[] = [],
): TreeParentProjectionCache<T> {
  if (changedRowIds.length > 0) {
    for (const rowId of changedRowIds) {
      const row = cache.rowById.get(rowId)
      const next = sourceById.get(rowId)
      if (row && next && (next.data !== row.data || next.row !== row.row)) {
        cache.rowById.set(rowId, normalizeLeafRow(next))
      }
      let cursor: DataGridRowId | null = rowId
      while (cursor != null) {
        cache.dirtyBranchRootIds.add(cursor)
        cursor = cache.parentById.get(cursor) ?? null
      }
    }
    return cache
  }
  for (const [rowId, row] of cache.rowById.entries()) {
    const next = sourceById.get(rowId)
    if (!next || (next.data === row.data && next.row === row.row)) {
      continue
    }
    cache.rowById.set(rowId, normalizeLeafRow(next))
  }
  for (const rowId of changedRowIds) {
    let cursor: DataGridRowId | null = rowId
    while (cursor != null) {
      cache.dirtyBranchRootIds.add(cursor)
      cursor = cache.parentById.get(cursor) ?? null
    }
  }
  return cache
}

function buildTreePathProjectionCache<T>(
  inputRows: readonly DataGridRowNode<T>[],
  treeData: Extract<DataGridTreeDataResolvedSpec<T>, { mode: "path" }>,
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
): TreePathProjectionCache<T> {
  const diagnostics: TreeProjectionDiagnostics = {
    orphans: 0,
    cycles: 0,
  }
  const rootGroups = new Map<string, TreePathBranch<T>>()
  const branchByKey = new Map<string, TreePathBranch<T>>()
  const leafBranchByLeafRowId = new Map<DataGridRowId, TreePathBranch<T>>()
  const branchLeafIndexByLeafRowId = new Map<DataGridRowId, number>()
  const branchParentByKey = new Map<string, string | null>()
  const supportsIncrementalAggregation = Boolean(
    createLeafContribution &&
    createEmptyGroupState &&
    applyContributionDelta &&
    finalizeGroupState,
  )
  const branchPathByLeafRowId = new Map<DataGridRowId, readonly string[]>()
  const groupIndexByRowId = new Map<DataGridRowId, number>()
  const groupIndexShiftHistory: TreeGroupIndexShift[] = []
  const groupIndexBornAt = new Map<DataGridRowId, number>()
  const togglePreviousDescendantsBuffer: DataGridRowNode<T>[] = []
  const toggleNextDescendantsBuffer: DataGridRowNode<T>[] = []
  const rootLeaves: DataGridRowNode<T>[] = []
  const rootLeafIndexByRowId = new Map<DataGridRowId, number>()
  const matchedLeafRowIds = new Set<DataGridRowId>()
  const leafOnlyRows: DataGridRowNode<T>[] = []
  const leafOnlyRowIndexByRowId = new Map<DataGridRowId, number>()
  const aggregatesByGroupKey = new Map<string, Record<string, unknown>>()
  const leafContributionById = (computeAggregates || createLeafContribution)
    ? new Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>()
    : undefined
  const aggregateStateByGroupKey = supportsIncrementalAggregation
    ? new Map<string, DataGridIncrementalAggregationGroupState>()
    : undefined
  const dirtyBranchKeys = new Set<string>()

  for (const row of inputRows) {
    const normalizedLeaf = normalizeLeafRow(row)
    const treeDataRow = resolveTreeDataRow
      ? resolveTreeDataRow(normalizedLeaf)
      : normalizedLeaf.data
    const path = normalizeTreePathSegments(treeData.getDataPath(treeDataRow, normalizedLeaf.sourceIndex))
    const matches = rowMatchesFilter(normalizedLeaf)
    if (matches) {
      matchedLeafRowIds.add(normalizedLeaf.rowId)
      leafOnlyRowIndexByRowId.set(normalizedLeaf.rowId, leafOnlyRows.length)
      leafOnlyRows.push(normalizedLeaf)
    }
    if (path.length === 0) {
      rootLeafIndexByRowId.set(normalizedLeaf.rowId, rootLeaves.length)
      rootLeaves.push(normalizedLeaf)
      continue
    }
    let currentGroups = rootGroups
    const traversed: TreePathBranch<T>[] = []
    const keySegments: string[] = []
    for (let level = 0; level < path.length; level += 1) {
      const value = path[level] ?? ""
      keySegments.push(value)
      const groupKey = createTreePathGroupKey(keySegments)
      const existing = currentGroups.get(value)
      if (existing) {
        traversed.push(existing)
        currentGroups = existing.groups
        continue
      }
      const parentBranch = traversed[traversed.length - 1]
      const next: TreePathBranch<T> = {
        key: groupKey,
        value,
        level,
        parent: parentBranch ?? null,
        groups: new Map<string, TreePathBranch<T>>(),
        leaves: [],
        matchedLeaves: 0,
      }
      currentGroups.set(value, next)
      branchByKey.set(groupKey, next)
      branchParentByKey.set(groupKey, parentBranch ? parentBranch.key : null)
      traversed.push(next)
      currentGroups = next.groups
    }
    const target = traversed[traversed.length - 1]
    if (target) {
      branchLeafIndexByLeafRowId.set(normalizedLeaf.rowId, target.leaves.length)
      target.leaves.push(normalizedLeaf)
      leafBranchByLeafRowId.set(normalizedLeaf.rowId, target)
      if (supportsIncrementalAggregation) {
        branchPathByLeafRowId.set(normalizedLeaf.rowId, traversed.map(branch => branch.key))
      }
    }
    if (leafContributionById && createLeafContribution && (aggregationBasis === "source" || matches)) {
      const contribution = createLeafContribution(normalizedLeaf)
      if (contribution) {
        leafContributionById.set(normalizedLeaf.rowId, contribution)
      }
    }
    for (const branch of traversed) {
      if (matches) {
        branch.matchedLeaves += 1
      }
    }
  }

  if (
    aggregateStateByGroupKey &&
    leafContributionById &&
    createEmptyGroupState &&
    applyContributionDelta &&
    finalizeGroupState
  ) {
    const collectBranchContributions = (
      branch: TreePathBranch<T>,
    ): DataGridIncrementalAggregationLeafContribution[] => {
      const contributions: DataGridIncrementalAggregationLeafContribution[] = []
      for (const child of branch.groups.values()) {
        contributions.push(...collectBranchContributions(child))
      }
      for (const leaf of branch.leaves) {
        if (aggregationBasis !== "source" && !matchedLeafRowIds.has(leaf.rowId)) {
          continue
        }
        const contribution = leafContributionById.get(leaf.rowId)
        if (contribution) {
          contributions.push(contribution)
        }
      }
      const groupState = createEmptyGroupState()
      if (!groupState) {
        return contributions
      }
      for (const contribution of contributions) {
        applyContributionDelta(groupState, null, contribution)
      }
      aggregateStateByGroupKey.set(branch.key, groupState)
      const aggregates = finalizeGroupState(groupState)
      if (Object.keys(aggregates).length > 0) {
        aggregatesByGroupKey.set(branch.key, { ...aggregates })
      }
      return contributions
    }
    for (const branch of rootGroups.values()) {
      collectBranchContributions(branch)
    }
  } else if (computeAggregates) {
    const collectBranchLeaves = (branch: TreePathBranch<T>): DataGridRowNode<T>[] => {
      const leafRows: DataGridRowNode<T>[] = []
      for (const child of branch.groups.values()) {
        leafRows.push(...collectBranchLeaves(child))
      }
      for (const leaf of branch.leaves) {
        if (aggregationBasis === "source" || matchedLeafRowIds.has(leaf.rowId)) {
          leafRows.push(leaf)
        }
      }
      if (leafRows.length === 0) {
        return leafRows
      }
      const aggregates = computeAggregates(leafRows)
      if (aggregates && Object.keys(aggregates).length > 0) {
        aggregatesByGroupKey.set(branch.key, { ...aggregates })
      }
      return leafRows
    }
    for (const branch of rootGroups.values()) {
      collectBranchLeaves(branch)
    }
  }

  return {
    diagnostics,
    rootGroups,
    branchByKey,
    leafBranchByLeafRowId,
    branchLeafIndexByLeafRowId,
    branchParentByKey,
    branchPathByLeafRowId,
    groupIndexByRowId,
    groupIndexShiftHistory,
    groupIndexBornAt,
    togglePreviousDescendantsBuffer,
    toggleNextDescendantsBuffer,
    rootLeaves,
    rootLeafIndexByRowId,
    matchedLeafRowIds,
    leafOnlyRows,
    leafOnlyRowIndexByRowId,
    aggregatesByGroupKey,
    aggregateStateByGroupKey,
    leafContributionById,
    dirtyBranchKeys,
  }
}

function buildTreeParentProjectionCache<T>(
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

function buildTreeProjectionCacheKey<T>(
  treeCacheRevision: number,
  filterRevision: number,
  sortRevision: number,
  treeData: DataGridTreeDataResolvedSpec<T>,
): string {
  return [
    treeCacheRevision,
    filterRevision,
    sortRevision,
    treeData.mode,
    treeData.filterMode,
  ].join(":")
}

function isTreePathSpec<T>(
  treeData: DataGridTreeDataResolvedSpec<T>,
): treeData is Extract<DataGridTreeDataResolvedSpec<T>, { mode: "path" }> {
  return treeData.mode === "path"
}

function projectTreeDataRowsFromCache<T>(
  input: TreeProjectRowsFromCacheInput<T>,
): TreeProjectRowsFromCacheResult<T> {
  const aggregationBasis = input.aggregationBasis ?? "filtered"
  if (isTreePathSpec(input.treeData)) {
    const nextPathCacheState = input.pathCacheState?.key === input.cacheKey
      ? input.pathCacheState
      : {
          key: input.cacheKey,
        cache: buildTreePathProjectionCache(
          input.inputRows,
          input.treeData,
          input.rowMatchesFilter,
          input.computeAggregates,
          aggregationBasis,
          input.createLeafContribution,
          input.createEmptyGroupState,
          input.applyContributionDelta,
          input.finalizeGroupState,
          input.resolveTreeDataRow,
        ),
      }
    return {
      result: materializeTreePathProjection(
        nextPathCacheState.cache,
        input.expansionSnapshot,
        input.treeData.filterMode,
        input.expansionToggledKeys,
      ),
      pathCache: nextPathCacheState,
      parentCache: input.parentCacheState,
    }
  }

  const nextParentCacheState = input.parentCacheState?.key === input.cacheKey
    ? input.parentCacheState
    : {
        key: input.cacheKey,
        cache: buildTreeParentProjectionCache(
          input.inputRows,
          input.treeData,
          input.rowMatchesFilter,
          input.computeAggregates,
          aggregationBasis,
          input.createLeafContribution,
          input.createEmptyGroupState,
          input.applyContributionDelta,
          input.finalizeGroupState,
          input.resolveTreeDataRow,
        ),
      }
  return {
    result: materializeTreeParentProjection(
      nextParentCacheState.cache,
      input.expansionSnapshot,
      input.expansionToggledKeys,
    ),
    pathCache: input.pathCacheState,
    parentCache: nextParentCacheState,
  }
}

export function createTreeProjectionRuntime<T>(
  options: TreeProjectionRuntimeOptions<T> = {},
): TreeProjectionRuntime<T> {
  return {
    buildCacheKey: input => {
      return buildTreeProjectionCacheKey(
        input.treeCacheRevision,
        input.filterRevision,
        input.sortRevision,
        input.treeData,
      )
    },
    projectRowsFromCache: input => projectTreeDataRowsFromCache({
      ...input,
      resolveTreeDataRow: options.resolveTreeDataRow,
    }),
    patchPathCacheRowsByIdentity: patchTreePathProjectionCacheRowsByIdentity,
    patchParentCacheRowsByIdentity: patchTreeParentProjectionCacheRowsByIdentity,
    tryProjectPathSubtreeToggle: tryProjectTreePathSubtreeToggle,
    tryProjectParentSubtreeToggle: tryProjectTreeParentSubtreeToggle,
  }
}
