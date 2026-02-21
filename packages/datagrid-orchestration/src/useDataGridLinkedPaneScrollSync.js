export function useDataGridLinkedPaneScrollSync(options) {
    const mode = options.mode ?? "direct-transform";
    const cssVarName = options.cssVarName ?? "--ui-affino-linked-scroll-top";
    const clearOnReset = options.clearOnReset ?? true;
    const requestFrame = options.requestAnimationFrame ?? (callback => window.requestAnimationFrame(callback));
    const cancelFrame = options.cancelAnimationFrame ?? (handle => window.cancelAnimationFrame(handle));
    let syncFrame = null;
    let lastAppliedScrollTop = Number.NaN;
    let pendingScrollTop = null;
    function normalizeScrollTop(value) {
        return Math.max(0, Number.isFinite(value) ? value : 0);
    }
    function resolvePaneElements() {
        return options.resolvePaneElements?.() ?? [];
    }
    function applyDirectTransform(scrollTop) {
        const transform = `translate3d(0, ${-scrollTop}px, 0)`;
        resolvePaneElements().forEach((element) => {
            if (!element) {
                return;
            }
            if (element.style.transform !== transform) {
                element.style.transform = transform;
            }
        });
    }
    function applyCssVar(scrollTop) {
        const host = options.resolveCssVarHost?.();
        if (!host) {
            return;
        }
        const value = `${-scrollTop}px`;
        if (host.style.getPropertyValue(cssVarName) !== value) {
            host.style.setProperty(cssVarName, value);
        }
    }
    function clearAppliedState() {
        if (mode === "css-var") {
            options.resolveCssVarHost?.()?.style.removeProperty(cssVarName);
            return;
        }
        resolvePaneElements().forEach((element) => {
            element?.style.removeProperty("transform");
        });
    }
    function apply(scrollTop) {
        const normalizedTop = normalizeScrollTop(scrollTop);
        if (normalizedTop === lastAppliedScrollTop) {
            return normalizedTop;
        }
        lastAppliedScrollTop = normalizedTop;
        if (mode === "css-var") {
            applyCssVar(normalizedTop);
        }
        else {
            applyDirectTransform(normalizedTop);
        }
        return normalizedTop;
    }
    function syncNow(scrollTop = options.resolveSourceScrollTop()) {
        return apply(scrollTop);
    }
    function flushPendingSourceScroll() {
        if (pendingScrollTop === null) {
            return;
        }
        const nextTop = pendingScrollTop;
        pendingScrollTop = null;
        apply(nextTop);
    }
    function onSourceScroll(scrollTop = options.resolveSourceScrollTop()) {
        pendingScrollTop = normalizeScrollTop(scrollTop);
        if (syncFrame !== null) {
            return;
        }
        syncFrame = requestFrame(() => {
            syncFrame = null;
            flushPendingSourceScroll();
        });
    }
    function runSyncLoop() {
        syncFrame = null;
        flushPendingSourceScroll();
        const sourceTop = normalizeScrollTop(options.resolveSourceScrollTop());
        apply(sourceTop);
        const shouldContinue = pendingScrollTop !== null || sourceTop !== lastAppliedScrollTop;
        if (shouldContinue) {
            scheduleSyncLoop();
        }
    }
    function scheduleSyncLoop() {
        if (syncFrame !== null) {
            return;
        }
        syncFrame = requestFrame(runSyncLoop);
    }
    function cancelSyncLoop() {
        if (syncFrame === null) {
            return;
        }
        cancelFrame(syncFrame);
        syncFrame = null;
    }
    function reset() {
        cancelSyncLoop();
        lastAppliedScrollTop = Number.NaN;
        if (clearOnReset) {
            clearAppliedState();
        }
    }
    return {
        syncNow,
        onSourceScroll,
        scheduleSyncLoop,
        cancelSyncLoop,
        isSyncLoopScheduled: () => syncFrame !== null,
        getLastAppliedScrollTop: () => lastAppliedScrollTop,
        reset,
    };
}
