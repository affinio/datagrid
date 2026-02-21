export interface UseDataGridFillSelectionLifecycleOptions<TRange = {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}> {
    applyFillPreview: () => void;
    setFillDragging: (value: boolean) => void;
    clearFillPointer: () => void;
    clearFillBaseRange: () => void;
    clearFillPreviewRange: () => void;
    stopAutoScrollFrameIfIdle: () => void;
    resolveFillPreviewRange?: () => TRange | null;
}
export interface UseDataGridFillSelectionLifecycleResult {
    stopFillSelection: (applyPreview: boolean) => void;
}
export declare function useDataGridFillSelectionLifecycle<TRange = {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}>(options: UseDataGridFillSelectionLifecycleOptions<TRange>): UseDataGridFillSelectionLifecycleResult;
//# sourceMappingURL=useDataGridFillSelectionLifecycle.d.ts.map