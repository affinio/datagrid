import type { DataGridRowNode } from "@affino/datagrid-core";
export interface UseDataGridA11yCellIdsOptions<TRow> {
    resolveColumnIndex: (columnKey: string) => number;
    resolveRowIndex: (row: DataGridRowNode<TRow>) => number;
    idPrefix?: string;
    rowAriaIndexBase?: number;
    columnAriaIndexBase?: number;
}
export interface UseDataGridA11yCellIdsResult<TRow> {
    getGridCellId: (rowId: string, columnKey: string) => string;
    getHeaderCellId: (columnKey: string) => string;
    getColumnAriaIndex: (columnKey: string) => number;
    getRowAriaIndex: (row: DataGridRowNode<TRow>) => number;
}
export declare function useDataGridA11yCellIds<TRow>(options: UseDataGridA11yCellIdsOptions<TRow>): UseDataGridA11yCellIdsResult<TRow>;
//# sourceMappingURL=useDataGridA11yCellIds.d.ts.map