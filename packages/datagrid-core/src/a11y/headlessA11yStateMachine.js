function normalizeCount(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.trunc(value));
}
function normalizeDimensions(rowCount, colCount) {
    return {
        rowCount: normalizeCount(rowCount),
        colCount: normalizeCount(colCount),
    };
}
function clamp(value, min, max) {
    if (max < min)
        return min;
    if (value < min)
        return min;
    if (value > max)
        return max;
    return value;
}
function normalizeFocusCell(cell, dimensions) {
    if (!cell)
        return null;
    if (dimensions.rowCount < 1 || dimensions.colCount < 1)
        return null;
    const maxRow = dimensions.rowCount - 1;
    const maxCol = dimensions.colCount - 1;
    return {
        rowIndex: clamp(Math.trunc(cell.rowIndex), 0, maxRow),
        colIndex: clamp(Math.trunc(cell.colIndex), 0, maxCol),
        rowId: cell.rowId,
        columnKey: cell.columnKey,
    };
}
function isSameFocusCell(left, right) {
    if (left === right)
        return true;
    if (!left || !right)
        return false;
    return (left.rowIndex === right.rowIndex &&
        left.colIndex === right.colIndex &&
        left.rowId === right.rowId &&
        left.columnKey === right.columnKey);
}
function isSameSnapshot(left, right) {
    return (left.rowCount === right.rowCount &&
        left.colCount === right.colCount &&
        left.gridFocused === right.gridFocused &&
        left.activeDescendantId === right.activeDescendantId &&
        isSameFocusCell(left.focusCell, right.focusCell));
}
function canUseGridDimensions(dimensions) {
    return dimensions.rowCount > 0 && dimensions.colCount > 0;
}
function moveToFirstCell(dimensions) {
    if (!canUseGridDimensions(dimensions))
        return null;
    return {
        rowIndex: 0,
        colIndex: 0,
    };
}
export function createDataGridA11yStateMachine(options) {
    const idPrefix = typeof options.idPrefix === "string" && options.idPrefix.length > 0
        ? options.idPrefix
        : "datagrid";
    const resolveCellId = options.resolveCellId ?? ((cell) => {
        return `${idPrefix}-cell-r${cell.rowIndex}-c${cell.colIndex}`;
    });
    let dimensions = normalizeDimensions(options.rowCount, options.colCount);
    let gridFocused = Boolean(options.initialGridFocused);
    let focusCell = normalizeFocusCell(options.initialFocusCell, dimensions);
    const listeners = new Set();
    if (gridFocused && !focusCell) {
        focusCell = moveToFirstCell(dimensions);
    }
    function buildSnapshot() {
        const currentFocus = focusCell ? { ...focusCell } : null;
        const activeDescendantId = gridFocused && currentFocus ? resolveCellId(currentFocus) : null;
        return {
            rowCount: dimensions.rowCount,
            colCount: dimensions.colCount,
            gridFocused,
            focusCell: currentFocus,
            activeDescendantId,
        };
    }
    function emitIfChanged(previous) {
        const next = buildSnapshot();
        if (isSameSnapshot(previous, next)) {
            return next;
        }
        for (const listener of listeners) {
            listener(next);
        }
        return next;
    }
    function setDimensions(rowCount, colCount) {
        const previous = buildSnapshot();
        dimensions = normalizeDimensions(rowCount, colCount);
        focusCell = normalizeFocusCell(focusCell, dimensions);
        if (gridFocused && !focusCell) {
            focusCell = moveToFirstCell(dimensions);
        }
        if (!canUseGridDimensions(dimensions)) {
            focusCell = null;
            gridFocused = false;
        }
        return emitIfChanged(previous);
    }
    function setFocusCell(cell) {
        const previous = buildSnapshot();
        focusCell = normalizeFocusCell(cell, dimensions);
        if (gridFocused && !focusCell) {
            focusCell = moveToFirstCell(dimensions);
        }
        return emitIfChanged(previous);
    }
    function focusGrid(focused) {
        const previous = buildSnapshot();
        const canFocus = focused && canUseGridDimensions(dimensions);
        gridFocused = canFocus;
        if (gridFocused && !focusCell) {
            focusCell = moveToFirstCell(dimensions);
        }
        return emitIfChanged(previous);
    }
    function dispatchKeyboard(command) {
        const previous = buildSnapshot();
        if (!canUseGridDimensions(dimensions)) {
            return previous;
        }
        if (!gridFocused) {
            gridFocused = true;
            if (!focusCell) {
                focusCell = moveToFirstCell(dimensions);
            }
        }
        if (!focusCell) {
            focusCell = moveToFirstCell(dimensions);
        }
        if (!focusCell) {
            return emitIfChanged(previous);
        }
        const rowMax = Math.max(0, dimensions.rowCount - 1);
        const colMax = Math.max(0, dimensions.colCount - 1);
        const next = { ...focusCell };
        const pageStep = Math.max(1, Math.trunc(command.pageSize ?? 10));
        switch (command.key) {
            case "ArrowUp":
                next.rowIndex = clamp(next.rowIndex - 1, 0, rowMax);
                break;
            case "ArrowDown":
                next.rowIndex = clamp(next.rowIndex + 1, 0, rowMax);
                break;
            case "ArrowLeft":
                next.colIndex = clamp(next.colIndex - 1, 0, colMax);
                break;
            case "ArrowRight":
                next.colIndex = clamp(next.colIndex + 1, 0, colMax);
                break;
            case "Home":
                if (command.ctrlKey || command.metaKey) {
                    next.rowIndex = 0;
                }
                else {
                    next.colIndex = 0;
                }
                break;
            case "End":
                if (command.ctrlKey || command.metaKey) {
                    next.rowIndex = rowMax;
                }
                else {
                    next.colIndex = colMax;
                }
                break;
            case "PageUp":
                next.rowIndex = clamp(next.rowIndex - pageStep, 0, rowMax);
                break;
            case "PageDown":
                next.rowIndex = clamp(next.rowIndex + pageStep, 0, rowMax);
                break;
            case "Tab": {
                const delta = command.shiftKey ? -1 : 1;
                const linearIndex = next.rowIndex * dimensions.colCount + next.colIndex + delta;
                const clampedLinearIndex = clamp(linearIndex, 0, rowMax * dimensions.colCount + colMax);
                next.rowIndex = Math.trunc(clampedLinearIndex / dimensions.colCount);
                next.colIndex = clampedLinearIndex % dimensions.colCount;
                break;
            }
            case "Escape":
                gridFocused = false;
                return emitIfChanged(previous);
            case "Enter":
            default:
                return emitIfChanged(previous);
        }
        focusCell = next;
        return emitIfChanged(previous);
    }
    function getGridAria() {
        const snapshot = buildSnapshot();
        return {
            role: "grid",
            tabIndex: 0,
            ariaRowCount: snapshot.rowCount,
            ariaColCount: snapshot.colCount,
            ariaActiveDescendant: snapshot.activeDescendantId,
            ariaMultiselectable: true,
        };
    }
    function getCellAria(cell) {
        const normalized = normalizeFocusCell(cell, dimensions) ?? {
            rowIndex: Math.max(0, Math.trunc(cell.rowIndex)),
            colIndex: Math.max(0, Math.trunc(cell.colIndex)),
            rowId: cell.rowId,
            columnKey: cell.columnKey,
        };
        const active = Boolean(gridFocused &&
            focusCell &&
            focusCell.rowIndex === normalized.rowIndex &&
            focusCell.colIndex === normalized.colIndex);
        return {
            id: resolveCellId(normalized),
            role: "gridcell",
            tabIndex: active ? 0 : -1,
            ariaRowIndex: normalized.rowIndex + 1,
            ariaColIndex: normalized.colIndex + 1,
            ariaSelected: active,
        };
    }
    function subscribe(listener) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }
    return {
        snapshot: buildSnapshot,
        setDimensions,
        setFocusCell,
        focusGrid,
        dispatchKeyboard,
        getGridAria,
        getCellAria,
        subscribe,
    };
}
