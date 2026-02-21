export function useDataGridEnumTrigger(options) {
    function shouldShowEnumTrigger(row, columnKey) {
        if (!options.isEnumColumn(columnKey)) {
            return false;
        }
        if (options.isInlineEditorOpen() || options.isDragSelecting() || options.isFillDragging()) {
            return false;
        }
        return options.isActiveCell(row, columnKey);
    }
    function onEnumTriggerMouseDown(row, columnKey, event) {
        if (!options.isEnumColumn(columnKey)) {
            return false;
        }
        event.preventDefault();
        event.stopPropagation();
        const coord = options.resolveCellCoord(row, columnKey);
        if (coord) {
            options.applyCellSelection(coord, false);
        }
        options.beginInlineEdit(options.resolveRowData(row), columnKey, "select", true);
        return true;
    }
    return {
        shouldShowEnumTrigger,
        onEnumTriggerMouseDown,
    };
}
