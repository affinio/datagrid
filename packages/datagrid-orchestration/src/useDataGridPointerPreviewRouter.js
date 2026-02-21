export function useDataGridPointerPreviewRouter(options) {
    function applyFillPreviewFromPointer() {
        if (!options.isFillDragging()) {
            return;
        }
        const pointer = options.resolveFillPointer();
        const baseRange = options.resolveFillBaseRange();
        if (!pointer || !baseRange) {
            return;
        }
        const coord = options.resolveCellCoordFromPointer(pointer.clientX, pointer.clientY);
        if (!coord) {
            return;
        }
        const preview = options.buildExtendedRange(baseRange, coord);
        if (!preview) {
            return;
        }
        if (options.rangesEqual(options.resolveFillPreviewRange(), preview)) {
            return;
        }
        options.setFillPreviewRange(preview);
    }
    function applyRangeMovePreviewFromPointer() {
        if (!options.isRangeMoving()) {
            return;
        }
        const pointer = options.resolveRangeMovePointer();
        const baseRange = options.resolveRangeMoveBaseRange();
        const origin = options.resolveRangeMoveOrigin();
        if (!pointer || !baseRange || !origin) {
            return;
        }
        const coord = options.resolveCellCoordFromPointer(pointer.clientX, pointer.clientY);
        if (!coord) {
            return;
        }
        const rowDelta = coord.rowIndex - origin.rowIndex;
        const columnDelta = coord.columnIndex - origin.columnIndex;
        const preview = options.normalizeSelectionRange({
            startRow: baseRange.startRow + rowDelta,
            endRow: baseRange.endRow + rowDelta,
            startColumn: baseRange.startColumn + columnDelta,
            endColumn: baseRange.endColumn + columnDelta,
        });
        if (!preview || options.rangesEqual(options.resolveRangeMovePreviewRange(), preview)) {
            return;
        }
        options.setRangeMovePreviewRange(preview);
    }
    return {
        applyFillPreviewFromPointer,
        applyRangeMovePreviewFromPointer,
    };
}
