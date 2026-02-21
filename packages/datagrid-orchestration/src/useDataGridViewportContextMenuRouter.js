function isContextEnabled(columnKey, options) {
    return options.isColumnContextEnabled?.(columnKey) ?? columnKey !== "select";
}
export function useDataGridViewportContextMenuRouter(options) {
    function dispatchViewportContextMenu(event) {
        if (options.isInteractionBlocked()) {
            event.preventDefault();
            return true;
        }
        const currentRange = options.resolveSelectionRange();
        if (options.isRangeMoveModifierActive(event) && currentRange) {
            event.preventDefault();
            return true;
        }
        const targetNode = event.target;
        if (!targetNode) {
            return false;
        }
        const cell = targetNode.closest(".datagrid-stage__cell[data-row-id][data-column-key]");
        if (cell) {
            const rowId = cell.dataset.rowId ?? "";
            const columnKey = cell.dataset.columnKey ?? "";
            if (columnKey && isContextEnabled(columnKey, options)) {
                let coord = null;
                const rowIndex = cell.dataset.rowIndex;
                const columnIndex = cell.dataset.columnIndex;
                if (rowIndex !== undefined && columnIndex !== undefined) {
                    const parsedRow = Number(rowIndex);
                    const parsedColumn = Number(columnIndex);
                    if (Number.isFinite(parsedRow) && Number.isFinite(parsedColumn)) {
                        coord = { rowIndex: parsedRow, columnIndex: parsedColumn };
                    }
                }
                if (!coord) {
                    coord = options.resolveCellCoordFromDataset(rowId, columnKey);
                }
                if (!coord) {
                    event.preventDefault();
                    options.openContextMenu(event.clientX, event.clientY, { zone: "cell", columnKey, rowId });
                    return true;
                }
                if (coord) {
                    if (!currentRange || !options.isCoordInsideRange(coord, currentRange)) {
                        options.applyCellSelection(coord, false, coord, false);
                    }
                    else if (!options.cellCoordsEqual(options.resolveActiveCellCoord(), coord)) {
                        options.setActiveCellCoord(coord);
                    }
                    const nextRange = options.resolveSelectionRange();
                    const zone = options.isMultiCellSelection(nextRange) &&
                        !!nextRange &&
                        options.isCoordInsideRange(coord, nextRange)
                        ? "range"
                        : "cell";
                    event.preventDefault();
                    options.openContextMenu(event.clientX, event.clientY, { zone, columnKey, rowId });
                    return true;
                }
            }
        }
        const headerCell = targetNode.closest(".datagrid-stage__cell--header[data-column-key]");
        if (headerCell) {
            const columnKey = headerCell.dataset.columnKey ?? "";
            if (columnKey && isContextEnabled(columnKey, options)) {
                event.preventDefault();
                options.openContextMenu(event.clientX, event.clientY, { zone: "header", columnKey });
                return true;
            }
            return false;
        }
        event.preventDefault();
        options.closeContextMenu();
        return true;
    }
    return {
        dispatchViewportContextMenu,
    };
}
