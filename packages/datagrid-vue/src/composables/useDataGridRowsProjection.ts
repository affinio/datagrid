import { computed, type ComputedRef, type Ref } from "vue"
import type { DataGridSortState } from "@affino/datagrid-core"
import {
  useDataGridRowsProjection as buildDataGridRowsProjection,
} from "@affino/datagrid-orchestration"

export interface UseDataGridRowsProjectionOptions<TRow, TFilters> {
  rows: Ref<readonly TRow[]>
  query: Ref<string>
  searchableColumnKeys: Ref<readonly string[]>
  hasColumnFilters: Ref<boolean>
  appliedColumnFilters: Ref<TFilters>
  sortModel: Ref<readonly DataGridSortState[]>
  resolveCellValue: (row: TRow, columnKey: string) => unknown
  rowMatchesColumnFilters: (row: TRow, filters: TFilters) => boolean
  fallbackQueryColumnKeys?: readonly string[]
}

export interface UseDataGridRowsProjectionResult<TRow> {
  normalizedQuickFilter: ComputedRef<string>
  filteredAndSortedRows: ComputedRef<readonly TRow[]>
}

export function useDataGridRowsProjection<TRow, TFilters>(
  options: UseDataGridRowsProjectionOptions<TRow, TFilters>,
): UseDataGridRowsProjectionResult<TRow> {
  const projection = computed(() => buildDataGridRowsProjection({
    rows: options.rows.value,
    query: options.query.value,
    searchableColumnKeys: options.searchableColumnKeys.value,
    hasColumnFilters: options.hasColumnFilters.value,
    appliedColumnFilters: options.appliedColumnFilters.value,
    sortModel: options.sortModel.value,
    resolveCellValue: options.resolveCellValue,
    rowMatchesColumnFilters: options.rowMatchesColumnFilters,
    fallbackQueryColumnKeys: options.fallbackQueryColumnKeys,
  }))

  const normalizedQuickFilter = computed(() => projection.value.normalizedQuickFilter)
  const filteredAndSortedRows = computed(() => projection.value.filteredAndSortedRows)

  return {
    normalizedQuickFilter,
    filteredAndSortedRows,
  }
}
