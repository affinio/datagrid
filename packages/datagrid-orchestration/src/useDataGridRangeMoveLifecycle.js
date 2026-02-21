export function useDataGridRangeMoveLifecycle(options) {
    function stopRangeMove(applyPreview) {
        if (applyPreview) {
            try {
                options.applyRangeMove();
            }
            catch (error) {
                options.onApplyRangeMoveError?.(error);
            }
        }
        options.setRangeMoving(false);
        options.clearRangeMovePointer();
        options.clearRangeMoveBaseRange();
        options.clearRangeMoveOrigin();
        options.clearRangeMovePreviewRange();
        options.stopAutoScrollFrameIfIdle();
    }
    return {
        stopRangeMove,
    };
}
