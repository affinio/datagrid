export function useDataGridCellVisibilityScroller(options) {
    function ensureCellVisible(coord) {
        const virtualWindow = options.resolveVirtualWindow();
        const rowTotal = Math.max(0, Math.trunc(virtualWindow?.rowTotal ?? 0));
        const colTotal = Math.max(0, Math.trunc(virtualWindow?.colTotal ?? 0));
        if (rowTotal === 0 || colTotal === 0) {
            return;
        }
        const safeRowIndex = Math.max(0, Math.min(rowTotal - 1, Math.trunc(coord.rowIndex)));
        const safeColumnIndex = Math.max(0, Math.min(colTotal - 1, Math.trunc(coord.columnIndex)));
        const viewport = options.resolveViewportElement();
        const columnMetric = options.resolveColumnMetric(safeColumnIndex);
        if (!viewport || !columnMetric) {
            return;
        }
        const headerHeight = options.resolveHeaderHeight();
        const rowHeight = options.resolveRowHeight();
        const rowTop = headerHeight + (options.resolveRowOffset?.(safeRowIndex) ?? (safeRowIndex * rowHeight));
        const rowSpan = Math.max(1, options.resolveRowHeightAtIndex?.(safeRowIndex) ?? rowHeight);
        const rowBottom = rowTop + rowSpan;
        const visibleTop = viewport.scrollTop + headerHeight;
        const visibleBottom = viewport.scrollTop + viewport.clientHeight;
        if (rowTop < visibleTop) {
            viewport.scrollTop = Math.max(0, rowTop - headerHeight);
        }
        else if (rowBottom > visibleBottom) {
            viewport.scrollTop = Math.max(0, rowBottom - viewport.clientHeight);
        }
        if (columnMetric.start < viewport.scrollLeft) {
            viewport.scrollLeft = Math.max(0, columnMetric.start);
        }
        else if (columnMetric.end > viewport.scrollLeft + viewport.clientWidth) {
            viewport.scrollLeft = Math.max(0, columnMetric.end - viewport.clientWidth);
        }
        options.setScrollPosition({
            top: viewport.scrollTop,
            left: viewport.scrollLeft,
        });
    }
    return {
        ensureCellVisible,
    };
}
