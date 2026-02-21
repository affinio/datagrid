export interface UseDataGridRangeMoveLifecycleOptions {
    applyRangeMove: () => boolean;
    setRangeMoving: (value: boolean) => void;
    clearRangeMovePointer: () => void;
    clearRangeMoveBaseRange: () => void;
    clearRangeMoveOrigin: () => void;
    clearRangeMovePreviewRange: () => void;
    stopAutoScrollFrameIfIdle: () => void;
    onApplyRangeMoveError?: (error: unknown) => void;
}
export interface UseDataGridRangeMoveLifecycleResult {
    stopRangeMove: (applyPreview: boolean) => void;
}
export declare function useDataGridRangeMoveLifecycle(options: UseDataGridRangeMoveLifecycleOptions): UseDataGridRangeMoveLifecycleResult;
//# sourceMappingURL=useDataGridRangeMoveLifecycle.d.ts.map