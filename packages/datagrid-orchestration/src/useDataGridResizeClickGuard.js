export function useDataGridResizeClickGuard(options = {}) {
    const guardDurationMs = Math.max(0, Math.trunc(options.guardDurationMs ?? 140));
    const resolveNow = options.resolveNow ?? (() => Date.now());
    const resolveDocument = options.resolveDocument ?? (() => (typeof document === "undefined" ? null : document));
    const setTimeoutFn = options.setTimeoutFn ?? ((handler, timeoutMs) => setTimeout(handler, timeoutMs));
    const clearTimeoutFn = options.clearTimeoutFn ?? (timer => clearTimeout(timer));
    let resizeActive = false;
    let suppressUntil = 0;
    let suppressResetTimer = null;
    let delayedReleaseTimer = null;
    let pointerUpListener = null;
    let mouseUpListener = null;
    function clearSuppressResetTimer() {
        if (suppressResetTimer === null) {
            return;
        }
        clearTimeoutFn(suppressResetTimer);
        suppressResetTimer = null;
    }
    function clearDelayedReleaseTimer() {
        if (delayedReleaseTimer === null) {
            return;
        }
        clearTimeoutFn(delayedReleaseTimer);
        delayedReleaseTimer = null;
    }
    function detachReleaseListeners() {
        const doc = resolveDocument();
        if (!doc) {
            pointerUpListener = null;
            mouseUpListener = null;
            return;
        }
        if (pointerUpListener) {
            doc.removeEventListener("pointerup", pointerUpListener, true);
            pointerUpListener = null;
        }
        if (mouseUpListener) {
            doc.removeEventListener("mouseup", mouseUpListener, true);
            mouseUpListener = null;
        }
    }
    function releaseResizeGuard() {
        resizeActive = false;
        suppressUntil = resolveNow() + guardDurationMs;
        clearSuppressResetTimer();
        suppressResetTimer = setTimeoutFn(() => {
            suppressUntil = 0;
            suppressResetTimer = null;
        }, guardDurationMs);
    }
    function armResizeGuard() {
        resizeActive = true;
        suppressUntil = Number.POSITIVE_INFINITY;
        clearDelayedReleaseTimer();
        clearSuppressResetTimer();
        detachReleaseListeners();
        const doc = resolveDocument();
        if (!doc) {
            return;
        }
        const scheduleRelease = () => {
            detachReleaseListeners();
            clearDelayedReleaseTimer();
            delayedReleaseTimer = setTimeoutFn(() => {
                delayedReleaseTimer = null;
                releaseResizeGuard();
            }, 0);
        };
        pointerUpListener = () => {
            scheduleRelease();
        };
        mouseUpListener = () => {
            scheduleRelease();
        };
        doc.addEventListener("pointerup", pointerUpListener, true);
        doc.addEventListener("mouseup", mouseUpListener, true);
    }
    function shouldBlockClick() {
        if (resizeActive) {
            return true;
        }
        return resolveNow() <= suppressUntil;
    }
    function onHeaderClickCapture(event) {
        if (!shouldBlockClick()) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }
    function dispose() {
        detachReleaseListeners();
        clearDelayedReleaseTimer();
        clearSuppressResetTimer();
        resizeActive = false;
        suppressUntil = 0;
    }
    return {
        armResizeGuard,
        releaseResizeGuard,
        isResizeActive: () => resizeActive,
        shouldBlockClick,
        onHeaderClickCapture,
        dispose,
    };
}
