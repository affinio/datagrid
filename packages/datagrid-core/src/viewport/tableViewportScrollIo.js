import { createManagedResizeObserver } from "./tableViewportResizeAdapter";
import { applyViewportSyncTransforms } from "./scrollSync";
const runtimeGlobal = typeof window !== "undefined" ? window : globalThis;
const DRIFT_THRESHOLD = 0.75;
export function createTableViewportScrollIo(options) {
    const { hostEnvironment, scheduler, recordLayoutRead, recordSyncScroll, queueHeavyUpdate, flushSchedulers, getOnAfterScroll, onDetach, state, normalizeAndClampScroll = false, clampScrollTop: clampScrollTopFn, clampScrollLeft: clampScrollLeftFn, frameDurationMs, onResizeMetrics, onScrollMetrics, onScrollSyncFrame, resolveHeavyUpdateThresholds, getTimestamp, maxHeavyIdleMs, } = options;
    const resolvedFrameDuration = Number.isFinite(frameDurationMs) && frameDurationMs > 0 ? frameDurationMs : 16;
    const afterScrollIdleMs = Math.min(64, Math.max(24, Math.round(resolvedFrameDuration * 2)));
    const clampScrollTop = normalizeAndClampScroll && typeof clampScrollTopFn === "function" ? clampScrollTopFn : null;
    const clampScrollLeft = normalizeAndClampScroll && typeof clampScrollLeftFn === "function" ? clampScrollLeftFn : null;
    const resolveThresholds = typeof resolveHeavyUpdateThresholds === "function"
        ? resolveHeavyUpdateThresholds
        : () => ({ vertical: 0, horizontal: 0 });
    const resolveTimestamp = typeof getTimestamp === "function"
        ? getTimestamp
        : () => (typeof performance !== "undefined" && typeof performance.now === "function"
            ? performance.now()
            : Date.now());
    const heavyIdleLimit = Number.isFinite(maxHeavyIdleMs) && maxHeavyIdleMs >= 0
        ? maxHeavyIdleMs
        : resolvedFrameDuration * 4;
    let lastHeavyQueueTimestamp = 0;
    const syncAdapter = {
        getSyncTargets: () => state.getSyncTargets(),
        getAppliedState: () => state.getSyncState(),
    };
    function runViewportSync(scrollTop, scrollLeft) {
        const currentState = state.getSyncState();
        const nextState = {
            scrollTop,
            scrollLeft,
            pinnedOffsetLeft: currentState.pinnedOffsetLeft,
            pinnedOffsetRight: currentState.pinnedOffsetRight,
        };
        applyViewportSyncTransforms(syncAdapter, nextState);
        state.setLastAppliedScroll(scrollTop, scrollLeft);
        onScrollSyncFrame?.({ scrollTop, scrollLeft });
        correctScrollDrift();
    }
    function cancelScrollSyncTask() {
        const taskId = state.getScrollSyncTaskId();
        if (taskId !== null) {
            scheduler.cancel(taskId);
            state.setScrollSyncTaskId(null);
        }
    }
    // Schedules a single rAF pass that applies viewport transforms using the latest sampled scroll values.
    function scheduleScrollSync() {
        if (state.getScrollSyncTaskId() !== null) {
            return;
        }
        const taskId = scheduler.schedule(() => {
            state.setScrollSyncTaskId(null);
            const samples = state.getLastScrollSamples();
            runViewportSync(samples.top, samples.left);
            recordSyncScroll();
            const thresholds = resolveThresholds();
            const verticalThreshold = Math.max(0, thresholds.vertical);
            const horizontalThreshold = Math.max(0, thresholds.horizontal);
            const lastHeavy = state.getLastHeavyScroll();
            const deltaTop = Math.abs(samples.top - lastHeavy.top);
            const deltaLeft = Math.abs(samples.left - lastHeavy.left);
            const now = resolveTimestamp();
            const idleExceeded = heavyIdleLimit > 0 && now - lastHeavyQueueTimestamp >= heavyIdleLimit;
            const needsHeavyUpdate = state.isDriftCorrectionPending() ||
                state.isPendingHorizontalSettle() ||
                !Number.isFinite(lastHeavy.top) ||
                !Number.isFinite(lastHeavy.left) ||
                deltaTop > verticalThreshold ||
                deltaLeft > horizontalThreshold ||
                idleExceeded;
            if (needsHeavyUpdate) {
                const teleportVerticalThreshold = verticalThreshold > 0 ? verticalThreshold * 3 : 48;
                const teleportHorizontalThreshold = horizontalThreshold > 0 ? horizontalThreshold * 3 : 144;
                const teleportDetected = deltaTop >= teleportVerticalThreshold || deltaLeft >= teleportHorizontalThreshold;
                const baselineInvalid = !Number.isFinite(lastHeavy.top) || !Number.isFinite(lastHeavy.left);
                const forceHeavy = teleportDetected || baselineInvalid || state.isDriftCorrectionPending() || state.isPendingHorizontalSettle();
                queueHeavyUpdate(forceHeavy);
                lastHeavyQueueTimestamp = now;
            }
        }, { priority: "high" });
        if (taskId >= 0) {
            state.setScrollSyncTaskId(taskId);
        }
    }
    function cancelAfterScrollTask() {
        const taskId = state.getAfterScrollTaskId();
        if (taskId !== null) {
            scheduler.cancel(taskId);
            state.setAfterScrollTaskId(null);
        }
    }
    let afterScrollDebounceHandle = null;
    function cancelAfterScrollDebounce() {
        if (afterScrollDebounceHandle !== null) {
            runtimeGlobal.clearTimeout(afterScrollDebounceHandle);
            afterScrollDebounceHandle = null;
        }
    }
    function clearContainerListeners(container, resizeObserver) {
        if (container) {
            hostEnvironment.removeScrollListener(container, handleScroll);
        }
        if (!resizeObserver) {
            return;
        }
        resizeObserver.disconnect();
    }
    function resetState() {
        cancelScrollSyncTask();
        state.setAttached(false);
        state.setContainer(null);
        state.setHeader(null);
        state.setSyncTargets(null);
        state.setResizeObserver(null);
        state.clearLayoutMeasurement();
        state.resetCachedMeasurements();
        state.resetScrollSamples();
        state.setPendingScrollTop(null);
        state.setPendingScrollLeft(null);
        state.setPendingHorizontalSettle(false);
        state.setLastAppliedScroll(0, 0);
        state.setDriftCorrectionPending(false);
        state.setLastHeavyScroll(0, 0);
        cancelAfterScrollTask();
        cancelAfterScrollDebounce();
        lastHeavyQueueTimestamp = 0;
    }
    function isContainerFromEventFallback(event, container) {
        if (!container || !event)
            return false;
        if (event.target === container) {
            return true;
        }
        if (event.currentTarget === container) {
            return true;
        }
        const path = typeof event.composedPath === "function" ? event.composedPath() : null;
        if (!Array.isArray(path)) {
            return false;
        }
        return path.includes(container);
    }
    function normalizeScrollLeftFallback(target) {
        const raw = target.scrollLeft;
        if (!Number.isFinite(raw)) {
            return 0;
        }
        if (raw >= 0) {
            return raw;
        }
        const dirAttribute = target.dir || target.getAttribute("dir");
        const documentDir = target.ownerDocument?.dir;
        const direction = (dirAttribute || documentDir || "").toLowerCase();
        if (direction !== "rtl") {
            return raw;
        }
        const maxOffset = target.scrollWidth - target.clientWidth;
        if (!Number.isFinite(maxOffset)) {
            return 0;
        }
        const normalized = maxOffset + raw;
        return normalized >= 0 ? normalized : 0;
    }
    function measureContainerScroll(target) {
        let nextScrollTop = Number.isFinite(target.scrollTop) ? target.scrollTop : 0;
        let nextScrollLeft = hostEnvironment.normalizeScrollLeft
            ? hostEnvironment.normalizeScrollLeft(target)
            : normalizeScrollLeftFallback(target);
        if (clampScrollTop) {
            nextScrollTop = clampScrollTop(nextScrollTop);
        }
        if (clampScrollLeft) {
            nextScrollLeft = clampScrollLeft(nextScrollLeft);
        }
        return { scrollTop: nextScrollTop, scrollLeft: nextScrollLeft };
    }
    function correctScrollDrift() {
        const container = state.getContainer();
        if (!container) {
            state.setDriftCorrectionPending(false);
            return;
        }
        const real = measureContainerScroll(container);
        const applied = state.getLastAppliedScroll();
        const driftX = Math.abs(real.scrollLeft - applied.left);
        const driftY = Math.abs(real.scrollTop - applied.top);
        const driftExceeded = driftX > DRIFT_THRESHOLD || driftY > DRIFT_THRESHOLD;
        if (!driftExceeded) {
            state.setDriftCorrectionPending(false);
            return;
        }
        if (!state.isDriftCorrectionPending()) {
            state.setDriftCorrectionPending(true);
        }
        state.setLastScrollSamples(real.scrollTop, real.scrollLeft);
        state.setPendingScrollTop(real.scrollTop);
        state.setPendingScrollLeft(real.scrollLeft);
        scheduleScrollSync();
    }
    function detach() {
        const currentObserver = state.getResizeObserver();
        const containerRef = state.getContainer();
        const wasAttached = state.isAttached();
        clearContainerListeners(containerRef, currentObserver);
        resetState();
        if (wasAttached) {
            onDetach?.();
        }
    }
    function attach(container, header) {
        const currentContainer = state.getContainer();
        const currentHeader = state.getHeader();
        const wasAttached = state.isAttached();
        const previousSamples = state.getLastScrollSamples();
        if (currentContainer === container && currentHeader === header && wasAttached) {
            queueHeavyUpdate(true);
            return;
        }
        detach();
        state.setContainer(container);
        state.setHeader(header);
        if (!container) {
            return;
        }
        hostEnvironment.addScrollListener(container, handleScroll);
        state.setAttached(true);
        let initialScrollTop;
        let initialScrollLeft;
        const reuseSamples = wasAttached && currentContainer === container;
        if (reuseSamples) {
            initialScrollTop = previousSamples.top;
            initialScrollLeft = previousSamples.left;
        }
        else {
            recordLayoutRead();
            const measured = measureContainerScroll(container);
            recordLayoutRead();
            initialScrollTop = measured.scrollTop;
            initialScrollLeft = measured.scrollLeft;
        }
        if (clampScrollTop) {
            initialScrollTop = clampScrollTop(initialScrollTop);
        }
        if (clampScrollLeft) {
            initialScrollLeft = clampScrollLeft(initialScrollLeft);
        }
        state.setPendingScrollTop(initialScrollTop);
        state.setPendingScrollLeft(initialScrollLeft);
        state.setLastScrollSamples(initialScrollTop, initialScrollLeft);
        runViewportSync(initialScrollTop, initialScrollLeft);
        onScrollMetrics?.({ scrollTop: initialScrollTop, scrollLeft: initialScrollLeft });
        const resizeObserver = hostEnvironment.createResizeObserver
            ? createManagedResizeObserver(hostEnvironment, () => {
                onResizeMetrics?.();
                queueHeavyUpdate(true);
            })
            : null;
        if (resizeObserver) {
            resizeObserver.observe(container);
            if (header) {
                resizeObserver.observe(header);
            }
        }
        state.setResizeObserver(resizeObserver);
        queueHeavyUpdate(true);
        flushSchedulers();
    }
    // Scroll event handler only samples/clamps native scroll values and defers work to rAF.
    function handleScroll(event) {
        const container = state.getContainer();
        if (!container)
            return;
        const matchesContainer = hostEnvironment.isEventFromContainer
            ? hostEnvironment.isEventFromContainer(event, container)
            : isContainerFromEventFallback(event, container);
        if (!matchesContainer) {
            return;
        }
        const measured = measureContainerScroll(container);
        state.setPendingScrollTop(measured.scrollTop);
        state.setPendingScrollLeft(measured.scrollLeft);
        state.setLastScrollSamples(measured.scrollTop, measured.scrollLeft);
        onScrollMetrics?.({ scrollTop: measured.scrollTop, scrollLeft: measured.scrollLeft });
        scheduleScrollSync();
    }
    function scheduleAfterScroll() {
        const onAfterScroll = getOnAfterScroll();
        if (!onAfterScroll && !state.isPendingHorizontalSettle())
            return;
        cancelAfterScrollTask();
        cancelAfterScrollDebounce();
        afterScrollDebounceHandle = runtimeGlobal.setTimeout(() => {
            afterScrollDebounceHandle = null;
            const taskId = scheduler.schedule(() => {
                state.setAfterScrollTaskId(null);
                const shouldSettle = state.isPendingHorizontalSettle() && state.isAttached();
                state.setPendingHorizontalSettle(false);
                if (shouldSettle) {
                    queueHeavyUpdate(true);
                }
                onAfterScroll?.();
                state.setDriftCorrectionPending(false);
            }, { priority: "low" });
            state.setAfterScrollTaskId(taskId);
        }, afterScrollIdleMs);
    }
    function dispose() {
        cancelAfterScrollTask();
        cancelAfterScrollDebounce();
        detach();
    }
    return {
        attach,
        detach,
        handleScroll,
        scheduleAfterScroll,
        cancelAfterScrollTask,
        dispose,
    };
}
