function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function escapeCssAttributeValue(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return CSS.escape(value);
    }
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function resolveCellAnchorPoint(viewport, selector) {
    const element = viewport.querySelector(selector);
    if (element) {
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left + clamp(rect.width * 0.5, 10, Math.max(10, rect.width - 10)),
            y: rect.bottom - 4,
        };
    }
    const viewportRect = viewport.getBoundingClientRect();
    return {
        x: viewportRect.left + clamp(viewportRect.width * 0.3, 10, Math.max(10, viewportRect.width - 10)),
        y: viewportRect.top + clamp(viewportRect.height * 0.4, 10, Math.max(10, viewportRect.height - 10)),
    };
}
export function useDataGridContextMenuAnchor(options) {
    function openContextMenuFromCurrentCell() {
        const current = options.resolveCurrentCellCoord();
        const viewport = options.resolveViewportElement();
        if (!current || !viewport) {
            return false;
        }
        const row = options.resolveRowAtIndex(current.rowIndex);
        const column = options.resolveColumnAtIndex(current.columnIndex);
        if (!row || !column) {
            return false;
        }
        if (!(options.isColumnContextEnabled?.(column) ?? column.key !== "select")) {
            return false;
        }
        const rowId = String(row.rowId);
        const columnKey = column.key;
        const selector = `.datagrid-stage__cell[data-row-id="${escapeCssAttributeValue(rowId)}"][data-column-key="${escapeCssAttributeValue(columnKey)}"]`;
        const anchor = resolveCellAnchorPoint(viewport, selector);
        const range = options.resolveSelectionRange();
        const zone = range &&
            options.isMultiCellSelection(range) &&
            options.isCoordInsideRange(current, range)
            ? "range"
            : "cell";
        options.openContextMenu(anchor.x, anchor.y, {
            zone,
            columnKey,
            rowId,
        });
        return true;
    }
    return {
        openContextMenuFromCurrentCell,
    };
}
