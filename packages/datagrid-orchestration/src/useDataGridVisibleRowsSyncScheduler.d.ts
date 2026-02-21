export interface DataGridVisibleRowsRange {
    start: number;
    end: number;
}
export interface UseDataGridVisibleRowsSyncSchedulerOptions<TRowSource, TVisibleRow> {
    resolveRows: () => readonly TRowSource[];
    resolveRange: () => DataGridVisibleRowsRange;
    setRows: (rows: readonly TRowSource[]) => void;
    syncRowsInRange: (range: DataGridVisibleRowsRange) => readonly TVisibleRow[];
    applyVisibleRows: (rows: readonly TVisibleRow[]) => void;
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame?: (handle: number) => void;
}
export interface UseDataGridVisibleRowsSyncSchedulerResult {
    syncVisibleRows: () => void;
    scheduleVisibleRowsSync: () => void;
    resetVisibleRowsSyncCache: () => void;
    dispose: () => void;
}
export declare function useDataGridVisibleRowsSyncScheduler<TRowSource, TVisibleRow>(options: UseDataGridVisibleRowsSyncSchedulerOptions<TRowSource, TVisibleRow>): UseDataGridVisibleRowsSyncSchedulerResult;
//# sourceMappingURL=useDataGridVisibleRowsSyncScheduler.d.ts.map