export interface DataGridRangeMutationRect {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface DataGridRangeIterationCell {
    rowIndex: number;
    columnIndex: number;
    rowOffset: number;
    columnOffset: number;
}
export interface DataGridMutableRowStore<TRow> {
    sourceById: Map<string, TRow>;
    mutableById: Map<string, TRow>;
    getMutableRow: (rowId: string) => TRow | null;
    commitRows: (rows: readonly TRow[]) => readonly TRow[];
}
export interface CreateDataGridMutableRowStoreOptions<TRow> {
    rows: readonly TRow[];
    resolveRowId: (row: TRow) => string;
    cloneRow: (row: TRow) => TRow;
}
export declare function getDataGridRangeWidth(range: DataGridRangeMutationRect): number;
export declare function forEachDataGridRangeCell(range: DataGridRangeMutationRect, callback: (cell: DataGridRangeIterationCell) => void): void;
export declare function createDataGridMutableRowStore<TRow>(options: CreateDataGridMutableRowStoreOptions<TRow>): DataGridMutableRowStore<TRow>;
//# sourceMappingURL=dataGridRangeMutationKernel.d.ts.map