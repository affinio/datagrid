export function useDataGridHistoryActionRunner(options) {
    async function runHistoryAction(direction, trigger) {
        if (options.hasInlineEditor()) {
            options.commitInlineEdit();
        }
        options.closeContextMenu();
        if (direction === "undo" && !options.canUndo()) {
            options.setLastAction("Nothing to undo");
            return false;
        }
        if (direction === "redo" && !options.canRedo()) {
            options.setLastAction("Nothing to redo");
            return false;
        }
        try {
            const committedId = await options.runHistoryAction(direction);
            if (!committedId) {
                options.setLastAction(direction === "undo" ? "Nothing to undo" : "Nothing to redo");
                return false;
            }
            options.setLastAction(direction === "undo"
                ? `Undo ${committedId} (${trigger})`
                : `Redo ${committedId} (${trigger})`);
            return true;
        }
        catch (error) {
            options.onError?.(direction, error);
            options.setLastAction(direction === "undo" ? "Undo failed" : "Redo failed");
            return false;
        }
    }
    return {
        runHistoryAction,
    };
}
