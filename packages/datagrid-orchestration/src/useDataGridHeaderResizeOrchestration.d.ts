export interface DataGridHeaderResizeState {
    columnKey: string;
    startClientX: number;
    startWidth: number;
    lastWidth: number;
}
export type DataGridHeaderResizeApplyMode = "sync" | "raf";
export interface UseDataGridHeaderResizeOrchestrationOptions<TRow> {
    resolveColumnBaseWidth: (columnKey: string) => number | null | undefined;
    resolveColumnLabel: (columnKey: string) => string | null | undefined;
    resolveRowsForAutoSize: () => readonly TRow[];
    resolveCellText: (row: TRow, columnKey: string) => string;
    resolveColumnWidthOverride: (columnKey: string) => number | null | undefined;
    resolveColumnMinWidth: (columnKey: string) => number;
    applyColumnWidth: (columnKey: string, width: number) => void;
    isColumnResizable: (columnKey: string) => boolean;
    isFillDragging: () => boolean;
    stopFillSelection: (applyPreview: boolean) => void;
    isDragSelecting: () => boolean;
    stopDragSelection: () => void;
    setLastAction: (message: string) => void;
    autoSizeSampleLimit: number;
    autoSizeCharWidth: number;
    autoSizeHorizontalPadding: number;
    autoSizeMaxWidth: number;
    resizeApplyMode?: DataGridHeaderResizeApplyMode;
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame?: (handle: number) => void;
}
export interface UseDataGridHeaderResizeOrchestrationResult {
    getActiveColumnResize: () => DataGridHeaderResizeState | null;
    isColumnResizing: () => boolean;
    subscribe: (listener: (state: DataGridHeaderResizeState | null) => void) => () => void;
    setColumnWidth: (columnKey: string, width: number) => void;
    estimateColumnAutoWidth: (columnKey: string) => number;
    onHeaderResizeHandleMouseDown: (columnKey: string, event: MouseEvent) => void;
    onHeaderResizeHandleDoubleClick: (columnKey: string, event: MouseEvent) => void;
    applyColumnResizeFromPointer: (clientX: number) => void;
    stopColumnResize: () => void;
    dispose: () => void;
}
export declare function useDataGridHeaderResizeOrchestration<TRow>(options: UseDataGridHeaderResizeOrchestrationOptions<TRow>): UseDataGridHeaderResizeOrchestrationResult;
//# sourceMappingURL=useDataGridHeaderResizeOrchestration.d.ts.map