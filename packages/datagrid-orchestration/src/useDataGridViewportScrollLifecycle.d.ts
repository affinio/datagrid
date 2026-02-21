export interface UseDataGridViewportScrollLifecycleOptions {
    isContextMenuVisible: () => boolean;
    shouldCloseContextMenuOnScroll?: () => boolean;
    closeContextMenu: () => void;
    resolveScrollTop: () => number;
    resolveScrollLeft: () => number;
    setScrollTop: (value: number) => void;
    setScrollLeft: (value: number) => void;
    hasInlineEditor: () => boolean;
    commitInlineEdit: () => void;
    scrollUpdateMode?: "sync" | "raf";
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame?: (handle: number) => void;
}
export interface UseDataGridViewportScrollLifecycleResult {
    onViewportScroll: (event: Event) => void;
    flushPendingScroll: () => void;
    dispose: () => void;
}
export declare function useDataGridViewportScrollLifecycle(options: UseDataGridViewportScrollLifecycleOptions): UseDataGridViewportScrollLifecycleResult;
//# sourceMappingURL=useDataGridViewportScrollLifecycle.d.ts.map