export function useDataGridCellCoordNormalizer(options) {
    function resolveBounds() {
        const window = options.resolveVirtualWindow();
        const rowCount = Math.max(0, Math.trunc(window?.rowTotal ?? 0));
        const columnCount = Math.max(0, Math.trunc(window?.colTotal ?? 0));
        return {
            rowCount,
            columnCount,
        };
    }
    function normalizeCellCoordBase(coord) {
        if (!Number.isFinite(coord.rowIndex) || !Number.isFinite(coord.columnIndex)) {
            return null;
        }
        const bounds = resolveBounds();
        const maxRowIndex = bounds.rowCount - 1;
        const maxColumnIndex = bounds.columnCount - 1;
        if (maxRowIndex < 0 || maxColumnIndex < 0) {
            return null;
        }
        return {
            rowIndex: Math.max(0, Math.min(maxRowIndex, Math.trunc(coord.rowIndex))),
            columnIndex: Math.max(0, Math.min(maxColumnIndex, Math.trunc(coord.columnIndex))),
        };
    }
    return {
        normalizeCellCoordBase,
    };
}
