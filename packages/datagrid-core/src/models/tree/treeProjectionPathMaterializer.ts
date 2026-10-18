import { isGroupExpanded, type DataGridGroupExpansionSnapshot, type DataGridRowId, type DataGridRowNode, type DataGridTreeDataFilterMode } from "../rowModel.js"
import { resolveExpansionToggledKeys } from "./treeProjectionExpansion.js"
import type { TreePathBranch, TreePathProjectionCache, TreeProjectionResult } from "./treeProjectionTypes.js"

function createTreePathGroupNode<T>(
  branch: TreePathBranch<T>,
  expanded: boolean,
  aggregates?: Record<string, unknown>,
): DataGridRowNode<T> {
  if (!aggregates) {
    const cachedNoAgg = expanded ? branch.groupRowNoAggExpanded : branch.groupRowNoAggCollapsed
    if (cachedNoAgg) return cachedNoAgg
  } else {
    if (branch.groupRowAggRef !== aggregates) {
      branch.groupRowAggRef = aggregates
      branch.groupRowAggExpanded = undefined
      branch.groupRowAggCollapsed = undefined
    }
    const cachedWithAgg = expanded ? branch.groupRowAggExpanded : branch.groupRowAggCollapsed
    if (cachedWithAgg) return cachedWithAgg
  }

  const rowData = branch.groupRowData ?? (({
    __tree: true,
    key: branch.key,
    value: branch.value,
    level: branch.level,
  } as unknown as T))
  if (!branch.groupRowData) branch.groupRowData = rowData
  const nextRow: DataGridRowNode<T> = {
    kind: "group",
    data: rowData,
    row: rowData,
    rowKey: branch.key,
    rowId: branch.key,
    sourceIndex: 0,
    originalIndex: 0,
    displayIndex: -1,
    state: { selected: false, group: true, pinned: "none", expanded },
    groupMeta: {
      groupKey: branch.key,
      groupField: "path",
      groupValue: branch.value,
      level: branch.level,
      childrenCount: branch.matchedLeaves,
      ...(aggregates ? { aggregates } : {}),
    },
  }
  if (aggregates) {
    if (expanded) branch.groupRowAggExpanded = nextRow
    else branch.groupRowAggCollapsed = nextRow
  } else if (expanded) branch.groupRowNoAggExpanded = nextRow
  else branch.groupRowNoAggCollapsed = nextRow
  return nextRow
}

export function appendTreePathBranch<T>(
  cache: TreePathProjectionCache<T>,
  branch: TreePathBranch<T>,
  expansionSnapshot: DataGridGroupExpansionSnapshot,
  expansionToggledKeys: ReadonlySet<string>,
  output: DataGridRowNode<T>[],
  groupIndexByRowId: Map<DataGridRowId, number>,
): void {
  if (branch.matchedLeaves <= 0) return
  const expanded = isGroupExpanded(expansionSnapshot, branch.key, expansionToggledKeys)
  groupIndexByRowId.set(branch.key, output.length)
  output.push(createTreePathGroupNode(branch, expanded, cache.aggregatesByGroupKey.get(branch.key)))
  if (!expanded) return
  appendTreePathBranchChildren(cache, branch, expansionSnapshot, expansionToggledKeys, output, groupIndexByRowId)
}

export function appendTreePathBranchChildren<T>(
  cache: TreePathProjectionCache<T>,
  branch: TreePathBranch<T>,
  expansionSnapshot: DataGridGroupExpansionSnapshot,
  expansionToggledKeys: ReadonlySet<string>,
  output: DataGridRowNode<T>[],
  groupIndexByRowId: Map<DataGridRowId, number>,
): void {
  for (const child of branch.groups.values()) {
    appendTreePathBranch(cache, child, expansionSnapshot, expansionToggledKeys, output, groupIndexByRowId)
  }
  for (const leaf of branch.leaves) {
    if (cache.matchedLeafRowIds.has(leaf.rowId)) output.push(leaf)
  }
}

export function materializeTreePathProjection<T>(
  cache: TreePathProjectionCache<T>,
  expansionSnapshot: DataGridGroupExpansionSnapshot,
  filterMode: DataGridTreeDataFilterMode,
  precomputedExpansionToggledKeys?: ReadonlySet<string>,
): TreeProjectionResult<T> {
  if (filterMode === "leaf-only") return { rows: cache.leafOnlyRows, diagnostics: cache.diagnostics }
  const projected: DataGridRowNode<T>[] = []
  cache.groupIndexByRowId.clear()
  cache.groupIndexShiftHistory.length = 0
  cache.groupIndexBornAt.clear()
  const expansionToggledKeys = resolveExpansionToggledKeys(expansionSnapshot, precomputedExpansionToggledKeys)
  for (const branch of cache.rootGroups.values()) {
    appendTreePathBranch(cache, branch, expansionSnapshot, expansionToggledKeys, projected, cache.groupIndexByRowId)
  }
  for (const leaf of cache.rootLeaves) {
    if (cache.matchedLeafRowIds.has(leaf.rowId)) projected.push(leaf)
  }
  return { rows: projected, diagnostics: cache.diagnostics }
}
