export function useDataGridCellVisualStatePredicates(options) {
    const selectColumnKey = options.selectColumnKey ?? "select";
    function resolveRowColumn(row, columnKey) {
        if (columnKey === selectColumnKey) {
            return null;
        }
        const columnIndex = options.resolveColumnIndex(columnKey);
        if (columnIndex < 0) {
            return null;
        }
        return {
            rowIndex: options.resolveRowIndex(row),
            columnIndex,
        };
    }
    function isCellInSelection(row, columnKey) {
        const range = options.resolveSelectionRange();
        if (!range) {
            return false;
        }
        const indexes = resolveRowColumn(row, columnKey);
        if (!indexes) {
            return false;
        }
        return options.isCellWithinRange(indexes.rowIndex, indexes.columnIndex, range);
    }
    function isCellInCopiedRange(row, columnKey) {
        const range = options.resolveCopiedRange();
        if (!range) {
            return false;
        }
        const indexes = resolveRowColumn(row, columnKey);
        if (!indexes) {
            return false;
        }
        return options.isCellWithinRange(indexes.rowIndex, indexes.columnIndex, range);
    }
    function isAnchorCell(row, columnKey) {
        const anchor = options.resolveAnchorCoord();
        if (!anchor) {
            return false;
        }
        const indexes = resolveRowColumn(row, columnKey);
        if (!indexes) {
            return false;
        }
        return indexes.rowIndex === anchor.rowIndex && indexes.columnIndex === anchor.columnIndex;
    }
    function isActiveCell(row, columnKey) {
        const active = options.resolveActiveCoord();
        if (!active) {
            return false;
        }
        const indexes = resolveRowColumn(row, columnKey);
        if (!indexes) {
            return false;
        }
        return indexes.rowIndex === active.rowIndex && indexes.columnIndex === active.columnIndex;
    }
    function isRangeEndCell(row, columnKey) {
        const range = options.resolveSelectionRange();
        if (!range) {
            return false;
        }
        const indexes = resolveRowColumn(row, columnKey);
        if (!indexes) {
            return false;
        }
        return indexes.rowIndex === range.endRow && indexes.columnIndex === range.endColumn;
    }
    function isCellInFillPreview(row, columnKey) {
        const preview = options.resolveFillPreviewRange();
        if (!options.isFillDragging() || !preview) {
            return false;
        }
        const indexes = resolveRowColumn(row, columnKey);
        if (!indexes) {
            return false;
        }
        if (!options.isCellWithinRange(indexes.rowIndex, indexes.columnIndex, preview)) {
            return false;
        }
        const base = options.resolveFillBaseRange();
        if (!base) {
            return true;
        }
        return !options.isCellWithinRange(indexes.rowIndex, indexes.columnIndex, base);
    }
    function isCellInMovePreview(row, columnKey) {
        const preview = options.resolveMovePreviewRange();
        if (!options.isRangeMoving() || !preview) {
            return false;
        }
        const indexes = resolveRowColumn(row, columnKey);
        if (!indexes) {
            return false;
        }
        if (!options.isCellWithinRange(indexes.rowIndex, indexes.columnIndex, preview)) {
            return false;
        }
        const base = options.resolveMoveBaseRange();
        if (!base) {
            return true;
        }
        return !options.isCellWithinRange(indexes.rowIndex, indexes.columnIndex, base);
    }
    function shouldShowFillHandle(row, columnKey) {
        if (options.isFillDragging()) {
            return false;
        }
        if (options.isInlineEditorOpen?.()) {
            return false;
        }
        return isRangeEndCell(row, columnKey);
    }
    return {
        isCellInSelection,
        isCellInCopiedRange,
        isAnchorCell,
        isActiveCell,
        isRangeEndCell,
        isCellInFillPreview,
        isCellInMovePreview,
        shouldShowFillHandle,
    };
}
