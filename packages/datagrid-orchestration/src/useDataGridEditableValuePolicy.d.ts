export type DataGridEditableValueStrategy<TRow> = {
    kind: "text";
    apply: (row: TRow, draft: string) => void;
    canPaste?: (draft: string) => boolean;
    clearable?: boolean;
    clear?: (row: TRow) => boolean;
} | {
    kind: "enum";
    isAllowed: (draft: string) => boolean;
    apply: (row: TRow, draft: string) => void;
    clearable?: boolean;
    clear?: (row: TRow) => boolean;
} | {
    kind: "number";
    parse?: (draft: string) => number | null;
    apply: (row: TRow, numericValue: number) => void;
    clearable?: boolean;
    clear?: (row: TRow) => boolean;
};
export interface UseDataGridEditableValuePolicyOptions<TRow, TColumnKey extends string> {
    strategies: Readonly<Record<TColumnKey, DataGridEditableValueStrategy<TRow>>>;
    defaultClearable?: boolean;
}
export interface UseDataGridEditableValuePolicyResult<TRow, TColumnKey extends string> {
    hasEditablePolicy: (columnKey: string) => columnKey is TColumnKey;
    applyEditedValue: (row: TRow, columnKey: TColumnKey, draft: string) => void;
    canApplyPastedValue: (columnKey: TColumnKey, draft: string) => boolean;
    isColumnClearableForCut: (columnKey: TColumnKey) => boolean;
    clearEditedValue: (row: TRow, columnKey: TColumnKey) => boolean;
}
export declare function useDataGridEditableValuePolicy<TRow, TColumnKey extends string>(options: UseDataGridEditableValuePolicyOptions<TRow, TColumnKey>): UseDataGridEditableValuePolicyResult<TRow, TColumnKey>;
//# sourceMappingURL=useDataGridEditableValuePolicy.d.ts.map