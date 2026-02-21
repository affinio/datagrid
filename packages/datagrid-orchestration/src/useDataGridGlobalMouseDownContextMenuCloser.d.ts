export interface UseDataGridGlobalMouseDownContextMenuCloserOptions {
    isContextMenuVisible: () => boolean;
    resolveContextMenuElement: () => HTMLElement | null;
    closeContextMenu: () => void;
}
export interface UseDataGridGlobalMouseDownContextMenuCloserResult {
    dispatchGlobalMouseDown: (event: MouseEvent) => boolean;
}
export declare function useDataGridGlobalMouseDownContextMenuCloser(options: UseDataGridGlobalMouseDownContextMenuCloserOptions): UseDataGridGlobalMouseDownContextMenuCloserResult;
//# sourceMappingURL=useDataGridGlobalMouseDownContextMenuCloser.d.ts.map