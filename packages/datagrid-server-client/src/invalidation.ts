import type { DataGridDataSourceInvalidation, DataGridRowId } from "@affino/datagrid-core"

type RecordLike = Record<string, unknown>

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function normalizeReason(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function normalizeRowIds(value: unknown): DataGridRowId[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map(rowId => {
      if (typeof rowId === "number" && Number.isFinite(rowId)) {
        return rowId
      }
      if (typeof rowId === "string" && rowId.trim().length > 0) {
        return rowId.trim()
      }
      return null
    })
    .filter((rowId): rowId is DataGridRowId => rowId !== null)
}

function normalizeCellRowIds(value: unknown): DataGridRowId[] {
  if (!Array.isArray(value)) {
    return []
  }
  const rowIds: DataGridRowId[] = []
  const seen = new Set<DataGridRowId>()
  for (const cell of value) {
    if (!isRecord(cell)) {
      continue
    }
    const rowId = cell.rowId
    const columnId = cell.columnId
    if (
      !(
        typeof rowId === "number" && Number.isFinite(rowId)
        || typeof rowId === "string" && rowId.trim().length > 0
      )
      || typeof columnId !== "string"
    ) {
      continue
    }
    const normalizedRowId = typeof rowId === "string" ? rowId.trim() : rowId
    if (seen.has(normalizedRowId)) {
      continue
    }
    seen.add(normalizedRowId)
    rowIds.push(normalizedRowId)
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
