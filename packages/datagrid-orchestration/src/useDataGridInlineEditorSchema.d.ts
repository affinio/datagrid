export interface UseDataGridInlineEditorSchemaOptions<TEnumColumnKey extends string> {
    enumOptionsByColumn: Readonly<Record<TEnumColumnKey, readonly string[]>>;
}
export interface UseDataGridInlineEditorSchemaResult<TEnumColumnKey extends string> {
    enumColumnKeys: readonly TEnumColumnKey[];
    isEnumColumn: (columnKey: string) => columnKey is TEnumColumnKey;
    getEditorOptions: (columnKey: string) => readonly string[] | null;
    hasEditorOption: (columnKey: string, value: string) => boolean;
}
export declare function useDataGridInlineEditorSchema<TEnumColumnKey extends string>(options: UseDataGridInlineEditorSchemaOptions<TEnumColumnKey>): UseDataGridInlineEditorSchemaResult<TEnumColumnKey>;
//# sourceMappingURL=useDataGridInlineEditorSchema.d.ts.map