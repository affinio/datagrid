export function useDataGridGlobalMouseDownContextMenuCloser(options) {
    function dispatchGlobalMouseDown(event) {
        if (!options.isContextMenuVisible()) {
            return false;
        }
        const target = event.target;
        const menu = options.resolveContextMenuElement();
        if (target && menu?.contains(target)) {
            return false;
        }
        options.closeContextMenu();
        return true;
    }
    return {
        dispatchGlobalMouseDown,
    };
}
