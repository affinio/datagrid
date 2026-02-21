export interface DataGridViewportMeasuredState {
    viewportHeight: number;
    viewportWidth: number;
    headerHeight: number;
}
export interface UseDataGridViewportMeasureSchedulerOptions {
    resolveViewportElement: () => HTMLElement | null;
    resolveHeaderElement: () => HTMLElement | null;
    resolveCurrentState: () => DataGridViewportMeasuredState;
    applyMeasuredState: (next: DataGridViewportMeasuredState) => void;
    rowHeight: number;
    minViewportBodyHeight?: number;
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame?: (handle: number) => void;
}
export interface UseDataGridViewportMeasureSchedulerResult {
    syncViewportHeight: () => void;
    scheduleViewportMeasure: () => void;
    dispose: () => void;
}
export declare function useDataGridViewportMeasureScheduler(options: UseDataGridViewportMeasureSchedulerOptions): UseDataGridViewportMeasureSchedulerResult;
//# sourceMappingURL=useDataGridViewportMeasureScheduler.d.ts.map