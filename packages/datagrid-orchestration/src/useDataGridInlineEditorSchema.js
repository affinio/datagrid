export function useDataGridInlineEditorSchema(options) {
    const enumColumnKeys = Object.keys(options.enumOptionsByColumn);
    const enumColumnKeySet = new Set(enumColumnKeys);
    function isEnumColumn(columnKey) {
        return enumColumnKeySet.has(columnKey);
    }
    function getEditorOptions(columnKey) {
        if (!isEnumColumn(columnKey)) {
            return null;
        }
        return options.enumOptionsByColumn[columnKey] ?? null;
    }
    function hasEditorOption(columnKey, value) {
        const columnOptions = getEditorOptions(columnKey);
        if (!columnOptions) {
            return false;
        }
        return columnOptions.includes(value);
    }
    return {
        enumColumnKeys,
        isEnumColumn,
        getEditorOptions,
        hasEditorOption,
    };
}
