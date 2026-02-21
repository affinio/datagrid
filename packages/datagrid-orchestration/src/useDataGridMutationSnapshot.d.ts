export interface DataGridMutationSnapshotCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridMutationSnapshotRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface DataGridMutationAffectedRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface DataGridMutationSnapshotState<TRow, TCoord extends DataGridMutationSnapshotCoord = DataGridMutationSnapshotCoord, TRange extends DataGridMutationSnapshotRange = DataGridMutationSnapshotRange> {
    sourceRows: TRow[];
    cellAnchor: TCoord | null;
    cellFocus: TCoord | null;
    activeCell: TCoord | null;
    copiedSelectionRange: TRange | null;
}
export interface UseDataGridMutationSnapshotOptions<TRow, TCoord extends DataGridMutationSnapshotCoord = DataGridMutationSnapshotCoord, TRange extends DataGridMutationSnapshotRange = DataGridMutationSnapshotRange> {
    resolveRows: () => readonly TRow[];
    setRows: (rows: TRow[]) => void;
    resolveCellAnchor: () => TCoord | null;
    setCellAnchor: (coord: TCoord | null) => void;
    resolveCellFocus: () => TCoord | null;
    setCellFocus: (coord: TCoord | null) => void;
    resolveActiveCell: () => TCoord | null;
    setActiveCell: (coord: TCoord | null) => void;
    resolveCopiedSelectionRange: () => TRange | null;
    setCopiedSelectionRange: (range: TRange | null) => void;
    cloneRow: (row: TRow) => TRow;
    cloneCoord?: (coord: TCoord) => TCoord;
    cloneRange?: (range: TRange) => TRange;
}
export interface UseDataGridMutationSnapshotResult<TRow, TCoord extends DataGridMutationSnapshotCoord = DataGridMutationSnapshotCoord, TRange extends DataGridMutationSnapshotRange = DataGridMutationSnapshotRange> {
    captureGridMutationSnapshot: () => DataGridMutationSnapshotState<TRow, TCoord, TRange>;
    applyGridMutationSnapshot: (snapshot: DataGridMutationSnapshotState<TRow, TCoord, TRange>) => void;
    toTransactionRange: (range: TRange | null) => DataGridMutationAffectedRange | null;
    toSingleCellRange: (coord: TCoord | null) => TRange | null;
}
export declare function useDataGridMutationSnapshot<TRow, TCoord extends DataGridMutationSnapshotCoord = DataGridMutationSnapshotCoord, TRange extends DataGridMutationSnapshotRange = DataGridMutationSnapshotRange>(options: UseDataGridMutationSnapshotOptions<TRow, TCoord, TRange>): UseDataGridMutationSnapshotResult<TRow, TCoord, TRange>;
//# sourceMappingURL=useDataGridMutationSnapshot.d.ts.map