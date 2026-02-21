import { COLUMN_VIRTUALIZATION_BUFFER } from "../dom/gridUtils";
import { computeColumnLayout, } from "../virtualization/horizontalLayout";
const layoutCache = [null, null];
let layoutCacheWriteIndex = 0;
function resolveCachedLayout(columns, zoom, resolvePinMode) {
    for (let index = 0; index < layoutCache.length; index += 1) {
        const cached = layoutCache[index];
        if (cached &&
            cached.columns === columns &&
            cached.zoom === zoom &&
            cached.resolvePinMode === resolvePinMode) {
            return cached.layout;
        }
    }
    const layout = computeColumnLayout({
        columns,
        zoom,
        resolvePinMode,
    });
    layoutCache[layoutCacheWriteIndex] = {
        columns,
        zoom,
        resolvePinMode,
        layout,
    };
    layoutCacheWriteIndex = (layoutCacheWriteIndex + 1) % layoutCache.length;
    return layout;
}
export function buildHorizontalMeta({ columns, layoutScale, resolvePinMode, viewportWidth, cachedNativeScrollWidth, cachedContainerWidth, lastScrollDirection, smoothedHorizontalVelocity, lastSignature, version, scrollWidth, }) {
    const layout = resolveCachedLayout(columns, layoutScale, resolvePinMode);
    // Legacy compatibility field: index column width is no longer injected as a synthetic viewport inset.
    // The viewport math is driven by real pinned column widths from column layout only.
    const indexColumnWidth = 0;
    const containerWidthForColumns = Math.max(0, viewportWidth);
    let nativeScrollLimit = 0;
    const measuredWidth = Number.isFinite(scrollWidth) ? scrollWidth : -1;
    if (measuredWidth >= 0 && viewportWidth >= 0) {
        nativeScrollLimit = Math.max(0, measuredWidth - viewportWidth);
    }
    else if (cachedNativeScrollWidth >= 0 && cachedContainerWidth >= 0) {
        nativeScrollLimit = Math.max(0, cachedNativeScrollWidth - cachedContainerWidth);
    }
    const effectiveViewport = Math.max(0, containerWidthForColumns - layout.pinnedLeftWidth - layout.pinnedRightWidth);
    const stableNativeLimit = Math.round(nativeScrollLimit);
    const signature = `${layout.scrollableColumns.length}|${layout.scrollableMetrics.totalWidth}|${layout.zoom}|${containerWidthForColumns}|${layout.pinnedLeftWidth}|${layout.pinnedRightWidth}|${stableNativeLimit}`;
    const nextVersion = signature === lastSignature ? version : version + 1;
    const meta = {
        scrollableColumns: layout.scrollableColumns,
        scrollableIndices: layout.scrollableIndices,
        metrics: layout.scrollableMetrics,
        pinnedLeft: layout.pinnedLeft,
        pinnedRight: layout.pinnedRight,
        pinnedLeftWidth: layout.pinnedLeftWidth,
        pinnedRightWidth: layout.pinnedRightWidth,
        zoom: layout.zoom,
        containerWidthForColumns,
        scrollDirection: lastScrollDirection,
        nativeScrollLimit,
        buffer: COLUMN_VIRTUALIZATION_BUFFER,
        indexColumnWidth,
        effectiveViewport,
        version: nextVersion,
        scrollVelocity: smoothedHorizontalVelocity,
    };
    return {
        meta,
        version: nextVersion,
        signature,
    };
}
