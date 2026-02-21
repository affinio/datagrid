export function useDataGridDragSelectionLifecycle(options) {
    function stopDragSelection() {
        options.setDragSelecting(false);
        options.clearDragPointer();
        options.clearLastDragCoord();
        options.stopAutoScrollFrameIfIdle();
    }
    return {
        stopDragSelection,
    };
}
