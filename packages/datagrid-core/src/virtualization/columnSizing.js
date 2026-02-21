export const DEFAULT_COLUMN_WIDTH = 160;
export const COLUMN_VIRTUALIZATION_BUFFER = 2;
const visibleColumnResultPool = [
    {
        startIndex: 0,
        endIndex: 0,
        leftPadding: 0,
        rightPadding: 0,
        widths: [],
        offsets: [],
        totalWidth: 0,
    },
    {
        startIndex: 0,
        endIndex: 0,
        leftPadding: 0,
        rightPadding: 0,
        widths: [],
        offsets: [],
        totalWidth: 0,
    },
];
let visibleColumnResultIndex = 0;
const columnWidthMetricsCache = [null, null];
let columnWidthMetricsCacheWriteIndex = 0;
export function resolveColumnWidth(column, zoom = 1) {
    const fallbackWidth = column.width ?? column.minWidth ?? column.maxWidth ?? DEFAULT_COLUMN_WIDTH;
    const baseWidth = column.width ?? fallbackWidth;
    const minWidth = column.minWidth ?? fallbackWidth;
    const maxWidth = column.maxWidth ?? fallbackWidth;
    const normalized = Math.max(minWidth, Math.min(maxWidth, baseWidth)) * zoom;
    if (!Number.isFinite(normalized)) {
        return DEFAULT_COLUMN_WIDTH * zoom;
    }
    return normalized;
}
export function accumulateColumnWidths(columns, zoom = 1) {
    for (let index = 0; index < columnWidthMetricsCache.length; index += 1) {
        const cached = columnWidthMetricsCache[index];
        if (cached && cached.columns === columns && cached.zoom === zoom) {
            return cached.metrics;
        }
    }
    const widths = [];
    const offsets = [];
    let totalWidth = 0;
    for (const column of columns) {
        offsets.push(totalWidth);
        const width = resolveColumnWidth(column, zoom);
        widths.push(width);
        totalWidth += width;
    }
    const metrics = { widths, offsets, totalWidth };
    columnWidthMetricsCache[columnWidthMetricsCacheWriteIndex] = {
        columns,
        zoom,
        metrics,
    };
    columnWidthMetricsCacheWriteIndex =
        (columnWidthMetricsCacheWriteIndex + 1) % columnWidthMetricsCache.length;
    return metrics;
}
function findFirstVisibleColumn(scrollLeft, widths, offsets) {
    let low = 0;
    let high = widths.length - 1;
    let candidate = widths.length;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const columnStart = offsets[mid] ?? 0;
        const columnWidth = widths[mid] ?? 0;
        const columnEnd = columnStart + columnWidth;
        if (columnEnd >= scrollLeft) {
            candidate = mid;
            high = mid - 1;
        }
        else {
            low = mid + 1;
        }
    }
    return Math.min(candidate, widths.length);
}
function findLastVisibleColumn(scrollRight, widths, offsets) {
    let low = 0;
    let high = widths.length - 1;
    let candidate = -1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const columnStart = offsets[mid] ?? 0;
        if (columnStart <= scrollRight) {
            candidate = mid;
            low = mid + 1;
        }
        else {
            high = mid - 1;
        }
    }
    return Math.min(candidate, widths.length - 1);
}
export function calculateVisibleColumns(scrollLeft, containerWidth, columns, options = {}) {
    const { zoom = 1, pinnedLeftWidth = 0, pinnedRightWidth = 0, metrics: suppliedMetrics, } = options;
    const metrics = suppliedMetrics ?? accumulateColumnWidths(columns, zoom);
    return calculateVisibleColumnsFromMetrics(scrollLeft, containerWidth, metrics, {
        pinnedLeftWidth,
        pinnedRightWidth,
    });
}
export function calculateVisibleColumnsFromMetrics(scrollLeft, containerWidth, metrics, options = {}) {
    const { pinnedLeftWidth = 0, pinnedRightWidth = 0 } = options;
    const { widths, offsets, totalWidth } = metrics;
    let result = visibleColumnResultPool[visibleColumnResultIndex];
    if (!result) {
        result = {
            startIndex: 0,
            endIndex: 0,
            leftPadding: 0,
            rightPadding: 0,
            widths: [],
            offsets: [],
            totalWidth: 0,
        };
        visibleColumnResultPool[visibleColumnResultIndex] = result;
    }
    visibleColumnResultIndex = (visibleColumnResultIndex + 1) % visibleColumnResultPool.length;
    result.widths = widths;
    result.offsets = offsets;
    result.totalWidth = totalWidth;
    if (!widths.length) {
        result.startIndex = 0;
        result.endIndex = 0;
        result.leftPadding = 0;
        result.rightPadding = 0;
        return result;
    }
    const effectiveViewportWidth = Math.max(0, containerWidth - pinnedLeftWidth - pinnedRightWidth);
    if (totalWidth <= effectiveViewportWidth) {
        result.startIndex = 0;
        result.endIndex = widths.length;
        result.leftPadding = 0;
        result.rightPadding = 0;
        return result;
    }
    const effectiveScrollLeft = Math.max(0, scrollLeft - pinnedLeftWidth);
    const scrollRight = effectiveScrollLeft + effectiveViewportWidth;
    const firstVisible = findFirstVisibleColumn(effectiveScrollLeft, widths, offsets);
    const lastVisible = findLastVisibleColumn(scrollRight, widths, offsets);
    if (globalThis.__UNITLAB_TABLE_DEBUG__) {
        // eslint-disable-next-line no-console
        console.debug('[columnSizing] range', {
            scrollLeft,
            effectiveScrollLeft,
            effectiveViewportWidth,
            firstVisible,
            lastVisible,
            pinnedLeftWidth,
            pinnedRightWidth,
            totalWidth,
        });
    }
    const visibleStartIndex = Math.min(firstVisible, widths.length);
    const visibleEndIndex = Math.min(lastVisible + 1, widths.length);
    const leftPadding = offsets[visibleStartIndex] ?? 0;
    const rightPadding = Math.max(0, totalWidth - (offsets[visibleEndIndex] ?? totalWidth));
    result.startIndex = visibleStartIndex;
    result.endIndex = visibleEndIndex;
    result.leftPadding = leftPadding;
    result.rightPadding = rightPadding;
    return result;
}
