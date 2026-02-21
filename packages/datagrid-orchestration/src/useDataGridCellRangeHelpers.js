export function useDataGridCellRangeHelpers(options) {
    const isColumnSelectable = options.isColumnSelectable ?? (() => true);
    function normalizeCellCoord(coord) {
        if (options.resolveRowsLength() === 0) {
            return null;
        }
        const rowIndex = options.clampRowIndex(coord.rowIndex);
        const columnIndex = options.resolveNearestNavigableColumnIndex(Math.trunc(coord.columnIndex));
        if (columnIndex < 0) {
            return null;
        }
        return {
            rowIndex,
            columnIndex,
        };
    }
    function resolveCellCoord(row, columnKey) {
        if (!isColumnSelectable(columnKey)) {
            return null;
        }
        const rawColumnIndex = options.resolveColumnIndex(columnKey);
        if (rawColumnIndex < 0) {
            return null;
        }
        const columnIndex = options.resolveNearestNavigableColumnIndex(rawColumnIndex);
        if (columnIndex < 0) {
            return null;
        }
        return {
            rowIndex: options.clampRowIndex(options.resolveRowIndex(row)),
            columnIndex,
        };
    }
    function normalizeSelectionRange(range) {
        const start = normalizeCellCoord({
            rowIndex: range.startRow,
            columnIndex: range.startColumn,
        });
        const end = normalizeCellCoord({
            rowIndex: range.endRow,
            columnIndex: range.endColumn,
        });
        if (!start || !end) {
            return null;
        }
        return {
            startRow: Math.min(start.rowIndex, end.rowIndex),
            endRow: Math.max(start.rowIndex, end.rowIndex),
            startColumn: Math.min(start.columnIndex, end.columnIndex),
            endColumn: Math.max(start.columnIndex, end.columnIndex),
        };
    }
    function buildExtendedRange(baseRange, coord) {
        return normalizeSelectionRange({
            startRow: coord.rowIndex < baseRange.startRow ? coord.rowIndex : baseRange.startRow,
            endRow: coord.rowIndex > baseRange.endRow ? coord.rowIndex : baseRange.endRow,
            startColumn: coord.columnIndex < baseRange.startColumn ? coord.columnIndex : baseRange.startColumn,
            endColumn: coord.columnIndex > baseRange.endColumn ? coord.columnIndex : baseRange.endColumn,
        });
    }
    function isCellWithinRange(rowIndex, columnIndex, range) {
        return (rowIndex >= range.startRow &&
            rowIndex <= range.endRow &&
            columnIndex >= range.startColumn &&
            columnIndex <= range.endColumn);
    }
    function resolveCurrentCellCoord() {
        const candidate = options.resolveCandidateCurrentCell();
        if (candidate) {
            return normalizeCellCoord(candidate);
        }
        const firstColumnIndex = options.resolveFirstNavigableColumnIndex();
        if (options.resolveRowsLength() === 0 || firstColumnIndex < 0) {
            return null;
        }
        return {
            rowIndex: 0,
            columnIndex: firstColumnIndex,
        };
    }
    return {
        resolveCellCoord,
        normalizeCellCoord,
        normalizeSelectionRange,
        buildExtendedRange,
        isCellWithinRange,
        resolveCurrentCellCoord,
    };
}
