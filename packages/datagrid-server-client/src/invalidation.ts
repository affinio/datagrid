import type { DataGridDataSourceInvalidation } from "@affino/datagrid-core"

type RecordLike = Record<string, unknown>

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function normalizeReason(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function normalizeRowIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((rowId): rowId is string => typeof rowId === "string" && rowId.trim().length > 0)
    .map(rowId => rowId.trim())
}

function normalizeCellRowIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const rowIds: string[] = []
  const seen = new Set<string>()
  for (const cell of value) {
    if (!isRecord(cell)) {
      continue
    }
    const rowId = cell.rowId
    const columnId = cell.columnId
    if (typeof rowId !== "string" || typeof columnId !== "string") {
      continue
    }
    if (seen.has(rowId)) {
      continue
    }
    seen.add(rowId)
    rowIds.push(rowId)
  }
  return rowIds
}

export function normalizeDatasourceInvalidation(value: unknown): DataGridDataSourceInvalidation | null {
  if (!isRecord(value)) {
    return null
  }

  const type = typeof value.type === "string"
    ? value.type.trim().toLowerCase()
    : typeof value.kind === "string"
      ? value.kind.trim().toLowerCase()
      : ""
  const reason = normalizeReason(value.reason)

  if (type === "dataset") {
    return { kind: "all", reason }
  }

  if (type === "row" || type === "rows") {
    const rowIds = normalizeRowIds(Array.isArray(value.rows) ? value.rows : value.rowIds)
    return rowIds.length > 0 ? { kind: "rows", rowIds, reason } : { kind: "all", reason }
  }

  if (type === "cell") {
    const rowIds = normalizeCellRowIds(value.cells)
    return rowIds.length > 0 ? { kind: "rows", rowIds, reason } : { kind: "all", reason }
  }

  if (type === "range") {
    const range = isRecord(value.range) ? value.range : null
    const start = Number(range?.startRow ?? range?.start)
    const end = Number(range?.endRow ?? range?.end)
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return null
    }
    return {
      kind: "range",
      range: {
        start: Math.max(0, Math.trunc(start)),
        end: Math.max(0, Math.trunc(end)),
      },
      reason,
    }
  }

  return null
}
