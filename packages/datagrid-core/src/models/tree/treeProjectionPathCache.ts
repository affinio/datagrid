import type { DataGridRowId, DataGridRowNode, DataGridTreeDataResolvedSpec } from "../rowModel.js"
import type {
  DataGridIncrementalAggregationGroupState,
  DataGridIncrementalAggregationLeafContribution,
} from "../aggregation/aggregationEngine.js"
import { createTreePathGroupKey, normalizeLeafRow, normalizeTreePathSegments } from "./treeProjectionPrimitives.js"
import type { TreeGroupIndexShift } from "./treeProjectionExpansion.js"
import type { TreePathBranch, TreePathProjectionCache, TreeProjectionDiagnostics } from "./treeProjectionTypes.js"

export function buildTreePathProjectionCache<T>(
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

