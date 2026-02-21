export interface DataGridPointerPreviewCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridPointerPreviewRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface DataGridPointerPreviewCoordinates {
    clientX: number;
    clientY: number;
}
export interface UseDataGridPointerPreviewRouterOptions<TCoord extends DataGridPointerPreviewCoord, TRange extends DataGridPointerPreviewRange> {
    isFillDragging: () => boolean;
    resolveFillPointer: () => DataGridPointerPreviewCoordinates | null;
    resolveFillBaseRange: () => TRange | null;
    resolveFillPreviewRange: () => TRange | null;
    setFillPreviewRange: (range: TRange) => void;
    isRangeMoving: () => boolean;
    resolveRangeMovePointer: () => DataGridPointerPreviewCoordinates | null;
    resolveRangeMoveBaseRange: () => TRange | null;
    resolveRangeMoveOrigin: () => TCoord | null;
    resolveRangeMovePreviewRange: () => TRange | null;
    setRangeMovePreviewRange: (range: TRange) => void;
    resolveCellCoordFromPointer: (clientX: number, clientY: number) => TCoord | null;
    buildExtendedRange: (baseRange: TRange, coord: TCoord) => TRange | null;
    normalizeSelectionRange: (range: TRange) => TRange | null;
    rangesEqual: (a: TRange | null, b: TRange | null) => boolean;
}
export interface UseDataGridPointerPreviewRouterResult {
    applyFillPreviewFromPointer: () => void;
    applyRangeMovePreviewFromPointer: () => void;
}
export declare function useDataGridPointerPreviewRouter<TCoord extends DataGridPointerPreviewCoord, TRange extends DataGridPointerPreviewRange>(options: UseDataGridPointerPreviewRouterOptions<TCoord, TRange>): UseDataGridPointerPreviewRouterResult;
//# sourceMappingURL=useDataGridPointerPreviewRouter.d.ts.map