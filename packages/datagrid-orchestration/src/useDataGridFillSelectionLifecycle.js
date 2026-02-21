export function useDataGridFillSelectionLifecycle(options) {
    function stopFillSelection(applyPreview) {
        if (applyPreview) {
            options.applyFillPreview();
        }
        options.setFillDragging(false);
        options.clearFillPointer();
        options.clearFillBaseRange();
        options.clearFillPreviewRange();
        options.stopAutoScrollFrameIfIdle();
    }
    return {
        stopFillSelection,
    };
}
