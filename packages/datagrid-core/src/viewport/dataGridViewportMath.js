function normalizeFinite(value, fallback = 0) {
    if (!Number.isFinite(value)) {
        return fallback;
    }
    return value;
}
export function resolveViewportDimensions(input) {
    const { viewportMetrics, layoutMeasurement, resolvedRowHeight, fallbackColumnWidth } = input;
    let containerHeight = input.cachedContainerHeight;
    let containerWidth = input.cachedContainerWidth;
    let headerHeight = input.cachedHeaderHeight;
    if (viewportMetrics) {
        containerHeight = viewportMetrics.containerHeight;
        containerWidth = viewportMetrics.containerWidth;
        headerHeight = viewportMetrics.headerHeight;
    }
    else if (layoutMeasurement) {
        containerHeight = layoutMeasurement.containerHeight;
        containerWidth = layoutMeasurement.containerWidth;
        headerHeight = layoutMeasurement.headerHeight;
    }
    if (containerHeight <= 0) {
        containerHeight = input.cachedContainerHeight > 0 ? input.cachedContainerHeight : resolvedRowHeight;
    }
    if (containerWidth <= 0) {
        containerWidth = input.cachedContainerWidth > 0 ? input.cachedContainerWidth : fallbackColumnWidth;
    }
    if (headerHeight < 0) {
        headerHeight = input.cachedHeaderHeight > 0 ? input.cachedHeaderHeight : 0;
    }
    return {
        containerHeight,
        containerWidth,
        headerHeight,
        viewportHeight: Math.max(containerHeight - headerHeight, resolvedRowHeight),
        viewportWidth: containerWidth,
    };
}
export function resolvePendingScroll(input) {
    const fallbackScrollTop = normalizeFinite(input.measuredScrollTop, normalizeFinite(input.lastScrollTopSample));
    const fallbackScrollLeft = normalizeFinite(input.measuredScrollLeft, normalizeFinite(input.lastScrollLeftSample));
    const hasPendingTop = typeof input.pendingScrollTopRequest === "number" && Number.isFinite(input.pendingScrollTopRequest);
    const hasPendingLeft = typeof input.pendingScrollLeftRequest === "number" && Number.isFinite(input.pendingScrollLeftRequest);
    return {
        fallbackScrollTop,
        fallbackScrollLeft,
        pendingTop: hasPendingTop ? input.pendingScrollTopRequest : fallbackScrollTop,
        pendingLeft: hasPendingLeft ? input.pendingScrollLeftRequest : fallbackScrollLeft,
        measuredScrollTopFromPending: hasPendingTop,
        measuredScrollLeftFromPending: hasPendingLeft,
        hadPendingScrollTop: input.pendingScrollTopRequest != null,
        hadPendingScrollLeft: input.pendingScrollLeftRequest != null,
    };
}
export function shouldUseFastPath(input) {
    return (!input.force &&
        !input.pendingHorizontalSettle &&
        !input.measuredScrollTopFromPending &&
        !input.measuredScrollLeftFromPending &&
        !input.hadPendingScrollTop &&
        !input.hadPendingScrollLeft &&
        input.scrollTopDelta <= input.verticalScrollEpsilon &&
        input.scrollLeftDelta <= input.horizontalScrollEpsilon);
}
export function resolveHorizontalSizing(input) {
    const { columnMeta, viewportWidth } = input;
    const totalPinnedWidth = columnMeta.pinnedLeftWidth + columnMeta.pinnedRightWidth;
    const contentWidthEstimate = Math.max(columnMeta.metrics.totalWidth + totalPinnedWidth, viewportWidth);
    const fallbackWidth = columnMeta.metrics.widths[0] ??
        columnMeta.pinnedLeft[0]?.width ??
        columnMeta.pinnedRight[0]?.width ??
        60;
    const averageColumnWidth = columnMeta.metrics.widths.length
        ? Math.max(1, columnMeta.metrics.totalWidth / Math.max(columnMeta.metrics.widths.length, 1))
        : Math.max(1, fallbackWidth);
    return {
        averageColumnWidth,
        contentWidthEstimate,
        horizontalClampContext: {
            totalScrollableWidth: columnMeta.metrics.totalWidth,
            containerWidthForColumns: columnMeta.containerWidthForColumns,
            pinnedLeftWidth: columnMeta.pinnedLeftWidth,
            pinnedRightWidth: columnMeta.pinnedRightWidth,
            averageColumnWidth,
            nativeScrollLimit: columnMeta.nativeScrollLimit,
            virtualizationEnabled: true,
        },
    };
}
export function computePinnedWidth(entries) {
    let total = 0;
    for (const entry of entries) {
        const width = Number.isFinite(entry.width) ? entry.width : 0;
        total += Math.max(0, width);
    }
    return total;
}
export function shouldNotifyNearBottom(input) {
    if (input.loading || input.viewportHeight <= 0 || input.totalRowCount <= 0) {
        return false;
    }
    const threshold = Math.max(0, input.totalContentHeight - input.viewportHeight * 2);
    return input.nextScrollTop >= threshold;
}
