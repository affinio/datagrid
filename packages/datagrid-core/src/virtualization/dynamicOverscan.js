const DEFAULT_FRAME_DURATION_MS = 16.7;
const DEFAULT_MIN_SAMPLE_MS = 8;
const DEFAULT_TELEPORT_MULTIPLIER = 2.5;
const DEFAULT_BLEND_WINDOW_MS = 120;
function clamp(value, min, max) {
    if (Number.isNaN(value))
        return min;
    if (value < min)
        return min;
    if (value > max)
        return max;
    return value;
}
function createInitialState(minOverscan, timestamp = 0, overscanOverride) {
    const normalizedMin = Math.max(0, minOverscan);
    const normalizedOverscan = typeof overscanOverride === "number" ? Math.max(0, overscanOverride) : normalizedMin;
    return {
        smoothedOverscan: normalizedMin,
        smoothedVelocity: 0,
        lastTimestamp: timestamp,
        lastOverscan: normalizedOverscan,
    };
}
export function createVerticalOverscanController(config) {
    const velocityRatio = config.velocityRatio ?? 0.85;
    const viewportRatio = config.viewportRatio ?? 0.55;
    const decay = config.decay ?? 0.58;
    const maxViewportMultiplier = config.maxViewportMultiplier ?? 3;
    const teleportMultiplier = config.teleportMultiplier ?? DEFAULT_TELEPORT_MULTIPLIER;
    const frameDuration = config.frameDurationMs ?? DEFAULT_FRAME_DURATION_MS;
    const minSampleMs = config.minSampleMs ?? DEFAULT_MIN_SAMPLE_MS;
    const blendWindowMs = config.blendWindowMs ?? DEFAULT_BLEND_WINDOW_MS;
    const minOverscan = Math.max(0, config.minOverscan);
    let state = createInitialState(minOverscan);
    function reset(timestamp = 0) {
        state = createInitialState(minOverscan, timestamp);
    }
    function update(input) {
        const { timestamp, delta, viewportSize, itemSize, virtualizationEnabled } = input;
        if (!virtualizationEnabled) {
            reset(timestamp);
            state.lastOverscan = 0;
            return { overscan: 0, state };
        }
        const effectiveItem = Math.max(1, Number.isFinite(itemSize) ? itemSize : 1);
        const effectiveViewport = viewportSize > 0 ? viewportSize : effectiveItem;
        const deltaAbs = Math.max(0, Math.abs(Number.isFinite(delta) ? delta : 0));
        const lastTimestamp = state.lastTimestamp > 0 ? state.lastTimestamp : timestamp;
        const deltaTime = Math.max(timestamp - lastTimestamp, minSampleMs);
        const teleportThreshold = effectiveViewport * teleportMultiplier;
        const viewportUnits = Math.max(1, effectiveViewport / effectiveItem);
        const maxOverscan = Math.max(minOverscan, minOverscan + Math.ceil(viewportUnits * maxViewportMultiplier));
        let overscan = minOverscan;
        if (deltaAbs > 0 && effectiveViewport > 0 && deltaAbs < teleportThreshold) {
            const velocityPx = (deltaAbs / Math.max(deltaTime, minSampleMs)) * frameDuration;
            const unitsPerFrame = velocityPx / effectiveItem;
            const velocityOverscan = unitsPerFrame * velocityRatio;
            const viewportOverscan = viewportUnits * viewportRatio;
            const target = minOverscan + Math.ceil(velocityOverscan + viewportOverscan);
            const clampedTarget = clamp(target, minOverscan, maxOverscan);
            const blend = Math.min(1, deltaTime / blendWindowMs);
            state.smoothedVelocity = state.smoothedVelocity * (1 - blend) + (velocityOverscan + viewportOverscan) * blend;
            state.smoothedOverscan = state.smoothedOverscan * decay + clampedTarget * (1 - decay);
            overscan = Math.round(clamp(state.smoothedOverscan, minOverscan, maxOverscan));
        }
        else {
            state.smoothedVelocity *= 0.5;
            state.smoothedOverscan = clamp(state.smoothedOverscan * decay, minOverscan, maxOverscan);
            overscan = Math.round(state.smoothedOverscan);
        }
        state.lastTimestamp = timestamp;
        state.lastOverscan = overscan;
        return { overscan, state };
    }
    return {
        update,
        reset,
        getState() {
            return state;
        },
    };
}
export function createHorizontalOverscanController(config) {
    const velocityRatio = config.velocityRatio ?? 0.9;
    const viewportRatio = config.viewportRatio ?? 0.75;
    const decay = config.decay ?? 0.58;
    const maxViewportMultiplier = config.maxViewportMultiplier ?? 3;
    const teleportMultiplier = config.teleportMultiplier ?? DEFAULT_TELEPORT_MULTIPLIER;
    const frameDuration = config.frameDurationMs ?? DEFAULT_FRAME_DURATION_MS;
    const minSampleMs = config.minSampleMs ?? DEFAULT_MIN_SAMPLE_MS;
    const blendWindowMs = config.blendWindowMs ?? DEFAULT_BLEND_WINDOW_MS;
    const minOverscan = Math.max(0, config.minOverscan);
    let state = createInitialState(minOverscan);
    function reset(timestamp = 0, overscanOverride) {
        state = createInitialState(minOverscan, timestamp, overscanOverride);
    }
    function update(input) {
        const { timestamp, delta, viewportSize, itemSize, totalItems, virtualizationEnabled } = input;
        if (!virtualizationEnabled) {
            const boundedTotal = Math.max(0, Math.floor(Number.isFinite(totalItems) ? totalItems : 0));
            const overscan = boundedTotal;
            reset(timestamp, overscan);
            state.lastOverscan = overscan;
            return { overscan, state };
        }
        const boundedTotal = Math.max(0, Math.floor(Number.isFinite(totalItems) ? totalItems : 0));
        const effectiveItem = Math.max(1, Number.isFinite(itemSize) ? itemSize : 1);
        const effectiveViewport = viewportSize > 0 ? viewportSize : effectiveItem;
        const deltaAbs = Math.max(0, Math.abs(Number.isFinite(delta) ? delta : 0));
        const lastTimestamp = state.lastTimestamp > 0 ? state.lastTimestamp : timestamp;
        const deltaTime = Math.max(timestamp - lastTimestamp, minSampleMs);
        const teleportThreshold = effectiveViewport * teleportMultiplier;
        const viewportUnits = Math.max(1, effectiveViewport / effectiveItem);
        const maxOverscan = boundedTotal > 0
            ? Math.min(boundedTotal, Math.max(minOverscan, minOverscan + Math.ceil(viewportUnits * maxViewportMultiplier)))
            : minOverscan;
        let overscan = minOverscan;
        if (deltaAbs > 0 && effectiveViewport > 0 && deltaAbs < teleportThreshold) {
            const velocityPx = (deltaAbs / Math.max(deltaTime, minSampleMs)) * frameDuration;
            const unitsPerFrame = velocityPx / effectiveItem;
            const velocityOverscan = unitsPerFrame * velocityRatio;
            const viewportOverscan = viewportUnits * viewportRatio;
            const target = minOverscan + Math.ceil(velocityOverscan + viewportOverscan);
            const clampedTarget = clamp(target, minOverscan, maxOverscan);
            const blend = Math.min(1, deltaTime / blendWindowMs);
            state.smoothedVelocity = state.smoothedVelocity * (1 - blend) + (velocityOverscan + viewportOverscan) * blend;
            state.smoothedOverscan = state.smoothedOverscan * decay + clampedTarget * (1 - decay);
            overscan = Math.round(clamp(state.smoothedOverscan, minOverscan, maxOverscan));
        }
        else {
            const fallbackOverscan = minOverscan + Math.ceil(viewportUnits * viewportRatio);
            state.smoothedVelocity *= 0.5;
            state.smoothedOverscan = clamp(state.smoothedOverscan * decay + fallbackOverscan * (1 - decay), minOverscan, maxOverscan);
            overscan = Math.round(state.smoothedOverscan);
        }
        state.lastTimestamp = timestamp;
        state.lastOverscan = overscan;
        return { overscan, state };
    }
    return {
        update,
        reset,
        getState() {
            return state;
        },
    };
}
