export function useDataGridCellDatasetResolver(options) {
    function resolveRowIndexById(rowId) {
        return options.resolveRows().findIndex(row => String(options.resolveRowId(row)) === rowId);
    }
    function resolveCellCoordFromDataset(rowId, columnKey) {
        const rowIndex = resolveRowIndexById(rowId);
        if (rowIndex < 0) {
            return null;
        }
        const columnIndex = options.resolveColumnIndex(columnKey);
        if (columnIndex < 0) {
            return null;
        }
        return options.normalizeCellCoord({
            rowIndex,
            columnIndex,
        });
    }
    return {
        resolveRowIndexById,
        resolveCellCoordFromDataset,
    };
}
