export function useDataGridCellPointerHoverRouter(options) {
    const isPrimaryPointerPressed = options.isPrimaryPointerPressed ?? ((event) => (event.buttons & 1) === 1);
    function dispatchCellPointerEnter(row, columnKey, event) {
        if (options.hasInlineEditor() || !options.isDragSelecting() || options.isSelectionColumn(columnKey)) {
            return false;
        }
        if (!isPrimaryPointerPressed(event)) {
            return false;
        }
        const coord = options.resolveCellCoord(row, columnKey);
        if (!coord) {
            return false;
        }
        if (options.cellCoordsEqual(options.resolveLastDragCoord(), coord)) {
            return false;
        }
        options.setLastDragCoord(coord);
        options.setDragPointer({ clientX: event.clientX, clientY: event.clientY });
        options.applyCellSelection(coord, true, undefined, false);
        return true;
    }
    return {
        dispatchCellPointerEnter,
    };
}
