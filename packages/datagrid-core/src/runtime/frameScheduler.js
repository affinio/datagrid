const globalObject = typeof window !== "undefined" ? window : globalThis;
function defaultNow() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
}
function requestFrame(callback) {
    if (typeof globalObject.requestAnimationFrame === "function") {
        return globalObject.requestAnimationFrame(callback);
    }
    return globalObject.setTimeout(() => callback(defaultNow()), 16);
}
function cancelFrame(handle) {
    if (typeof globalObject.cancelAnimationFrame === "function" && typeof handle === "number") {
        globalObject.cancelAnimationFrame(handle);
        return;
    }
    globalObject.clearTimeout(handle);
}
export function createFrameScheduler(hooks = {}) {
    let rafHandle = null;
    let pending = false;
    let disposed = false;
    function ensureFrame() {
        if (disposed)
            return;
        if (!pending)
            return;
        if (rafHandle !== null)
            return;
        rafHandle = requestFrame(processFrame);
    }
    function processFrame(timestamp) {
        rafHandle = null;
        const needsReschedule = pending;
        pending = false;
        hooks.onBeforeFrame?.(timestamp);
        hooks.onRead?.(timestamp);
        hooks.onCompute?.(timestamp);
        hooks.onCommit?.(timestamp);
        if (!disposed && (pending || needsReschedule)) {
            ensureFrame();
        }
    }
    function invalidate() {
        if (disposed)
            return;
        pending = true;
        ensureFrame();
    }
    function cancel() {
        if (rafHandle !== null) {
            cancelFrame(rafHandle);
            rafHandle = null;
        }
        pending = false;
    }
    function flush() {
        if (!pending)
            return;
        if (rafHandle !== null) {
            cancelFrame(rafHandle);
            rafHandle = null;
        }
        processFrame(defaultNow());
    }
    function dispose() {
        if (disposed)
            return;
        disposed = true;
        cancel();
    }
    return {
        invalidate,
        cancel,
        flush,
        dispose,
    };
}
