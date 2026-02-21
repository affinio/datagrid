import type { DataGridSortState } from "@affino/datagrid-core";
export interface UseDataGridRowsProjectionOptions<TRow, TFilters> {
    rows: readonly TRow[];
    query: string;
    searchableColumnKeys: readonly string[];
    hasColumnFilters: boolean;
    appliedColumnFilters: TFilters;
    sortModel: readonly DataGridSortState[];
    resolveCellValue: (row: TRow, columnKey: string) => unknown;
    rowMatchesColumnFilters: (row: TRow, filters: TFilters) => boolean;
    fallbackQueryColumnKeys?: readonly string[];
}
export interface DataGridRowsProjectionSnapshot<TRow> {
    normalizedQuickFilter: string;
    filteredAndSortedRows: readonly TRow[];
}
export declare function normalizeDataGridQuickFilter(query: string): string;
export declare function sortDataGridRows<TRow>(rows: readonly TRow[], model: readonly DataGridSortState[], resolveCellValue: (row: TRow, columnKey: string) => unknown): readonly TRow[];
export declare function rowMatchesDataGridQuickFilter<TRow>(row: TRow, normalizedQuery: string, columnKeys: readonly string[], fallbackQueryColumnKeys: readonly string[], resolveCellValue: (row: TRow, columnKey: string) => unknown): boolean;
export declare function useDataGridRowsProjection<TRow, TFilters>(options: UseDataGridRowsProjectionOptions<TRow, TFilters>): DataGridRowsProjectionSnapshot<TRow>;
//# sourceMappingURL=useDataGridRowsProjection.d.ts.map