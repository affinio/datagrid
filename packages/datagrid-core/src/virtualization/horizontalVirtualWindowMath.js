import { COLUMN_VIRTUALIZATION_BUFFER, calculateVisibleColumnsFromMetrics, } from "./columnSizing";
import { clamp, SCROLL_EDGE_PADDING } from "../utils/constants";
export function resolveHorizontalEffectiveViewport(containerWidth, pinnedLeftWidth, pinnedRightWidth) {
    return Math.max(0, containerWidth - pinnedLeftWidth - pinnedRightWidth);
}
function resolveOverscanTailWidth(metrics, overscanColumns) {
    const widths = metrics.widths;
    const offsets = metrics.offsets;
    const totalScrollableWidth = metrics.totalWidth;
    if (!widths.length) {
        return 0;
    }
    const overscanCount = Math.min(widths.length, Math.max(0, Math.ceil(overscanColumns)));
    if (overscanCount <= 0) {
        return 0;
    }
    const overscanStartIndex = Math.max(0, widths.length - overscanCount);
    const overscanStartOffset = offsets[overscanStartIndex] ?? totalScrollableWidth;
    return Math.max(0, totalScrollableWidth - overscanStartOffset);
}
export function computeHorizontalScrollClamp(input) {
    const { value, virtualizationEnabled, overscanLeading, overscanTrailing, meta } = input;
    const { metrics, containerWidthForColumns, pinnedLeftWidth, pinnedRightWidth, nativeScrollLimit, buffer, } = meta;
    if (!metrics.widths.length) {
        return 0;
    }
    const nativeLimit = Math.max(0, nativeScrollLimit);
    if (!virtualizationEnabled) {
        return clamp(value, 0, nativeLimit);
    }
    const offsets = metrics.offsets;
    const widths = metrics.widths;
    const lastIndex = Math.max(0, widths.length - 1);
    const totalScrollableWidth = Number.isFinite(metrics.totalWidth)
        ? metrics.totalWidth
        : offsets.length
            ? (offsets[lastIndex] ?? 0) + (widths[lastIndex] ?? 0)
            : 0;
    if (!Number.isFinite(totalScrollableWidth) || totalScrollableWidth <= 0) {
        return clamp(value, 0, nativeLimit);
    }
    const effectiveViewport = resolveHorizontalEffectiveViewport(containerWidthForColumns, pinnedLeftWidth, pinnedRightWidth);
    if (effectiveViewport <= 0) {
        return 0;
    }
    const baseMax = Math.max(0, totalScrollableWidth - effectiveViewport);
    const trailingGap = Math.max(0, effectiveViewport - totalScrollableWidth);
    const baseBuffer = Number.isFinite(buffer) ? buffer : COLUMN_VIRTUALIZATION_BUFFER;
    const overscanColumns = Math.max(baseBuffer, overscanLeading, overscanTrailing);
    const overscanWidth = resolveOverscanTailWidth(metrics, overscanColumns);
    const virtualizationLimit = Math.max(0, baseMax + overscanWidth + trailingGap + SCROLL_EDGE_PADDING);
    const maxScroll = Math.max(nativeLimit, virtualizationLimit);
    if (!Number.isFinite(maxScroll) || maxScroll <= 0) {
        return 0;
    }
    return clamp(value, 0, maxScroll);
}
export function computeHorizontalVirtualWindowRange(input) {
    const { offset, totalCount, virtualizationEnabled, overscanLeading, overscanTrailing, scrollVelocity, meta } = input;
    const { containerWidthForColumns, pinnedLeftWidth, pinnedRightWidth, metrics, buffer, } = meta;
    const metricsCount = metrics.widths.length;
    const normalizedCount = Math.max(0, Math.min(totalCount, metricsCount || totalCount));
    if (normalizedCount <= 0 || metricsCount <= 0) {
        return {
            start: 0,
            end: 0,
            payload: {
                visibleStart: 0,
                visibleEnd: 0,
                leftPadding: 0,
                rightPadding: 0,
                totalScrollableWidth: 0,
                visibleScrollableWidth: 0,
                averageWidth: 0,
                scrollSpeed: 0,
                effectiveViewport: 0,
            },
        };
    }
    if (!virtualizationEnabled) {
        const totalWidth = metrics.totalWidth;
        const leftPadding = 0;
        const rightPadding = 0;
        return {
            start: 0,
            end: normalizedCount,
            payload: {
                visibleStart: 0,
                visibleEnd: normalizedCount,
                leftPadding: meta.isRTL ? rightPadding : leftPadding,
                rightPadding: meta.isRTL ? leftPadding : rightPadding,
                totalScrollableWidth: totalWidth,
                visibleScrollableWidth: totalWidth,
                averageWidth: metrics.widths.length ? totalWidth / Math.max(metrics.widths.length, 1) : 0,
                scrollSpeed: scrollVelocity,
                effectiveViewport: resolveHorizontalEffectiveViewport(containerWidthForColumns, pinnedLeftWidth, pinnedRightWidth),
            },
        };
    }
    const baseBuffer = Number.isFinite(buffer) ? buffer : COLUMN_VIRTUALIZATION_BUFFER;
    const dynamicOverscanMultiplier = 1 + Math.min(Math.abs(scrollVelocity) / 1500, 1);
    const dynamicOverscan = Math.min(256, Math.max(0, Math.ceil(baseBuffer * dynamicOverscanMultiplier)));
    const normalizedOverscanLeading = Math.max(overscanLeading, dynamicOverscan);
    const normalizedOverscanTrailing = Math.max(overscanTrailing, dynamicOverscan);
    const visibleRange = calculateVisibleColumnsFromMetrics(offset, containerWidthForColumns, metrics, {
        pinnedLeftWidth,
        pinnedRightWidth,
    });
    const visibleStart = visibleRange.startIndex;
    const visibleEnd = visibleRange.endIndex;
    const overscanStart = Math.max(0, visibleStart - normalizedOverscanLeading);
    const overscanEnd = Math.min(normalizedCount, visibleEnd + normalizedOverscanTrailing);
    const visibleScrollableWidth = Math.max(0, visibleRange.totalWidth - (visibleRange.leftPadding + visibleRange.rightPadding));
    const averageWidth = metrics.widths.length ? metrics.totalWidth / Math.max(metrics.widths.length, 1) : 0;
    const effectiveViewport = resolveHorizontalEffectiveViewport(containerWidthForColumns, pinnedLeftWidth, pinnedRightWidth);
    const leftPadding = meta.isRTL ? visibleRange.rightPadding : visibleRange.leftPadding;
    const rightPadding = meta.isRTL ? visibleRange.leftPadding : visibleRange.rightPadding;
    return {
        start: overscanStart,
        end: overscanEnd,
        payload: {
            visibleStart,
            visibleEnd,
            leftPadding,
            rightPadding,
            totalScrollableWidth: metrics.totalWidth,
            visibleScrollableWidth,
            averageWidth: Number.isFinite(averageWidth) ? averageWidth : 0,
            scrollSpeed: scrollVelocity,
            effectiveViewport,
        },
    };
}
