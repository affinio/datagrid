export interface UseDataGridInlineEditorSchemaOptions<TEnumColumnKey extends string> {
  enumOptionsByColumn: Readonly<Record<TEnumColumnKey, readonly string[]>>
}

export interface UseDataGridInlineEditorSchemaResult<TEnumColumnKey extends string> {
  enumColumnKeys: readonly TEnumColumnKey[]
  isEnumColumn: (columnKey: string) => columnKey is TEnumColumnKey
  getEditorOptions: (columnKey: string) => readonly string[] | null
  hasEditorOption: (columnKey: string, value: string) => boolean
}

export function useDataGridInlineEditorSchema<TEnumColumnKey extends string>(
  options: UseDataGridInlineEditorSchemaOptions<TEnumColumnKey>,
): UseDataGridInlineEditorSchemaResult<TEnumColumnKey> {
  const enumColumnKeys = Object.keys(options.enumOptionsByColumn) as TEnumColumnKey[]
  const enumColumnKeySet = new Set<TEnumColumnKey>(enumColumnKeys)

  function isEnumColumn(columnKey: string): columnKey is TEnumColumnKey {
    return enumColumnKeySet.has(columnKey as TEnumColumnKey)
  }

  function getEditorOptions(columnKey: string): readonly string[] | null {
    if (!isEnumColumn(columnKey)) {
      return null
    }
    return options.enumOptionsByColumn[columnKey] ?? null
  }

  function hasEditorOption(columnKey: string, value: string): boolean {
    const columnOptions = getEditorOptions(columnKey)
    if (!columnOptions) {
      return false
    }
    return columnOptions.includes(value)
  }

  return {
    enumColumnKeys,
    isEnumColumn,
    getEditorOptions,
    hasEditorOption,
  }
}
