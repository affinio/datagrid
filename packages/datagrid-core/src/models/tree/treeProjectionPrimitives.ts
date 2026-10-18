import type { DataGridRowId, DataGridRowNode } from "../rowModel.js"

export function isDataGridRowId(value: unknown): value is DataGridRowId {
  return typeof value === "string" || typeof value === "number"
}

export function normalizeLeafRow<T>(row: DataGridRowNode<T>): DataGridRowNode<T> {
  if (row.kind === "leaf" && row.state.group === false) return row
  return {
    ...row,
    kind: "leaf",
    state: { ...row.state, group: false },
    groupMeta: undefined,
  }
}
