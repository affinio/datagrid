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
    if (!options.isEditableColumn(columnKey)) {
      return false
    }
    options.applyEditedValue(row, columnKey, value)
    return true
  }

  function clearValueForMove(row: TRow, columnKey: string): boolean {
    if (isBlockedColumn(columnKey)) {
      return false
    }
    if (!options.isEditableColumn(columnKey)) {
      return false
    }
    return options.clearEditedValue(row, columnKey)
  }

  return {
    applyValueForMove,
    clearValueForMove,
  }
}
