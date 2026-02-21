export function useDataGridHeaderContextActions(options) {
    function runHeaderContextAction(action, columnKey) {
        if (!options.isSortableColumn(columnKey) && action !== "auto-size") {
            return false;
        }
        if (action === "sort-asc") {
            options.applyExplicitSort(columnKey, "asc");
            options.setLastAction(`Sorted ${columnKey} asc`);
            options.closeContextMenu();
            return true;
        }
        if (action === "sort-desc") {
            options.applyExplicitSort(columnKey, "desc");
            options.setLastAction(`Sorted ${columnKey} desc`);
            options.closeContextMenu();
            return true;
        }
        if (action === "sort-clear") {
            options.applyExplicitSort(columnKey, null);
            options.setLastAction(`Sort cleared for ${columnKey}`);
            options.closeContextMenu();
            return true;
        }
        if (action === "filter") {
            options.openColumnFilter(columnKey);
            options.closeContextMenu();
            return true;
        }
        if (action === "auto-size") {
            const nextWidth = options.estimateColumnAutoWidth(columnKey);
            options.setColumnWidth(columnKey, nextWidth);
            options.setLastAction(`Auto-sized ${columnKey} to ${nextWidth}px`);
            options.closeContextMenu();
            return true;
        }
        return false;
    }
    return {
        runHeaderContextAction,
    };
}
