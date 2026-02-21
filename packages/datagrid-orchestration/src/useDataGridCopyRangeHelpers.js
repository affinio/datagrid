export function useDataGridCopyRangeHelpers(options) {
    function isMultiCellSelection(range) {
        if (!range) {
            return false;
        }
        return range.startRow !== range.endRow || range.startColumn !== range.endColumn;
    }
    function resolveCopyRange() {
        const selected = options.resolveSelectionRange();
        if (selected) {
            return selected;
        }
        const current = options.resolveCurrentCellCoord();
        if (!current) {
            return null;
        }
        return {
            startRow: current.rowIndex,
            endRow: current.rowIndex,
            startColumn: current.columnIndex,
            endColumn: current.columnIndex,
        };
    }
    return {
        isMultiCellSelection,
        resolveCopyRange,
    };
}
