export interface UseDataGridHeaderInteractionRouterOptions {
    isSortableColumn: (columnKey: string) => boolean;
    applySortFromHeader: (columnKey: string, append: boolean) => void;
    openHeaderContextMenu: (x: number, y: number, columnKey: string) => void;
    contextMenuBlockedColumnKey?: string;
}
export interface UseDataGridHeaderInteractionRouterResult {
    onHeaderCellClick: (columnKey: string, event: MouseEvent) => void;
    onHeaderCellKeyDown: (columnKey: string, event: KeyboardEvent) => void;
}
export declare function useDataGridHeaderInteractionRouter(options: UseDataGridHeaderInteractionRouterOptions): UseDataGridHeaderInteractionRouterResult;
//# sourceMappingURL=useDataGridHeaderInteractionRouter.d.ts.map