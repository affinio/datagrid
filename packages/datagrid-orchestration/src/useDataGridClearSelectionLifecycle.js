export function useDataGridClearSelectionLifecycle(options) {
    function clearCellSelection() {
        options.setCellAnchor(null);
        options.setCellFocus(null);
        options.setActiveCell(null);
        options.setDragSelecting(false);
        options.setFillDragging(false);
        options.setDragPointer(null);
        options.setFillPointer(null);
        options.setFillBaseRange(null);
        options.setFillPreviewRange(null);
        options.clearLastDragCoord();
        options.closeContextMenu();
        options.stopRangeMove(false);
        options.stopColumnResize();
        options.stopAutoScrollFrameIfIdle();
    }
    return {
        clearCellSelection,
    };
}
