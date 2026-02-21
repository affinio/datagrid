export function useDataGridFillHandleStart(options) {
    function onSelectionHandleMouseDown(event) {
        if (event.button !== 0) {
            return false;
        }
        const currentRange = options.resolveSelectionRange();
        if (!currentRange) {
            return false;
        }
        event.preventDefault();
        event.stopPropagation();
        options.focusViewport();
        options.stopRangeMove(false);
        options.setDragSelecting(false);
        options.setDragPointer(null);
        options.setFillDragging(true);
        options.setFillBaseRange({ ...currentRange });
        options.setFillPreviewRange({ ...currentRange });
        options.setFillPointer({ clientX: event.clientX, clientY: event.clientY });
        options.startInteractionAutoScroll();
        options.setLastAction("Fill handle active");
        return true;
    }
    return {
        onSelectionHandleMouseDown,
    };
}
