export interface DataGridSelectionComparatorCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridSelectionComparatorRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface UseDataGridSelectionComparatorsResult<TCoord extends DataGridSelectionComparatorCoord = DataGridSelectionComparatorCoord, TRange extends DataGridSelectionComparatorRange = DataGridSelectionComparatorRange> {
    cellCoordsEqual: (a: TCoord | null, b: TCoord | null) => boolean;
    rangesEqual: (a: TRange | null, b: TRange | null) => boolean;
}
export declare function useDataGridSelectionComparators<TCoord extends DataGridSelectionComparatorCoord = DataGridSelectionComparatorCoord, TRange extends DataGridSelectionComparatorRange = DataGridSelectionComparatorRange>(): UseDataGridSelectionComparatorsResult<TCoord, TRange>;
//# sourceMappingURL=useDataGridSelectionComparators.d.ts.map