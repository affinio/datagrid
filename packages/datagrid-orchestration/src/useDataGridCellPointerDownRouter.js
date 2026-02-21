export function useDataGridCellPointerDownRouter(options) {
    function dispatchCellPointerDown(row, columnKey, event) {
        if (options.isSelectionColumn(columnKey)) {
            return false;
        }
        const allowModifierSecondaryButton = options.isRangeMoveModifierActive(event) && event.button === 2;
        if (event.button !== 0 && !allowModifierSecondaryButton) {
            return false;
        }
        const targetNode = event.target;
        if (options.isEditorInteractionTarget(targetNode)) {
            return false;
        }
        if (options.hasInlineEditor()) {
            options.commitInlineEdit();
        }
        const coord = options.resolveCellCoord(row, columnKey);
        if (!coord) {
            return false;
        }
        const currentRange = options.resolveSelectionRange();
        if (options.isRangeMoveModifierActive(event) &&
            currentRange &&
            options.isCoordInsideRange(coord, currentRange)) {
            event.preventDefault();
            options.startRangeMove(coord, { clientX: event.clientX, clientY: event.clientY });
            return true;
        }
        event.preventDefault();
        options.closeContextMenu();
        options.focusViewport();
        if (options.isFillDragging()) {
            options.stopFillSelection(false);
        }
        options.setDragSelecting(true);
        options.setLastDragCoord(coord);
        options.setDragPointer({ clientX: event.clientX, clientY: event.clientY });
        options.applyCellSelection(coord, event.shiftKey, coord);
        options.startInteractionAutoScroll();
        options.setLastAction(event.shiftKey
            ? `Extended selection to R${coord.rowIndex + 1} · ${columnKey}`
            : `Anchor set: R${coord.rowIndex + 1} · ${columnKey}`);
        return true;
    }
    return {
        dispatchCellPointerDown,
    };
}
