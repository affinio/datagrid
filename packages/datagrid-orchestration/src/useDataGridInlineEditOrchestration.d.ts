export type DataGridInlineEditorMode = "text" | "select";
export interface DataGridInlineEditorState<TColumnKey extends string> {
    rowId: string;
    columnKey: TColumnKey;
    draft: string;
    mode: DataGridInlineEditorMode;
}
export interface DataGridInlineEditTarget<TColumnKey extends string> {
    rowId: string;
    columnKey: TColumnKey;
}
export interface UseDataGridInlineEditOrchestrationOptions<TRow, TColumnKey extends string, TRange = unknown, TSnapshot = unknown> {
    sourceRows: () => readonly TRow[];
    setSourceRows: (rows: readonly TRow[]) => void;
    cloneRow: (row: TRow) => TRow;
    resolveRowId: (row: TRow) => string;
    resolveCellValue: (row: TRow, columnKey: string) => unknown;
    isEditableColumn: (columnKey: string) => columnKey is TColumnKey;
    isSelectColumn?: (columnKey: string) => boolean;
    resolveRowLabel?: (row: TRow) => string;
    applyEditedValue: (row: TRow, columnKey: TColumnKey, draft: string) => void;
    finalizeEditedRow?: (row: TRow, columnKey: TColumnKey, draft: string) => void;
    focusInlineEditor?: (rowId: string, columnKey: TColumnKey, mode: DataGridInlineEditorMode, openPicker: boolean) => void | Promise<void>;
    setLastAction?: (message: string) => void;
    captureBeforeSnapshot?: () => TSnapshot;
    resolveAffectedRange?: (target: DataGridInlineEditTarget<TColumnKey>) => TRange | null;
    recordIntentTransaction?: (descriptor: {
        intent: "edit";
        label: string;
        affectedRange: TRange | null;
    }, beforeSnapshot: TSnapshot) => Promise<void>;
}
export interface UseDataGridInlineEditOrchestrationResult<TRow, TColumnKey extends string> {
    getInlineEditor: () => DataGridInlineEditorState<TColumnKey> | null;
    subscribeInlineEditor: (listener: (editor: DataGridInlineEditorState<TColumnKey> | null) => void) => () => void;
    isEditingCell: (rowId: string, columnKey: string) => boolean;
    isSelectEditorCell: (rowId: string, columnKey: string) => boolean;
    beginInlineEdit: (row: TRow, columnKey: string, mode?: DataGridInlineEditorMode, openPicker?: boolean) => boolean;
    cancelInlineEdit: () => void;
    commitInlineEdit: () => boolean;
    updateEditorDraft: (value: string) => void;
    onEditorInput: (event: Event) => void;
    onEditorSelectChange: (value: string | number) => boolean;
}
export declare function useDataGridInlineEditOrchestration<TRow, TColumnKey extends string, TRange = unknown, TSnapshot = unknown>(options: UseDataGridInlineEditOrchestrationOptions<TRow, TColumnKey, TRange, TSnapshot>): UseDataGridInlineEditOrchestrationResult<TRow, TColumnKey>;
//# sourceMappingURL=useDataGridInlineEditOrchestration.d.ts.map