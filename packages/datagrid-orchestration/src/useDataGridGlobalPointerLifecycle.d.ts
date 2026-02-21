import type { DataGridPointerCoordinates } from "./dataGridPointerContracts";
export interface DataGridPointerInteractionState {
    isRangeMoving: boolean;
    isColumnResizing: boolean;
    isFillDragging: boolean;
    isDragSelecting: boolean;
}
export type DataGridPointerPreviewApplyMode = "sync" | "raf";
export interface UseDataGridGlobalPointerLifecycleOptions {
    resolveInteractionState: () => DataGridPointerInteractionState;
    resolveRangeMovePointer: () => DataGridPointerCoordinates | null;
    setRangeMovePointer: (pointer: DataGridPointerCoordinates) => void;
    applyRangeMovePreviewFromPointer: () => void;
    stopRangeMove: (commit: boolean) => void;
    applyColumnResizeFromPointer: (clientX: number) => void;
    stopColumnResize: () => void;
    resolveFillPointer: () => DataGridPointerCoordinates | null;
    setFillPointer: (pointer: DataGridPointerCoordinates) => void;
    applyFillPreviewFromPointer: () => void;
    stopFillSelection: (commit: boolean) => void;
    resolveDragPointer: () => DataGridPointerCoordinates | null;
    setDragPointer: (pointer: DataGridPointerCoordinates) => void;
    applyDragSelectionFromPointer: () => void;
    stopDragSelection: () => void;
    pointerPreviewApplyMode?: DataGridPointerPreviewApplyMode;
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame?: (handle: number) => void;
}
export interface UseDataGridGlobalPointerLifecycleResult {
    finalizePointerInteractions: (pointer?: DataGridPointerCoordinates, commit?: boolean) => void;
    dispatchGlobalMouseMove: (event: MouseEvent) => boolean;
    dispatchGlobalMouseUp: (event: MouseEvent) => boolean;
    dispatchGlobalPointerUp: (event: PointerEvent) => boolean;
    dispatchGlobalPointerCancel: () => boolean;
    dispatchGlobalContextMenuCapture: (event: MouseEvent) => boolean;
    dispatchGlobalWindowBlur: () => boolean;
    dispose: () => void;
}
export declare function useDataGridGlobalPointerLifecycle(options: UseDataGridGlobalPointerLifecycleOptions): UseDataGridGlobalPointerLifecycleResult;
//# sourceMappingURL=useDataGridGlobalPointerLifecycle.d.ts.map