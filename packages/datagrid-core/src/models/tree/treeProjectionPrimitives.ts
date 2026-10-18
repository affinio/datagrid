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

export function normalizeTreePathSegments(raw: readonly (string | number)[]): string[] {
  const segments: string[] = []
  for (const value of raw) {
    const normalized = String(value).trim()
    if (normalized.length > 0) segments.push(normalized)
  }
  return segments
}

export function createTreePathGroupKey(segments: readonly string[]): string {
  let encoded = "tree:path:"
  for (const segment of segments) encoded += `${segment.length}:${segment}`
  return encoded
}
