export function useDataGridHeaderInteractionRouter(options) {
    const contextMenuBlockedColumnKey = options.contextMenuBlockedColumnKey ?? "select";
    function onHeaderCellClick(columnKey, event) {
        if (!options.isSortableColumn(columnKey)) {
            return;
        }
        options.applySortFromHeader(columnKey, event.shiftKey);
    }
    function onHeaderCellKeyDown(columnKey, event) {
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
            if (columnKey === contextMenuBlockedColumnKey) {
                return;
            }
            event.preventDefault();
            const target = event.currentTarget;
            const rect = target?.getBoundingClientRect();
            const x = rect ? rect.left + Math.min(rect.width - 8, Math.max(8, rect.width * 0.5)) : 24;
            const y = rect ? rect.bottom - 6 : 24;
            options.openHeaderContextMenu(x, y, columnKey);
            return;
        }
        if (!options.isSortableColumn(columnKey)) {
            return;
        }
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }
        event.preventDefault();
        options.applySortFromHeader(columnKey, event.shiftKey);
    }
    return {
        onHeaderCellClick,
        onHeaderCellKeyDown,
    };
}
