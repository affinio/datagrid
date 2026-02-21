export interface UseDataGridMoveMutationPolicyOptions<TRow, TEditableColumnKey extends string> {
    isEditableColumn: (columnKey: string) => columnKey is TEditableColumnKey;
    applyEditedValue: (row: TRow, columnKey: TEditableColumnKey, value: string) => void;
    clearEditedValue: (row: TRow, columnKey: TEditableColumnKey) => boolean;
    isBlockedColumn?: (columnKey: string) => boolean;
}
export interface UseDataGridMoveMutationPolicyResult<TRow> {
    applyValueForMove: (row: TRow, columnKey: string, value: string) => boolean;
    clearValueForMove: (row: TRow, columnKey: string) => boolean;
}
export declare function useDataGridMoveMutationPolicy<TRow, TEditableColumnKey extends string>(options: UseDataGridMoveMutationPolicyOptions<TRow, TEditableColumnKey>): UseDataGridMoveMutationPolicyResult<TRow>;
//# sourceMappingURL=useDataGridMoveMutationPolicy.d.ts.map