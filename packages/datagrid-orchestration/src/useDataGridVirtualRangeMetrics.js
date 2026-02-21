export function computeDataGridVirtualRange(options) {
    const total = Math.max(0, Math.trunc(options.virtualWindow.rowTotal));
    if (total === 0) {
        return { start: 0, end: -1 };
    }
    const start = Math.max(0, Math.min(total - 1, Math.trunc(options.virtualWindow.rowStart)));
    const end = Math.max(start, Math.min(total - 1, Math.trunc(options.virtualWindow.rowEnd)));
    return { start, end };
}
export function useDataGridVirtualRangeMetrics(options) {
    const virtualRange = computeDataGridVirtualRange(options);
    const totalRows = Math.max(0, Math.trunc(options.virtualWindow.rowTotal));
    const spacerTopHeight = Math.max(0, virtualRange.start * options.rowHeight);
    const spacerBottomHeight = totalRows === 0 || virtualRange.end < virtualRange.start
        ? 0
        : Math.max(0, (totalRows - (virtualRange.end + 1)) * options.rowHeight);
    const rangeLabel = totalRows === 0 || virtualRange.end < virtualRange.start
        ? "0-0"
        : `${virtualRange.start + 1}-${virtualRange.end + 1}`;
    return {
        virtualRange,
        spacerTopHeight,
        spacerBottomHeight,
        rangeLabel,
    };
}
