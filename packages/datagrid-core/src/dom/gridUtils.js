import { accumulateColumnWidths as accumulateColumnWidthsCore, calculateVisibleColumns as calculateVisibleColumnsCore, COLUMN_VIRTUALIZATION_BUFFER, DEFAULT_COLUMN_WIDTH, resolveColumnWidth as resolveColumnWidthCore, } from "../virtualization/columnSizing";
export { COLUMN_VIRTUALIZATION_BUFFER, DEFAULT_COLUMN_WIDTH };
export const supportsCssZoom = typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("zoom: 1");
export const resolveColumnWidth = (column, zoom = 1) => resolveColumnWidthCore(column, zoom);
export const accumulateColumnWidths = (columns, zoom = 1) => accumulateColumnWidthsCore(columns, zoom);
export function calculateVisibleColumns(scrollLeft, containerWidth, columns, options = {}) {
    return calculateVisibleColumnsCore(scrollLeft, containerWidth, columns, options);
}
export function getCellElement(container, rowIndex, columnKey) {
    if (!container)
        return null;
    return container.querySelector(`[data-row-index="${rowIndex}"][data-col-key="${columnKey}"]`);
}
export function focusElement(elementRef) {
    const element = elementRef.value;
    if (!element)
        return;
    element.focus({ preventScroll: true });
}
export function scrollCellIntoView({ container, targetRowIndex, rowHeight, viewportHeight, currentScrollTop, clampScrollTop, }) {
    if (!container)
        return currentScrollTop;
    const targetTop = targetRowIndex * rowHeight;
    const targetBottom = targetTop + rowHeight;
    const viewTop = currentScrollTop;
    const viewBottom = viewTop + viewportHeight;
    let nextScrollTop = viewTop;
    if (targetTop < viewTop) {
        nextScrollTop = targetTop;
    }
    else if (targetBottom > viewBottom) {
        nextScrollTop = targetBottom - viewportHeight;
    }
    nextScrollTop = clampScrollTop(nextScrollTop);
    if (nextScrollTop !== viewTop) {
        container.scrollTop = nextScrollTop;
    }
    return nextScrollTop;
}
export function elementFromPoint(clientX, clientY) {
    if (typeof document === "undefined")
        return null;
    return document.elementFromPoint(clientX, clientY);
}
function isPositiveFinite(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function resolveMetricWidth(key, column, widthMap, metricWidth, resolveFallback) {
    const mapped = widthMap.get(key);
    if (isPositiveFinite(mapped)) {
        return mapped;
    }
    if (isPositiveFinite(metricWidth)) {
        return metricWidth;
    }
    if (resolveFallback) {
        const fallback = resolveFallback(column);
        if (isPositiveFinite(fallback)) {
            return fallback;
        }
    }
    return 0;
}
export function buildTableSpaceColumnLayout(input) {
    const { columns, getColumnKey, columnWidthMap, pinnedLeft, pinnedRight, resolveColumnWidth: resolveFallback, } = input;
    const infoByKey = new Map();
    const ordered = [];
    const pinnedKeySet = new Set();
    let pinnedLeftWidth = 0;
    for (const metric of pinnedLeft) {
        const column = metric.column;
        const key = getColumnKey(column);
        pinnedKeySet.add(key);
        const width = resolveMetricWidth(key, column, columnWidthMap, metric.width, resolveFallback);
        const info = {
            column,
            key,
            pin: "left",
            left: pinnedLeftWidth,
            width,
        };
        pinnedLeftWidth += width;
        infoByKey.set(key, info);
        ordered.push(info);
    }
    const scrollableInfos = [];
    let scrollableWidth = 0;
    for (const column of columns) {
        const key = getColumnKey(column);
        if (pinnedKeySet.has(key)) {
            continue;
        }
        const width = resolveMetricWidth(key, column, columnWidthMap, undefined, resolveFallback);
        const info = {
            column,
            key,
            pin: "none",
            left: pinnedLeftWidth + scrollableWidth,
            width,
        };
        scrollableWidth += width;
        infoByKey.set(key, info);
        scrollableInfos.push(info);
    }
    const pinnedRightInfos = [];
    let pinnedRightWidth = 0;
    const pinnedRightBase = pinnedLeftWidth + scrollableWidth;
    for (const metric of pinnedRight) {
        const column = metric.column;
        const key = getColumnKey(column);
        pinnedKeySet.add(key);
        const width = resolveMetricWidth(key, column, columnWidthMap, metric.width, resolveFallback);
        const info = {
            column,
            key,
            pin: "right",
            left: pinnedRightBase + pinnedRightWidth,
            width,
        };
        pinnedRightWidth += width;
        infoByKey.set(key, info);
        pinnedRightInfos.push(info);
    }
    ordered.push(...scrollableInfos, ...pinnedRightInfos);
    return {
        ordered,
        byKey: infoByKey,
        pinnedLeftWidth,
        scrollableWidth,
        pinnedRightWidth,
    };
}
