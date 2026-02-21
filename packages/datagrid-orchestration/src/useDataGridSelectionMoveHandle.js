const EMPTY_SIDES = {
    top: false,
    right: false,
    bottom: false,
    left: false,
};
export function useDataGridSelectionMoveHandle(options) {
    const selectColumnKey = options.selectColumnKey ?? "select";
    function getSelectionEdgeSides(row, columnKey) {
        const range = options.resolveSelectionRange();
        if (!range || columnKey === selectColumnKey) {
            return EMPTY_SIDES;
        }
        const rowIndex = options.resolveRowIndex(row);
        const columnIndex = options.resolveColumnIndex(columnKey);
        if (columnIndex < 0 || !options.isCellWithinRange(rowIndex, columnIndex, range)) {
            return EMPTY_SIDES;
        }
        return {
            top: rowIndex === range.startRow,
            right: columnIndex === range.endColumn,
            bottom: rowIndex === range.endRow,
            left: columnIndex === range.startColumn,
        };
    }
    function shouldShowSelectionMoveHandle(row, columnKey, side) {
        if (options.isRangeMoving() || options.isFillDragging() || options.isInlineEditorOpen()) {
            return false;
        }
        return getSelectionEdgeSides(row, columnKey)[side];
    }
    function onSelectionMoveHandleMouseDown(row, columnKey, event) {
        if (event.button !== 0) {
            return false;
        }
        const coord = options.resolveCellCoord(row, columnKey);
        if (!coord) {
            return false;
        }
        event.preventDefault();
        event.stopPropagation();
        return options.startRangeMove(coord, event);
    }
    return {
        getSelectionEdgeSides,
        shouldShowSelectionMoveHandle,
        onSelectionMoveHandleMouseDown,
    };
}
