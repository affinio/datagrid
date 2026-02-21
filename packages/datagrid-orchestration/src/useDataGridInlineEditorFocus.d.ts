export interface UseDataGridInlineEditorFocusOptions {
    resolveViewportElement: () => HTMLElement | null;
    beforeFocus?: () => void | Promise<void>;
}
export interface UseDataGridInlineEditorFocusResult {
    focusInlineEditorElement: (rowId: string, columnKey: string, mode: string, openPicker: boolean) => Promise<void>;
}
export declare function useDataGridInlineEditorFocus(options: UseDataGridInlineEditorFocusOptions): UseDataGridInlineEditorFocusResult;
//# sourceMappingURL=useDataGridInlineEditorFocus.d.ts.map