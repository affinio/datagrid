export interface UseDataGridGroupBadgeOptions<TRow> {
  resolveRowId: (row: TRow) => string
  isGroupedByColumn: (columnKey: string) => boolean
  isGroupStartRowId: (rowId: string) => boolean
  resolveGroupBadgeTextByRowId: (rowId: string) => string
}

export interface UseDataGridGroupBadgeResult<TRow> {
  isGroupStartRow: (row: TRow) => boolean
  shouldShowGroupBadge: (row: TRow, columnKey: string) => boolean
  resolveGroupBadgeText: (row: TRow) => string
}

export function useDataGridGroupBadge<TRow>(
  options: UseDataGridGroupBadgeOptions<TRow>,
): UseDataGridGroupBadgeResult<TRow> {
  function isGroupStartRow(row: TRow): boolean {
    return options.isGroupStartRowId(options.resolveRowId(row))
  }

  function shouldShowGroupBadge(row: TRow, columnKey: string): boolean {
    if (!options.isGroupedByColumn(columnKey)) {
      return false
    }
    return isGroupStartRow(row)
  }

  function resolveGroupBadgeText(row: TRow): string {
    return options.resolveGroupBadgeTextByRowId(options.resolveRowId(row))
  }

  return {
    isGroupStartRow,
    shouldShowGroupBadge,
    resolveGroupBadgeText,
  }
}
