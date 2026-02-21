export interface DataGridRangeMoveStartCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridRangeMoveStartRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface DataGridRangeMoveStartPointer {
    clientX: number;
    clientY: number;
}
export interface UseDataGridRangeMoveStartOptions<TCoord extends DataGridRangeMoveStartCoord, TRange extends DataGridRangeMoveStartRange> {
    resolveSelectionRange: () => TRange | null;
    isCoordInsideRange: (coord: TCoord, range: TRange) => boolean;
    closeContextMenu: () => void;
    focusViewport: () => void;
    stopDragSelection: () => void;
    stopFillSelection: (applyPreview: boolean) => void;
    setRangeMoving: (value: boolean) => void;
    setRangeMovePointer: (pointer: DataGridRangeMoveStartPointer) => void;
    setRangeMoveBaseRange: (range: TRange) => void;
    setRangeMoveOrigin: (coord: TCoord) => void;
    setRangeMovePreviewRange: (range: TRange) => void;
    startInteractionAutoScroll: () => void;
    setLastAction: (message: string) => void;
}
export interface UseDataGridRangeMoveStartResult<TCoord extends DataGridRangeMoveStartCoord> {
    startRangeMove: (coord: TCoord, pointer: DataGridRangeMoveStartPointer) => boolean;
}
export declare function useDataGridRangeMoveStart<TCoord extends DataGridRangeMoveStartCoord, TRange extends DataGridRangeMoveStartRange>(options: UseDataGridRangeMoveStartOptions<TCoord, TRange>): UseDataGridRangeMoveStartResult<TCoord>;
//# sourceMappingURL=useDataGridRangeMoveStart.d.ts.map