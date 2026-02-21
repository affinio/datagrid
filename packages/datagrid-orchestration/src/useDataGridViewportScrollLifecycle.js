export function useDataGridViewportScrollLifecycle(options) {
    const scrollUpdateMode = options.scrollUpdateMode ?? "sync";
    const requestFrame = options.requestAnimationFrame ?? (callback => window.requestAnimationFrame(callback));
    const cancelFrame = options.cancelAnimationFrame ?? (handle => window.cancelAnimationFrame(handle));
    let pendingTop = null;
    let pendingLeft = null;
    let pendingCloseContextMenu = false;
    let pendingCommitInlineEdit = false;
    let pendingFrame = null;
    function flushPendingScroll() {
        if (pendingCloseContextMenu) {
            pendingCloseContextMenu = false;
            if (options.isContextMenuVisible()) {
                options.closeContextMenu();
            }
        }
        if (pendingTop !== null) {
            const nextTop = pendingTop;
            pendingTop = null;
            if (nextTop !== options.resolveScrollTop()) {
                options.setScrollTop(nextTop);
            }
        }
        if (pendingLeft !== null) {
            const nextLeft = pendingLeft;
            pendingLeft = null;
            if (nextLeft !== options.resolveScrollLeft()) {
                options.setScrollLeft(nextLeft);
            }
        }
        if (pendingCommitInlineEdit) {
            pendingCommitInlineEdit = false;
            if (options.hasInlineEditor()) {
                options.commitInlineEdit();
            }
        }
    }
    function scheduleFlush() {
        if (pendingFrame !== null) {
            return;
        }
        pendingFrame = requestFrame(() => {
            pendingFrame = null;
            flushPendingScroll();
        });
    }
    function dispose() {
        if (pendingFrame !== null) {
            cancelFrame(pendingFrame);
            pendingFrame = null;
        }
        pendingTop = null;
        pendingLeft = null;
        pendingCloseContextMenu = false;
        pendingCommitInlineEdit = false;
    }
    function onViewportScroll(event) {
        const target = event.currentTarget;
        if (!target) {
            return;
        }
        const shouldCloseContextMenu = options.shouldCloseContextMenuOnScroll
            ? options.shouldCloseContextMenuOnScroll()
            : true;
        if (options.isContextMenuVisible() && shouldCloseContextMenu) {
            pendingCloseContextMenu = true;
        }
        pendingTop = target.scrollTop;
        pendingLeft = target.scrollLeft;
        if (options.hasInlineEditor()) {
            pendingCommitInlineEdit = true;
        }
        if (scrollUpdateMode === "raf") {
            scheduleFlush();
            return;
        }
        flushPendingScroll();
    }
    return {
        onViewportScroll,
        flushPendingScroll,
        dispose,
    };
}
