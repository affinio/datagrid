export function useDataGridRowSelectionInputHandlers(options) {
    function onSelectAllChange(event) {
        options.toggleSelectAllVisible(event.target.checked);
    }
    function onRowSelectChange(rowId, event) {
        options.toggleRowSelection(rowId, event.target.checked);
    }
    return {
        onSelectAllChange,
        onRowSelectChange,
    };
}
