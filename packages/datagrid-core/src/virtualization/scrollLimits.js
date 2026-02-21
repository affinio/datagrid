function normalizeNumber(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}
function clamp(value, min, max) {
    if (Number.isNaN(value))
        return min;
    if (value < min)
        return min;
    if (value > max)
        return max;
    return value;
}
export function computeVerticalScrollLimit(input) {
    const itemSize = Math.max(0, normalizeNumber(input.estimatedItemSize, 0));
    const count = Math.max(0, Math.floor(normalizeNumber(input.totalCount, 0)));
    const viewport = Math.max(0, normalizeNumber(input.viewportSize, 0));
    const overscanTrailing = Math.max(0, Math.floor(normalizeNumber(input.overscanTrailing, 0)));
    const visibleCount = Math.max(1, Math.floor(normalizeNumber(input.visibleCount, 1)));
    const trailingPadding = Math.max(0, normalizeNumber(input.trailingPadding ?? 0, 0));
    const edgePadding = Math.max(0, normalizeNumber(input.edgePadding ?? 0, 0));
    const baseMax = Math.max(0, count * itemSize - viewport);
    const overscanPx = overscanTrailing * itemSize;
    const trailingGap = Math.max(0, viewport - visibleCount * itemSize);
    const extendedMax = Math.max(baseMax, baseMax + overscanPx + trailingGap + trailingPadding + edgePadding);
    const nativeLimit = Math.max(0, normalizeNumber(input.nativeScrollLimit ?? 0, 0));
    if (!Number.isFinite(nativeLimit) || nativeLimit <= 0) {
        return extendedMax;
    }
    return Math.max(baseMax, Math.min(extendedMax, nativeLimit));
}
export function computeHorizontalScrollLimit(input) {
    const totalWidth = Math.max(0, normalizeNumber(input.totalScrollableWidth, 0));
    const viewportWidth = Math.max(0, normalizeNumber(input.viewportWidth, 0));
    const pinnedLeft = Math.max(0, normalizeNumber(input.pinnedLeftWidth, 0));
    const pinnedRight = Math.max(0, normalizeNumber(input.pinnedRightWidth, 0));
    const bufferPx = Math.max(0, normalizeNumber(input.bufferPx, 0));
    const trailingGap = Math.max(0, normalizeNumber(input.trailingGap ?? 0, 0));
    const tolerance = Math.max(0, normalizeNumber(input.tolerancePx ?? 0, 0));
    const effectiveViewport = Math.max(0, viewportWidth - pinnedLeft - pinnedRight);
    const baseMax = Math.max(0, totalWidth - effectiveViewport);
    const extendedMax = Math.max(0, baseMax + bufferPx + trailingGap + 1);
    const virtualizationLimit = Math.max(baseMax, extendedMax);
    const nativeLimit = input.nativeScrollLimit;
    if (nativeLimit == null || !Number.isFinite(nativeLimit) || nativeLimit <= 0) {
        return virtualizationLimit;
    }
    const delta = nativeLimit - virtualizationLimit;
    if (Math.abs(delta) <= tolerance) {
        return Math.max(nativeLimit, virtualizationLimit);
    }
    // Deterministic envelope: when native limit drifts too far from virtualization math
    // (resize storms, async scroll-width updates), cap max scroll around virtualization bounds.
    if (delta > 0) {
        return virtualizationLimit + tolerance;
    }
    return Math.max(0, nativeLimit);
}
export function clampScrollOffset({ offset, limit }) {
    if (!Number.isFinite(offset)) {
        return 0;
    }
    if (!Number.isFinite(limit) || limit <= 0) {
        return clamp(offset, 0, 0);
    }
    return clamp(offset, 0, limit);
}
