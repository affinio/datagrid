export function useDataGridColumnUiPolicy(options) {
    const selectColumnKey = options.selectColumnKey ?? "select";
    const selectColumnMinWidth = options.selectColumnMinWidth ?? 48;
    const selectColumnDefaultWidth = options.selectColumnDefaultWidth ?? 58;
    const defaultColumnMinWidth = options.defaultColumnMinWidth ?? 110;
    const defaultColumnWidth = options.defaultColumnWidth ?? 160;
    function isGroupedByColumn(columnKey) {
        const groupBy = options.resolveCurrentGroupBy();
        return groupBy !== "none" && Boolean(groupBy) && columnKey === groupBy;
    }
    function isSortableColumn(columnKey) {
        return columnKey !== selectColumnKey;
    }
    function isColumnResizable(columnKey) {
        return columnKey !== selectColumnKey;
    }
    function resolveColumnFilterKind(columnKey) {
        if (options.isEnumColumn(columnKey)) {
            return "enum";
        }
        if (options.numericColumnKeys.has(columnKey)) {
            return "number";
        }
        return "text";
    }
    function resolveEnumFilterOptions(columnKey) {
        const editorOptions = options.resolveEnumEditorOptions(columnKey);
        if (editorOptions && editorOptions.length) {
            return [...editorOptions];
        }
        const values = new Set();
        for (const row of options.resolveRows()) {
            const value = options.resolveCellValue(row, columnKey);
            if (value === null || typeof value === "undefined") {
                continue;
            }
            values.add(String(value));
        }
        return [...values].sort((left, right) => left.localeCompare(right));
    }
    function resolveColumnWidth(column) {
        if (column.key === selectColumnKey) {
            return Math.max(selectColumnMinWidth, column.width ?? selectColumnDefaultWidth);
        }
        return Math.max(defaultColumnMinWidth, column.width ?? defaultColumnWidth);
    }
    return {
        isGroupedByColumn,
        isSortableColumn,
        isColumnResizable,
        resolveColumnFilterKind,
        resolveEnumFilterOptions,
        resolveColumnWidth,
    };
}
