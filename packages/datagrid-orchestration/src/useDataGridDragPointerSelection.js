export function useDataGridDragPointerSelection(options) {
    function applyDragSelectionFromPointer() {
        if (!options.isDragSelecting()) {
            return;
        }
        const pointer = options.resolveDragPointer();
        if (!pointer) {
            return;
        }
        const coord = options.resolveCellCoordFromPointer(pointer.clientX, pointer.clientY);
        if (!coord) {
            return;
        }
        if (options.cellCoordsEqual(options.resolveLastDragCoord(), coord)) {
            return;
        }
        options.setLastDragCoord(coord);
        options.applyCellSelection(coord, true, undefined, false);
    }
    return {
        applyDragSelectionFromPointer,
    };
}
