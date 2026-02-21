export interface UseDataGridInlineEditorKeyRouterOptions<TTarget = unknown> {
    isEditableColumn: (columnKey: string) => boolean;
    cancelInlineEdit: () => void;
    commitInlineEdit: () => boolean;
    resolveNextEditableTarget: (rowId: string, columnKey: string, direction: 1 | -1) => TTarget | null;
    focusInlineEditorTarget: (target: TTarget) => void;
}
export interface UseDataGridInlineEditorKeyRouterResult {
    dispatchEditorKeyDown: (event: KeyboardEvent, rowId: string, columnKey: string) => boolean;
}
export declare function useDataGridInlineEditorKeyRouter<TTarget = unknown>(options: UseDataGridInlineEditorKeyRouterOptions<TTarget>): UseDataGridInlineEditorKeyRouterResult;
//# sourceMappingURL=useDataGridInlineEditorKeyRouter.d.ts.map