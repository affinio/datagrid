export interface UseDataGridViewportBlurHandlerOptions {
    resolveViewportElement: () => HTMLElement | null;
    resolveContextMenuElement: () => HTMLElement | null;
    stopDragSelection: () => void;
    stopFillSelection: (commit: boolean) => void;
    stopRangeMove: (commit: boolean) => void;
    stopColumnResize: () => void;
    closeContextMenu: () => void;
    hasInlineEditor: () => boolean;
    commitInlineEdit: () => boolean;
}
export interface UseDataGridViewportBlurHandlerResult {
    handleViewportBlur: (event: FocusEvent) => boolean;
}
export declare function useDataGridViewportBlurHandler(options: UseDataGridViewportBlurHandlerOptions): UseDataGridViewportBlurHandlerResult;
//# sourceMappingURL=useDataGridViewportBlurHandler.d.ts.map