export interface DataGridCellRangeCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridCellRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface UseDataGridCellRangeHelpersOptions<TRow, TCoord extends DataGridCellRangeCoord = DataGridCellRangeCoord, TRange extends DataGridCellRange = DataGridCellRange> {
    resolveRowsLength: () => number;
    resolveFirstNavigableColumnIndex: () => number;
    resolveCandidateCurrentCell: () => TCoord | null;
    resolveColumnIndex: (columnKey: string) => number;
    resolveNearestNavigableColumnIndex: (columnIndex: number, direction?: 1 | -1) => number;
    clampRowIndex: (rowIndex: number) => number;
    resolveRowIndex: (row: TRow) => number;
    isColumnSelectable?: (columnKey: string) => boolean;
}
export interface UseDataGridCellRangeHelpersResult<TRow, TCoord extends DataGridCellRangeCoord = DataGridCellRangeCoord, TRange extends DataGridCellRange = DataGridCellRange> {
    resolveCellCoord: (row: TRow, columnKey: string) => TCoord | null;
    normalizeCellCoord: (coord: TCoord) => TCoord | null;
    normalizeSelectionRange: (range: TRange) => TRange | null;
    buildExtendedRange: (baseRange: TRange, coord: TCoord) => TRange | null;
    isCellWithinRange: (rowIndex: number, columnIndex: number, range: TRange) => boolean;
    resolveCurrentCellCoord: () => TCoord | null;
}
export declare function useDataGridCellRangeHelpers<TRow, TCoord extends DataGridCellRangeCoord = DataGridCellRangeCoord, TRange extends DataGridCellRange = DataGridCellRange>(options: UseDataGridCellRangeHelpersOptions<TRow, TCoord, TRange>): UseDataGridCellRangeHelpersResult<TRow, TCoord, TRange>;
//# sourceMappingURL=useDataGridCellRangeHelpers.d.ts.map