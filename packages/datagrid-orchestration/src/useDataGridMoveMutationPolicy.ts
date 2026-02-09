export interface UseDataGridMoveMutationPolicyOptions<TRow, TEditableColumnKey extends string> {
  isEditableColumn: (columnKey: string) => columnKey is TEditableColumnKey
  applyEditedValue: (row: TRow, columnKey: TEditableColumnKey, value: string) => void
  clearEditedValue: (row: TRow, columnKey: TEditableColumnKey) => boolean
  isBlockedColumn?: (columnKey: string) => boolean
}

export interface UseDataGridMoveMutationPolicyResult<TRow> {
  applyValueForMove: (row: TRow, columnKey: string, value: string) => boolean
  clearValueForMove: (row: TRow, columnKey: string) => boolean
}

function applyRecordValueForMove(record: Record<string, unknown>, columnKey: string, value: string): boolean {
  if (!(columnKey in record)) {
    return false
  }
  const current = record[columnKey]
  if (typeof current === "number") {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) {
      return false
    }
    record[columnKey] = numeric
    return true
  }
  if (typeof current === "boolean") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true" || normalized === "1") {
      record[columnKey] = true
      return true
    }
    if (normalized === "false" || normalized === "0") {
      record[columnKey] = false
      return true
    }
    return false
  }
  record[columnKey] = value
  return true
}

function clearRecordValueForMove(record: Record<string, unknown>, columnKey: string): boolean {
  if (!(columnKey in record)) {
    return false
  }
  const current = record[columnKey]
  if (typeof current === "number") {
    if (current === 0) {
      return false
    }
    record[columnKey] = 0
    return true
  }
  if (typeof current === "boolean") {
    if (!current) {
      return false
    }
    record[columnKey] = false
    return true
  }
  if (current == null || String(current) === "") {
    return false
  }
  record[columnKey] = ""
  return true
}

export function useDataGridMoveMutationPolicy<TRow, TEditableColumnKey extends string>(
  options: UseDataGridMoveMutationPolicyOptions<TRow, TEditableColumnKey>,
): UseDataGridMoveMutationPolicyResult<TRow> {
  function isBlockedColumn(columnKey: string): boolean {
    return options.isBlockedColumn ? options.isBlockedColumn(columnKey) : false
  }

  function applyValueForMove(row: TRow, columnKey: string, value: string): boolean {
    if (isBlockedColumn(columnKey)) {
      return false
    }
    if (options.isEditableColumn(columnKey)) {
      options.applyEditedValue(row, columnKey, value)
      return true
    }
    return applyRecordValueForMove(row as unknown as Record<string, unknown>, columnKey, value)
  }

  function clearValueForMove(row: TRow, columnKey: string): boolean {
    if (isBlockedColumn(columnKey)) {
      return false
    }
    if (options.isEditableColumn(columnKey)) {
      return options.clearEditedValue(row, columnKey)
    }
    return clearRecordValueForMove(row as unknown as Record<string, unknown>, columnKey)
  }

  return {
    applyValueForMove,
    clearValueForMove,
  }
}
