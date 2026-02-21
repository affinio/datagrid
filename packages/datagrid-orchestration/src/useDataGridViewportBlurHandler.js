export function useDataGridViewportBlurHandler(options) {
    function finalizeBlurCleanup() {
        options.stopDragSelection();
        options.stopFillSelection(false);
        options.stopRangeMove(false);
        options.stopColumnResize();
        options.closeContextMenu();
        if (options.hasInlineEditor()) {
            options.commitInlineEdit();
        }
    }
    function handleViewportBlur(event) {
        const viewport = options.resolveViewportElement();
        const nextFocused = event.relatedTarget;
        if (viewport && nextFocused && viewport.contains(nextFocused)) {
            return false;
        }
        const menu = options.resolveContextMenuElement();
        if (nextFocused && menu?.contains(nextFocused)) {
            return false;
        }
        if (nextFocused && nextFocused instanceof HTMLElement) {
            if (nextFocused.closest("[data-datagrid-menu-action],[data-datagrid-copy-menu],.datagrid-sugar-context")) {
                return false;
            }
        }
        if (!nextFocused && viewport) {
            const runDeferred = () => {
                const active = viewport.ownerDocument?.activeElement;
                if (active && viewport.contains(active)) {
                    return;
                }
                const menuElement = options.resolveContextMenuElement();
                if (active && menuElement?.contains(active)) {
                    return;
                }
                if (active && active instanceof HTMLElement) {
                    if (active.closest("[data-datagrid-menu-action],[data-datagrid-copy-menu],.datagrid-sugar-context")) {
                        return;
                    }
                }
                finalizeBlurCleanup();
            };
            const view = viewport.ownerDocument?.defaultView;
            if (typeof view?.requestAnimationFrame === "function") {
                view.requestAnimationFrame(() => view.requestAnimationFrame(runDeferred));
            }
            else if (typeof view?.setTimeout === "function") {
                view.setTimeout(runDeferred, 0);
            }
            else {
                setTimeout(runDeferred, 0);
            }
            return true;
        }
        finalizeBlurCleanup();
        return true;
    }
    return {
        handleViewportBlur,
    };
}
