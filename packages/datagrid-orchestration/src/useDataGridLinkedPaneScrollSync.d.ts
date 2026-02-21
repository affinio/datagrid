export type DataGridLinkedPaneSyncMode = "direct-transform" | "css-var";
export interface UseDataGridLinkedPaneScrollSyncOptions {
    resolveSourceScrollTop: () => number;
    mode?: DataGridLinkedPaneSyncMode;
    resolvePaneElements?: () => readonly (HTMLElement | null | undefined)[];
    resolveCssVarHost?: () => HTMLElement | null;
    cssVarName?: string;
    clearOnReset?: boolean;
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    cancelAnimationFrame?: (handle: number) => void;
}
export interface UseDataGridLinkedPaneScrollSyncResult {
    syncNow: (scrollTop?: number) => number;
    onSourceScroll: (scrollTop?: number) => void;
    scheduleSyncLoop: () => void;
    cancelSyncLoop: () => void;
    isSyncLoopScheduled: () => boolean;
    getLastAppliedScrollTop: () => number;
    reset: () => void;
}
export declare function useDataGridLinkedPaneScrollSync(options: UseDataGridLinkedPaneScrollSyncOptions): UseDataGridLinkedPaneScrollSyncResult;
//# sourceMappingURL=useDataGridLinkedPaneScrollSync.d.ts.map