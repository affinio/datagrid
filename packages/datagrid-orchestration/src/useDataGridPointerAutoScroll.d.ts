import type { DataGridPointerCoordinates } from "./dataGridPointerContracts";
export interface DataGridPointerAutoScrollInteractionState {
    isDragSelecting: boolean;
    isFillDragging: boolean;
    isRangeMoving: boolean;
}
export interface DataGridPointerAutoScrollPosition {
    top: number;
    left: number;
}
export interface UseDataGridPointerAutoScrollOptions {
    resolveInteractionState: () => DataGridPointerAutoScrollInteractionState;
    resolveRangeMovePointer: () => DataGridPointerCoordinates | null;
    resolveFillPointer: () => DataGridPointerCoordinates | null;
    resolveDragPointer: () => DataGridPointerCoordinates | null;
    resolveViewportElement: () => HTMLElement | null;
    resolveHeaderHeight: () => number;
    resolveAxisAutoScrollDelta: (pointer: number, min: number, max: number) => number;
    setScrollPosition: (next: DataGridPointerAutoScrollPosition) => void;
    applyRangeMovePreviewFromPointer: () => void;
    applyFillPreviewFromPointer: () => void;
    applyDragSelectionFromPointer: () => void;
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame?: (handle: number) => void;
}
export interface UseDataGridPointerAutoScrollResult {
    startInteractionAutoScroll: () => void;
    stopAutoScrollFrameIfIdle: () => void;
    dispose: () => void;
}
export declare function useDataGridPointerAutoScroll(options: UseDataGridPointerAutoScrollOptions): UseDataGridPointerAutoScrollResult;
//# sourceMappingURL=useDataGridPointerAutoScroll.d.ts.map