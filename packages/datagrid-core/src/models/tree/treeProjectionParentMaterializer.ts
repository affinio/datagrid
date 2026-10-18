import { isGroupExpanded, type DataGridGroupExpansionSnapshot, type DataGridRowId, type DataGridRowNode } from "../rowModel.js"
import { resolveExpansionToggledKeys } from "./treeProjectionExpansion.js"
import type { TreeParentProjectionCache, TreeProjectionResult } from "./treeProjectionTypes.js"

export function createTreeParentGroupKey(rowId: DataGridRowId): string {
  return `tree:parent:${String(rowId)}`
}

function createTreeParentGroupNode<T>(
  row: DataGridRowNode<T>,
  rowId: DataGridRowId,
  level: number,
  childrenCount: number,
  expanded: boolean,
  aggregates?: Record<string, unknown>,
): DataGridRowNode<T> {
  return {
    ...row,
    kind: "group",
    state: {
      ...row.state,
      group: true,
      expanded,
    },
    groupMeta: {
      groupKey: createTreeParentGroupKey(rowId),
      groupField: "parent",
      groupValue: String(rowId),
      level,
      childrenCount,
      ...(aggregates ? { aggregates } : {}),
    },
  }
}

function appendTreeParentRow<T>(
  cache: TreeParentProjectionCache<T>,
  rowId: DataGridRowId,
  level: number,
  expansionSnapshot: DataGridGroupExpansionSnapshot,
  expansionToggledKeys: ReadonlySet<string>,
  output: DataGridRowNode<T>[],
): void {
  const row = cache.rowById.get(rowId)
  if (!row) return
  const children = cache.includedChildrenById.get(rowId) ?? []
  if (children.length === 0) {
    output.push(row)
    return
  }
  const groupKey = createTreeParentGroupKey(rowId)
  const expanded = isGroupExpanded(expansionSnapshot, groupKey, expansionToggledKeys)
  cache.groupIndexByRowId.set(rowId, output.length)
  output.push(createTreeParentGroupNode(
    row,
    rowId,
    level,
    children.length,
    expanded,
    cache.aggregatesByGroupRowId.get(rowId),
  ))
  if (!expanded) return
  appendTreeParentRowChildren(cache, rowId, level, expansionSnapshot, expansionToggledKeys, output)
}

export function appendTreeParentRowChildren<T>(
  cache: TreeParentProjectionCache<T>,
  rowId: DataGridRowId,
  level: number,
  expansionSnapshot: DataGridGroupExpansionSnapshot,
  expansionToggledKeys: ReadonlySet<string>,
  output: DataGridRowNode<T>[],
): void {
  const children = cache.includedChildrenById.get(rowId) ?? []
  for (const childId of children) {
    appendTreeParentRow(cache, childId, level + 1, expansionSnapshot, expansionToggledKeys, output)
  }
}

export function materializeTreeParentProjection<T>(
  cache: TreeParentProjectionCache<T>,
  expansionSnapshot: DataGridGroupExpansionSnapshot,
  precomputedExpansionToggledKeys?: ReadonlySet<string>,
): TreeProjectionResult<T> {
  if (cache.rootIncluded.length === 0) {
    return { rows: [], diagnostics: cache.diagnostics }
  }
  const projected: DataGridRowNode<T>[] = []
  cache.groupIndexByRowId.clear()
  cache.groupIndexShiftHistory.length = 0
  cache.groupIndexBornAt.clear()
  const expansionToggledKeys = resolveExpansionToggledKeys(expansionSnapshot, precomputedExpansionToggledKeys)
  for (const rootId of cache.rootIncluded) {
    appendTreeParentRow(cache, rootId, 0, expansionSnapshot, expansionToggledKeys, projected)
  }
  return { rows: projected, diagnostics: cache.diagnostics }
}
