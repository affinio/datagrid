export function useDataGridRangeMoveStart(options) {
    function startRangeMove(coord, pointer) {
        const currentRange = options.resolveSelectionRange();
        if (!currentRange || !options.isCoordInsideRange(coord, currentRange)) {
            return false;
        }
        options.closeContextMenu();
        options.focusViewport();
        options.stopDragSelection();
        options.stopFillSelection(false);
        options.setRangeMoving(true);
        options.setRangeMovePointer({ clientX: pointer.clientX, clientY: pointer.clientY });
        options.setRangeMoveBaseRange({ ...currentRange });
        options.setRangeMoveOrigin(coord);
        options.setRangeMovePreviewRange({ ...currentRange });
        options.startInteractionAutoScroll();
        options.setLastAction("Move preview active");
        return true;
    }
    return {
        startRangeMove,
    };
}
