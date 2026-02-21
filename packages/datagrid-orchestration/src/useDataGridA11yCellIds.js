function sanitizeDomIdPart(value) {
    return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}
export function useDataGridA11yCellIds(options) {
    const idPrefix = options.idPrefix ?? "datagrid";
    const rowAriaIndexBase = options.rowAriaIndexBase ?? 2;
    const columnAriaIndexBase = options.columnAriaIndexBase ?? 1;
    function getGridCellId(rowId, columnKey) {
        return `${idPrefix}-cell-${sanitizeDomIdPart(rowId)}-${sanitizeDomIdPart(columnKey)}`;
    }
    function getHeaderCellId(columnKey) {
        return `${idPrefix}-header-${sanitizeDomIdPart(columnKey)}`;
    }
    function getColumnAriaIndex(columnKey) {
        return Math.max(columnAriaIndexBase, options.resolveColumnIndex(columnKey) + columnAriaIndexBase);
    }
    function getRowAriaIndex(row) {
        return Math.max(rowAriaIndexBase, options.resolveRowIndex(row) + rowAriaIndexBase);
    }
    return {
        getGridCellId,
        getHeaderCellId,
        getColumnAriaIndex,
        getRowAriaIndex,
    };
}
