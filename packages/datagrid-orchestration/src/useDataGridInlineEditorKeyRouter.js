export function useDataGridInlineEditorKeyRouter(options) {
    function dispatchEditorKeyDown(event, rowId, columnKey) {
        if (!options.isEditableColumn(columnKey)) {
            return false;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            options.cancelInlineEdit();
            return true;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            options.commitInlineEdit();
            return true;
        }
        if (event.key === "Tab") {
            event.preventDefault();
            const direction = event.shiftKey ? -1 : 1;
            const target = options.resolveNextEditableTarget(rowId, columnKey, direction);
            options.commitInlineEdit();
            if (target) {
                options.focusInlineEditorTarget(target);
            }
            return true;
        }
        return false;
    }
    return {
        dispatchEditorKeyDown,
    };
}
