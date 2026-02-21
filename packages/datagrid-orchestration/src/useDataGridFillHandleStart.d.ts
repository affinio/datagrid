export interface DataGridFillHandleStartRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface UseDataGridFillHandleStartOptions<TRange extends DataGridFillHandleStartRange = DataGridFillHandleStartRange> {
    resolveSelectionRange: () => TRange | null;
    focusViewport: () => void;
    stopRangeMove: (applyPreview: boolean) => void;
    setDragSelecting: (value: boolean) => void;
    setDragPointer: (pointer: {
        clientX: number;
        clientY: number;
    } | null) => void;
    setFillDragging: (value: boolean) => void;
    setFillBaseRange: (range: TRange | null) => void;
    setFillPreviewRange: (range: TRange | null) => void;
    setFillPointer: (pointer: {
        clientX: number;
        clientY: number;
    } | null) => void;
    startInteractionAutoScroll: () => void;
    setLastAction: (message: string) => void;
}
export interface UseDataGridFillHandleStartResult {
    onSelectionHandleMouseDown: (event: MouseEvent) => boolean;
}
export declare function useDataGridFillHandleStart<TRange extends DataGridFillHandleStartRange = DataGridFillHandleStartRange>(options: UseDataGridFillHandleStartOptions<TRange>): UseDataGridFillHandleStartResult;
//# sourceMappingURL=useDataGridFillHandleStart.d.ts.map