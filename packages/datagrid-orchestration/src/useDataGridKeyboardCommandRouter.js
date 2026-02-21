function isPrimaryModifier(event) {
    return event.metaKey || event.ctrlKey;
}
function prevent(event) {
    event.preventDefault();
}
function isMenuNavigationKey(event) {
    return (event.key.startsWith("Arrow") ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageUp" ||
        event.key === "PageDown" ||
        event.key === "Tab" ||
        event.key === "Enter" ||
        event.key === " ");
}
export function useDataGridKeyboardCommandRouter(options) {
    function dispatchKeyboardCommands(event) {
        const key = event.key.toLowerCase();
        const primaryModifierPressed = isPrimaryModifier(event);
        if (primaryModifierPressed && !event.altKey && key === "z") {
            prevent(event);
            if (event.shiftKey) {
                void options.runHistoryAction("redo", "keyboard");
                return true;
            }
            void options.runHistoryAction("undo", "keyboard");
            return true;
        }
        if (primaryModifierPressed && !event.altKey && !event.shiftKey && key === "y") {
            prevent(event);
            void options.runHistoryAction("redo", "keyboard");
            return true;
        }
        if (options.isRangeMoving()) {
            prevent(event);
            if (event.key === "Escape") {
                options.stopRangeMove(false);
                options.setLastAction("Move canceled");
            }
            return true;
        }
        if (options.isContextMenuVisible()) {
            if (event.key === "Escape") {
                prevent(event);
                options.closeContextMenu();
                options.focusViewport();
                return true;
            }
            if (isMenuNavigationKey(event)) {
                prevent(event);
                return true;
            }
            return true;
        }
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
            prevent(event);
            options.openContextMenuFromCurrentCell();
            return true;
        }
        if (primaryModifierPressed && !event.altKey && key === "c") {
            prevent(event);
            void options.copySelection("keyboard");
            return true;
        }
        if (primaryModifierPressed && !event.altKey && key === "v") {
            prevent(event);
            void options.pasteSelection("keyboard");
            return true;
        }
        if (primaryModifierPressed && !event.altKey && key === "x") {
            prevent(event);
            void options.cutSelection("keyboard");
            return true;
        }
        return false;
    }
    return {
        dispatchKeyboardCommands,
    };
}
