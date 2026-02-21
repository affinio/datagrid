export interface DataGridCopyRangeCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridCopyRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface UseDataGridCopyRangeHelpersOptions<TCoord extends DataGridCopyRangeCoord = DataGridCopyRangeCoord, TRange extends DataGridCopyRange = DataGridCopyRange> {
    resolveSelectionRange: () => TRange | null;
    resolveCurrentCellCoord: () => TCoord | null;
}
export interface UseDataGridCopyRangeHelpersResult<TRange extends DataGridCopyRange = DataGridCopyRange> {
    isMultiCellSelection: (range: TRange | null) => boolean;
    resolveCopyRange: () => TRange | null;
}
export declare function useDataGridCopyRangeHelpers<TCoord extends DataGridCopyRangeCoord = DataGridCopyRangeCoord, TRange extends DataGridCopyRange = DataGridCopyRange>(options: UseDataGridCopyRangeHelpersOptions<TCoord, TRange>): UseDataGridCopyRangeHelpersResult<TRange>;
//# sourceMappingURL=useDataGridCopyRangeHelpers.d.ts.map