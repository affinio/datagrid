import { COLUMN_VIRTUALIZATION_BUFFER } from "../dom/gridUtils";
import { INDEX_COLUMN_WIDTH } from "../utils/constants";
import { computeColumnLayout, } from "../virtualization/horizontalLayout";
export function buildHorizontalMeta({ columns, layoutScale, resolvePinMode, viewportWidth, cachedNativeScrollWidth, cachedContainerWidth, lastScrollDirection, smoothedHorizontalVelocity, lastSignature, version, scrollWidth, }) {
    const layout = computeColumnLayout({
        columns,
        zoom: layoutScale,
        resolvePinMode,
    });
    const indexColumnWidth = INDEX_COLUMN_WIDTH * layoutScale;
    const containerWidthForColumns = Math.max(0, viewportWidth - indexColumnWidth);
    let nativeScrollLimit = 0;
    const measuredWidth = Number.isFinite(scrollWidth) ? scrollWidth : -1;
    if (measuredWidth >= 0 && viewportWidth >= 0) {
        nativeScrollLimit = Math.max(0, measuredWidth - viewportWidth);
    }
    else if (cachedNativeScrollWidth >= 0 && cachedContainerWidth >= 0) {
        nativeScrollLimit = Math.max(0, cachedNativeScrollWidth - cachedContainerWidth);
    }
    const effectiveViewport = Math.max(0, containerWidthForColumns - layout.pinnedLeftWidth - layout.pinnedRightWidth);
    const signature = `${layout.scrollableColumns.length}|${layout.scrollableMetrics.totalWidth}|${layout.zoom}|${containerWidthForColumns}|${layout.pinnedLeftWidth}|${layout.pinnedRightWidth}`;
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
