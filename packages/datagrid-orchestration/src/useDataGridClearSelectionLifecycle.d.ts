export interface UseDataGridClearSelectionLifecycleOptions<TCoord, TRange> {
    setCellAnchor: (coord: TCoord | null) => void;
    setCellFocus: (coord: TCoord | null) => void;
    setActiveCell: (coord: TCoord | null) => void;
    setDragSelecting: (value: boolean) => void;
    setFillDragging: (value: boolean) => void;
    setDragPointer: (pointer: {
        clientX: number;
        clientY: number;
    } | null) => void;
    setFillPointer: (pointer: {
        clientX: number;
        clientY: number;
    } | null) => void;
    setFillBaseRange: (range: TRange | null) => void;
    setFillPreviewRange: (range: TRange | null) => void;
    clearLastDragCoord: () => void;
    closeContextMenu: () => void;
    stopRangeMove: (applyPreview: boolean) => void;
    stopColumnResize: () => void;
    stopAutoScrollFrameIfIdle: () => void;
}
export interface UseDataGridClearSelectionLifecycleResult {
    clearCellSelection: () => void;
}
export declare function useDataGridClearSelectionLifecycle<TCoord, TRange>(options: UseDataGridClearSelectionLifecycleOptions<TCoord, TRange>): UseDataGridClearSelectionLifecycleResult;
//# sourceMappingURL=useDataGridClearSelectionLifecycle.d.ts.map