export function useDataGridNavigationPrimitives(options) {
    function resolveRowIndex(row) {
        const candidate = [row.displayIndex, row.sourceIndex, row.originalIndex].find(Number.isFinite) ?? 0;
        return Math.max(0, Math.trunc(candidate));
    }
    function resolveColumnIndex(columnKey) {
        return options.resolveColumns().findIndex(column => column.key === columnKey);
    }
    function clampRowIndex(rowIndex) {
        const maxRowIndex = Math.max(0, options.resolveRowsLength() - 1);
        return Math.max(0, Math.min(maxRowIndex, Math.trunc(rowIndex)));
    }
    function getFirstNavigableColumnIndex() {
        return options.resolveNavigableColumnIndexes()[0] ?? -1;
    }
    function getLastNavigableColumnIndex() {
        const indexes = options.resolveNavigableColumnIndexes();
        return indexes[indexes.length - 1] ?? -1;
    }
    function resolveNearestNavigableColumnIndex(columnIndex, direction = 1) {
        const indexes = options.resolveNavigableColumnIndexes();
        if (!indexes.length) {
            return -1;
        }
        if (indexes.includes(columnIndex)) {
            return columnIndex;
        }
        if (direction > 0) {
            return indexes.find(index => index >= columnIndex) ?? getLastNavigableColumnIndex();
        }
        for (let index = indexes.length - 1; index >= 0; index -= 1) {
            const candidate = indexes[index];
            if (candidate !== undefined && candidate <= columnIndex) {
                return candidate;
            }
        }
        return getFirstNavigableColumnIndex();
    }
    function getAdjacentNavigableColumnIndex(columnIndex, direction) {
        const indexes = options.resolveNavigableColumnIndexes();
        if (!indexes.length) {
            return -1;
        }
        const currentPos = indexes.indexOf(columnIndex);
        if (currentPos === -1) {
            return resolveNearestNavigableColumnIndex(columnIndex, direction);
        }
        const nextPos = Math.max(0, Math.min(indexes.length - 1, currentPos + direction));
        return indexes[nextPos] ?? columnIndex;
    }
    function positiveModulo(value, divisor) {
        if (divisor <= 0) {
            return 0;
        }
        const remainder = value % divisor;
        return remainder < 0 ? remainder + divisor : remainder;
    }
    function applyCellSelection(nextCoord, extend, fallbackAnchor, ensureVisible = true) {
        const normalized = options.normalizeCellCoord(nextCoord);
        if (!normalized) {
            return;
        }
        let nextAnchor;
        let nextFocus;
        if (extend) {
            const anchor = options.resolveCellAnchor() ?? fallbackAnchor ?? options.resolveActiveCell() ?? normalized;
            nextAnchor = options.normalizeCellCoord(anchor) ?? normalized;
            nextFocus = normalized;
        }
        else {
            nextAnchor = normalized;
            nextFocus = normalized;
        }
        if (!options.coordsEqual(options.resolveCellAnchor(), nextAnchor)) {
            options.setCellAnchor(nextAnchor);
        }
        if (!options.coordsEqual(options.resolveCellFocus(), nextFocus)) {
            options.setCellFocus(nextFocus);
        }
        if (!options.coordsEqual(options.resolveActiveCell(), normalized)) {
            options.setActiveCell(normalized);
        }
        if (ensureVisible) {
            options.ensureCellVisible(normalized);
        }
    }
    function isCoordInsideRange(coord, range) {
        return (coord.rowIndex >= range.startRow &&
            coord.rowIndex <= range.endRow &&
            coord.columnIndex >= range.startColumn &&
            coord.columnIndex <= range.endColumn);
    }
    return {
        resolveRowIndex,
        resolveColumnIndex,
        clampRowIndex,
        getFirstNavigableColumnIndex,
        getLastNavigableColumnIndex,
        resolveNearestNavigableColumnIndex,
        getAdjacentNavigableColumnIndex,
        positiveModulo,
        applyCellSelection,
        isCoordInsideRange,
    };
}
