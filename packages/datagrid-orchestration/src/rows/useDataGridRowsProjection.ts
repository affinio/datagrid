import type { DataGridSortState } from "@affino/datagrid-core"

export interface UseDataGridRowsProjectionOptions<TRow, TFilters> {
  rows: readonly TRow[]
  query: string
  searchableColumnKeys: readonly string[]
  hasColumnFilters: boolean
  appliedColumnFilters: TFilters
  sortModel: readonly DataGridSortState[]
  resolveCellValue: (row: TRow, columnKey: string) => unknown
  rowMatchesColumnFilters: (row: TRow, filters: TFilters) => boolean
  fallbackQueryColumnKeys?: readonly string[]
}

export interface DataGridRowsProjectionSnapshot<TRow> {
  normalizedQuickFilter: string
  filteredAndSortedRows: readonly TRow[]
}

export function normalizeDataGridQuickFilter(query: string): string {
  return query.trim().toLowerCase()
}

function compareSortableValues(left: unknown, right: unknown): number {
  if (left == null && right == null) {
    return 0
  }
  if (left == null) {
    return 1
  }
  if (right == null) {
    return -1
  }
  if (typeof left === "number" && typeof right === "number") {
    if (left === right) return 0
    return left < right ? -1 : 1
  }
  const leftValue = String(left).toLowerCase()
  const rightValue = String(right).toLowerCase()
  return leftValue.localeCompare(rightValue)
}

export function sortDataGridRows<TRow>(
  rows: readonly TRow[],
  model: readonly DataGridSortState[],
  resolveCellValue: (row: TRow, columnKey: string) => unknown,
): readonly TRow[] {
  if (!model.length) {
    return rows
  }
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      for (const sortEntry of model) {
        const next = compareSortableValues(
          resolveCellValue(left.row, sortEntry.key),
          resolveCellValue(right.row, sortEntry.key),
        )
        if (next === 0) {
          continue
        }
        return sortEntry.direction === "asc" ? next : -next
      }
      return left.index - right.index
    })
    .map(entry => entry.row)
}

export function rowMatchesDataGridQuickFilter<TRow>(
  row: TRow,
  normalizedQuery: string,
  columnKeys: readonly string[],
  fallbackQueryColumnKeys: readonly string[],
  resolveCellValue: (row: TRow, columnKey: string) => unknown,
): boolean {
  if (!normalizedQuery) {
    return true
  }
  const keys = columnKeys.length ? columnKeys : fallbackQueryColumnKeys
  for (const key of keys) {
    const value = resolveCellValue(row, key)
    if (typeof value === "undefined" || value === null) {
      continue
    }
    if (String(value).toLowerCase().includes(normalizedQuery)) {
      return true
    }
  }
  return false
}

export function useDataGridRowsProjection<TRow, TFilters>(
  options: UseDataGridRowsProjectionOptions<TRow, TFilters>,
): DataGridRowsProjectionSnapshot<TRow> {
  const normalizedQuickFilter = normalizeDataGridQuickFilter(options.query)

  const quickFilteredRows = normalizedQuickFilter
    ? options.rows.filter(row => rowMatchesDataGridQuickFilter(
      row,
      normalizedQuickFilter,
      options.searchableColumnKeys,
      options.fallbackQueryColumnKeys ?? [],
      options.resolveCellValue,
    ))
    : options.rows

  const columnFilteredRows = options.hasColumnFilters
    ? quickFilteredRows.filter(row => options.rowMatchesColumnFilters(row, options.appliedColumnFilters))
    : quickFilteredRows

  return {
    normalizedQuickFilter,
    filteredAndSortedRows: sortDataGridRows(columnFilteredRows, options.sortModel, options.resolveCellValue),
  }
}
