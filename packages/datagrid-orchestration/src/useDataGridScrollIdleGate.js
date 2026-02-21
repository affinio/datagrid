const DEFAULT_IDLE_DELAY_MS = 80;
export function useDataGridScrollIdleGate(options = {}) {
    const resolveIdleDelayMs = options.resolveIdleDelayMs ?? (() => DEFAULT_IDLE_DELAY_MS);
    const scheduleTimeout = options.setTimeout ?? ((callback, delay) => globalThis.setTimeout(callback, delay));
    const clearScheduledTimeout = options.clearTimeout ?? (handle => globalThis.clearTimeout(handle));
    let active = false;
    let idleTimer = null;
    let flushingDeferredCallbacks = false;
    const deferredCallbacks = [];
    function normalizeDelayMs() {
        const raw = resolveIdleDelayMs();
        if (!Number.isFinite(raw)) {
            return DEFAULT_IDLE_DELAY_MS;
        }
        return Math.max(0, Math.trunc(raw));
    }
    function flushDeferredCallbacks() {
        while (!active && deferredCallbacks.length > 0) {
            const callbacks = deferredCallbacks.splice(0, deferredCallbacks.length);
            flushingDeferredCallbacks = true;
            try {
                callbacks.forEach(callback => callback());
            }
            finally {
                flushingDeferredCallbacks = false;
            }
        }
    }
    function clearIdleTimer() {
        if (idleTimer === null) {
            return;
        }
        clearScheduledTimeout(idleTimer);
        idleTimer = null;
    }
    function markScrollActivity() {
        active = true;
        clearIdleTimer();
        idleTimer = scheduleTimeout(() => {
            idleTimer = null;
            active = false;
            flushDeferredCallbacks();
        }, normalizeDelayMs());
    }
    function runWhenScrollIdle(callback) {
        if (!active && !flushingDeferredCallbacks) {
            callback();
            return;
        }
        deferredCallbacks.push(callback);
    }
    function dispose() {
        clearIdleTimer();
        active = false;
        flushingDeferredCallbacks = false;
        deferredCallbacks.splice(0, deferredCallbacks.length);
    }
    return {
        markScrollActivity,
        isScrollActive: () => active,
        runWhenScrollIdle,
        dispose,
    };
}
