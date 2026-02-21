export function useDataGridContextMenuActionRouter(options) {
    async function runContextMenuAction(action) {
        const context = options.resolveContextMenuState();
        if (context.zone === "header") {
            if (!context.columnKey) {
                options.closeContextMenu();
                return false;
            }
            return options.runHeaderContextAction(action, context.columnKey);
        }
        if (action === "copy") {
            return options.copySelection("context-menu");
        }
        if (action === "paste") {
            return options.pasteSelection("context-menu");
        }
        if (action === "cut") {
            return options.cutSelection("context-menu");
        }
        if (action === "clear") {
            return options.clearCurrentSelection("context-menu");
        }
        options.closeContextMenu();
        return false;
    }
    return {
        runContextMenuAction,
    };
}
