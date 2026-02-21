const AXIS_LOCK_RATIO = 1.1;
export function normalizeDataGridWheelDelta(delta, deltaMode, pageSize) {
    if (!Number.isFinite(delta))
        return 0;
    if (deltaMode === 1)
        return delta * 16;
    if (deltaMode === 2)
        return delta * Math.max(1, pageSize);
    return delta;
}
export function resolveDataGridWheelAxisPolicy(deltaX, deltaY, mode) {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (absX === 0 && absY === 0) {
        return { applyX: false, applyY: false };
    }
    if (mode === "off") {
        return { applyX: absX > 0, applyY: absY > 0 };
    }
    let dominantAxis;
    if (absX === 0) {
        dominantAxis = "y";
    }
    else if (absY === 0) {
        dominantAxis = "x";
    }
    else if (absX > absY * AXIS_LOCK_RATIO) {
        dominantAxis = "x";
    }
    else if (absY > absX * AXIS_LOCK_RATIO) {
        dominantAxis = "y";
    }
    else if (mode === "horizontal-preferred") {
        dominantAxis = "x";
    }
    else {
        dominantAxis = "y";
    }
    return {
        applyX: dominantAxis === "x" && absX > 0,
        applyY: dominantAxis === "y" && absY > 0,
    };
}
export function resolveDataGridWheelPropagationDecision(result, mode) {
    if (mode === "retain") {
        return false;
    }
    if (mode === "release-when-unconsumed") {
        return !result.handled;
    }
    return !result.handled && (result.atBoundaryX || result.atBoundaryY);
}
export function useDataGridManagedWheelScroll(options) {
    const resolveWheelMode = options.resolveWheelMode ?? (() => "managed");
    const resolveAxisLock = options.resolveWheelAxisLockMode ?? (() => "dominant");
    const resolvePreventDefaultWhenHandled = options.resolvePreventDefaultWhenHandled
        ?? options.resolvePreventDefaultWhenConsumed
        ?? (() => true);
    const resolveStopImmediatePropagation = options.resolveStopImmediatePropagation ?? (() => false);
    const resolveWheelPropagationMode = options.resolveWheelPropagationMode ?? (() => "retain");
    const resolveMinDeltaToApply = options.resolveMinDeltaToApply ?? (() => 0);
    const isLinkedScrollSyncLoopScheduled = options.isLinkedScrollSyncLoopScheduled ?? (() => false);
    let pendingDeltaX = 0;
    let pendingDeltaY = 0;
    function reset() {
        pendingDeltaX = 0;
        pendingDeltaY = 0;
    }
    function consumeSmoothedDelta(rawDelta, axis) {
        const minDelta = Math.max(0, Number.isFinite(resolveMinDeltaToApply()) ? resolveMinDeltaToApply() : 0);
        const pending = axis === "x" ? pendingDeltaX : pendingDeltaY;
        const hasSignFlip = pending !== 0 && rawDelta !== 0 && Math.sign(pending) !== Math.sign(rawDelta);
        const basePending = hasSignFlip ? 0 : pending;
        const merged = basePending + rawDelta;
        if (minDelta <= 0 || Math.abs(merged) >= minDelta) {
            if (axis === "x") {
                pendingDeltaX = 0;
            }
            else {
                pendingDeltaY = 0;
            }
            return merged;
        }
        if (axis === "x") {
            pendingDeltaX = merged;
        }
        else {
            pendingDeltaY = merged;
        }
        return 0;
    }
    function resetPendingDelta(axis) {
        if (axis === "x") {
            pendingDeltaX = 0;
            return;
        }
        pendingDeltaY = 0;
    }
    function applyWheelToViewports(event) {
        if (resolveWheelMode() === "native") {
            reset();
            return {
                handled: false,
                handledX: false,
                handledY: false,
                consumed: false,
                consumedX: false,
                consumedY: false,
                atBoundaryX: false,
                atBoundaryY: false,
            };
        }
        const bodyViewport = options.resolveBodyViewport();
        if (!bodyViewport) {
            reset();
            return {
                handled: false,
                handledX: false,
                handledY: false,
                consumed: false,
                consumedX: false,
                consumedY: false,
                atBoundaryX: false,
                atBoundaryY: false,
            };
        }
        let consumedX = false;
        let consumedY = false;
        let handledX = false;
        let handledY = false;
        let atBoundaryX = false;
        let atBoundaryY = false;
        const mainViewport = options.resolveMainViewport?.() ?? null;
        const pageSizeY = event.deltaMode === 2
            ? (options.resolveWheelPageSizeY?.() ?? bodyViewport.clientHeight)
            : 0;
        const pageSizeX = event.deltaMode === 2
            ? (options.resolveWheelPageSizeX?.() ?? mainViewport?.clientWidth ?? 0)
            : 0;
        const deltaY = normalizeDataGridWheelDelta(event.deltaY, event.deltaMode, pageSizeY);
        const deltaX = normalizeDataGridWheelDelta(event.deltaX, event.deltaMode, pageSizeX);
        const { applyX, applyY } = resolveDataGridWheelAxisPolicy(deltaX, deltaY, resolveAxisLock());
        if (!applyY) {
            resetPendingDelta("y");
        }
        if (!applyX) {
            resetPendingDelta("x");
        }
        if (applyY) {
            const effectiveDeltaY = consumeSmoothedDelta(deltaY, "y");
            const maxTop = Math.max(0, bodyViewport.scrollHeight - bodyViewport.clientHeight);
            const currentTop = bodyViewport.scrollTop;
            if (deltaY < 0 && currentTop <= 0) {
                atBoundaryY = true;
            }
            else if (deltaY > 0 && currentTop >= maxTop) {
                atBoundaryY = true;
            }
            const nextTop = Math.max(0, Math.min(maxTop, currentTop + effectiveDeltaY));
            if (nextTop !== currentTop) {
                options.setHandledScrollTop(nextTop);
                options.syncLinkedScroll?.(nextTop);
                if (!isLinkedScrollSyncLoopScheduled()) {
                    options.scheduleLinkedScrollSyncLoop?.();
                }
                consumedY = true;
                handledY = true;
            }
            else if (deltaY !== 0 && !atBoundaryY) {
                handledY = true;
            }
        }
        if (applyX && mainViewport) {
            const effectiveDeltaX = consumeSmoothedDelta(deltaX, "x");
            const maxLeft = Math.max(0, mainViewport.scrollWidth - mainViewport.clientWidth);
            const currentLeft = mainViewport.scrollLeft;
            if (deltaX < 0 && currentLeft <= 0) {
                atBoundaryX = true;
            }
            else if (deltaX > 0 && currentLeft >= maxLeft) {
                atBoundaryX = true;
            }
            const nextLeft = Math.max(0, Math.min(maxLeft, currentLeft + effectiveDeltaX));
            if (nextLeft !== currentLeft) {
                options.setHandledScrollLeft?.(nextLeft);
                consumedX = true;
                handledX = true;
            }
            else if (deltaX !== 0 && !atBoundaryX) {
                handledX = true;
            }
        }
        const handled = handledX || handledY;
        const consumed = consumedX || consumedY;
        if (consumed) {
            options.onWheelConsumed?.();
        }
        return {
            handled,
            handledX,
            handledY,
            consumed,
            consumedX,
            consumedY,
            atBoundaryX,
            atBoundaryY,
        };
    }
    function handleWheelCommon(event) {
        const result = applyWheelToViewports(event);
        const shouldPropagateByMode = resolveDataGridWheelPropagationDecision(result, resolveWheelPropagationMode());
        const shouldPropagateByOverride = options.resolveShouldPropagateWheelEvent?.(result) ?? false;
        const shouldPropagate = shouldPropagateByMode || shouldPropagateByOverride;
        if (result.handled && resolvePreventDefaultWhenHandled() && !shouldPropagate) {
            event.preventDefault();
            if (resolveStopImmediatePropagation() && typeof event.stopImmediatePropagation === "function") {
                event.stopImmediatePropagation();
            }
            else {
                event.stopPropagation();
            }
        }
    }
    return {
        applyWheelToViewports,
        onLinkedViewportWheel: handleWheelCommon,
        onBodyViewportWheel: handleWheelCommon,
        reset,
    };
}
