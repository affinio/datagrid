import { isGroupExpanded, type DataGridGroupExpansionSnapshot, type DataGridRowId, type DataGridRowNode } from "../rowModel.js"
import { resolveExpansionToggledKeys } from "./treeProjectionExpansion.js"
import type { TreeParentProjectionCache, TreeProjectionResult } from "./treeProjectionTypes.js"

export function createTreeParentGroupKey(rowId: DataGridRowId): string {
  const value = String(rowId)
  return `tree:parent:${typeof rowId}:${value.length}:${value}`
}

function resolveTypedExpansionKeys<T>(
  cache: TreeParentProjectionCache<T>,
  snapshot: DataGridGroupExpansionSnapshot,
  provided: ReadonlySet<string> | undefined,
): ReadonlySet<string> {
  const keys = new Set(provided ?? snapshot.toggledGroupKeys)
  const legacyParents = new Map<string, { groupKey: string; count: number }>()
  for (const [groupKey, rowId] of cache.groupRowIdByGroupKey) {
    const legacyKey = `tree:parent:${String(rowId)}`
    const current = legacyParents.get(legacyKey)
    legacyParents.set(legacyKey, { groupKey, count: (current?.count ?? 0) + 1 })
  }
  for (const legacyKey of snapshot.toggledGroupKeys) {
    const candidate = legacyParents.get(legacyKey)
    // Old keys cannot identify a parent if number/string IDs shared their text.
    if (candidate?.count === 1) keys.add(candidate.groupKey)
  }
  return keys
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
  const expansionToggledKeys = resolveTypedExpansionKeys(
    cache,
    expansionSnapshot,
    precomputedExpansionToggledKeys ?? resolveExpansionToggledKeys(expansionSnapshot),
  )
  for (const rootId of cache.rootIncluded) {
    appendTreeParentRow(cache, rootId, 0, expansionSnapshot, expansionToggledKeys, projected)
  }
  return { rows: projected, diagnostics: cache.diagnostics }
}
