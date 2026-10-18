import { normalizeRowNode } from "../rowModel.js"
import type {
  DataGridRowId,
  DataGridRowIdResolver,
  DataGridRowNode,
  DataGridRowNodeState,
} from "../rowModel.js"
import type { DataGridDataSourceRowEntry } from "./dataSourceProtocol.js"

function normalizeEntryRowState(
  kind: DataGridRowNode<unknown>["kind"],
  state: DataGridDataSourceRowEntry["state"],
): DataGridRowNodeState {
  return {
    selected: Boolean(state?.selected),
    group: kind === "group",
    pinned: state?.pinned === "top" || state?.pinned === "bottom" ? state.pinned : "none",
    expanded: Boolean(state?.expanded),
  }
}

function normalizeEntryGroupMeta(
  value: DataGridDataSourceRowEntry["groupMeta"],
  fallbackRowKey: DataGridRowId,
) {
  const normalizedKey = String(value?.groupKey ?? fallbackRowKey)
  const normalizedField = typeof value?.groupField === "string" ? value.groupField : ""
  const normalizedValue = typeof value?.groupValue === "string" ? value.groupValue : normalizedKey
  const level = Number.isFinite(value?.level) ? Math.max(0, Math.trunc(value?.level as number)) : 0
  const childrenCount = Number.isFinite(value?.childrenCount)
    ? Math.max(0, Math.trunc(value?.childrenCount as number))
    : 0
  const aggregates = value?.aggregates && typeof value.aggregates === "object" && !Array.isArray(value.aggregates)
    ? { ...value.aggregates }
    : undefined
  return {
    groupKey: normalizedKey,
    groupField: normalizedField,
    groupValue: normalizedValue,
    level,
    childrenCount,
    ...(aggregates ? { aggregates } : {}),
  }
}

export function normalizeDataSourceRowEntry<T>(
  entry: DataGridDataSourceRowEntry<T>,
  resolveRowId?: DataGridRowIdResolver<T>,
): { index: number; node: DataGridRowNode<T> } {
  const index = Number.isFinite(entry.index) ? Math.max(0, Math.trunc(entry.index)) : 0
  const rowId = (() => {
    if (typeof entry.rowId === "string" || typeof entry.rowId === "number") {
      return entry.rowId as DataGridRowId
    }
    if (entry.kind === "group") {
      throw new Error(
        `[DataGrid] Missing row identity for data-source group row at index ${index}. ` +
        "Server must provide deterministic rowId for group rows.",
      )
    }
    if (typeof resolveRowId === "function") {
      return resolveRowId(entry.row, index)
    }
    const fallback = (entry.row as { id?: unknown })?.id
    if (typeof fallback === "string" || typeof fallback === "number") {
      return fallback
    }
    throw new Error(
      `[DataGrid] Missing row identity for data-source row at index ${index}. Provide rowId or resolveRowId.`,
    )
  })()

  const kind = entry.kind === "group" ? "group" : "leaf"
  return {
    index,
    node: normalizeRowNode<T>(
      {
        kind,
        data: entry.row,
        row: entry.row,
        rowKey: rowId,
        rowId,
        sourceIndex: index,
        originalIndex: index,
        displayIndex: index,
        state: normalizeEntryRowState(kind, entry.state),
        ...(kind === "group" ? { groupMeta: normalizeEntryGroupMeta(entry.groupMeta, rowId) } : {}),
      },
      index,
    ),
  }
}
