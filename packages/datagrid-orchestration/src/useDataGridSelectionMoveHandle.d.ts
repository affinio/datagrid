export interface DataGridSelectionMoveHandleCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridSelectionMoveHandleRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface DataGridSelectionMoveHandleSides {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
}
export interface UseDataGridSelectionMoveHandleOptions<TRow, TCoord extends DataGridSelectionMoveHandleCoord = DataGridSelectionMoveHandleCoord, TRange extends DataGridSelectionMoveHandleRange = DataGridSelectionMoveHandleRange> {
    resolveSelectionRange: () => TRange | null;
    resolveRowIndex: (row: TRow) => number;
    resolveColumnIndex: (columnKey: string) => number;
    isCellWithinRange: (rowIndex: number, columnIndex: number, range: TRange) => boolean;
    resolveCellCoord: (row: TRow, columnKey: string) => TCoord | null;
    startRangeMove: (coord: TCoord, pointer: {
        clientX: number;
        clientY: number;
    }) => boolean;
    isRangeMoving: () => boolean;
    isFillDragging: () => boolean;
    isInlineEditorOpen: () => boolean;
    selectColumnKey?: string;
}
export interface UseDataGridSelectionMoveHandleResult<TRow> {
    getSelectionEdgeSides: (row: TRow, columnKey: string) => DataGridSelectionMoveHandleSides;
    shouldShowSelectionMoveHandle: (row: TRow, columnKey: string, side: keyof DataGridSelectionMoveHandleSides) => boolean;
    onSelectionMoveHandleMouseDown: (row: TRow, columnKey: string, event: MouseEvent) => boolean;
}
export declare function useDataGridSelectionMoveHandle<TRow, TCoord extends DataGridSelectionMoveHandleCoord = DataGridSelectionMoveHandleCoord, TRange extends DataGridSelectionMoveHandleRange = DataGridSelectionMoveHandleRange>(options: UseDataGridSelectionMoveHandleOptions<TRow, TCoord, TRange>): UseDataGridSelectionMoveHandleResult<TRow>;
//# sourceMappingURL=useDataGridSelectionMoveHandle.d.ts.map