export function setsEqual(left, right) {
    if (left.size !== right.size) {
        return false;
    }
    for (const value of left) {
        if (!right.has(value)) {
            return false;
        }
    }
    return true;
}
export function toggleDataGridRowSelection(selection, rowId, selected) {
    const next = new Set(selection);
    const shouldSelect = typeof selected === "boolean" ? selected : !next.has(rowId);
    if (shouldSelect) {
        next.add(rowId);
    }
    else {
        next.delete(rowId);
    }
    return next;
}
export function toggleAllVisibleDataGridRows(selection, visibleRows, resolveRowId, selected) {
    const next = new Set(selection);
    for (const row of visibleRows) {
        const rowId = resolveRowId(row);
        if (selected) {
            next.add(rowId);
        }
        else {
            next.delete(rowId);
        }
    }
    return next;
}
export function areAllVisibleDataGridRowsSelected(selection, visibleRows, resolveRowId) {
    if (visibleRows.length === 0) {
        return false;
    }
    return visibleRows.every(row => selection.has(resolveRowId(row)));
}
export function areSomeVisibleDataGridRowsSelected(selection, visibleRows, resolveRowId) {
    if (visibleRows.length === 0) {
        return false;
    }
    return visibleRows.some(row => selection.has(resolveRowId(row)));
}
export function reconcileDataGridRowSelection(selection, allRows, resolveRowId) {
    if (selection.size === 0) {
        return new Set();
    }
    const allowedIds = new Set(allRows.map(row => resolveRowId(row)));
    const next = new Set();
    selection.forEach(rowId => {
        if (allowedIds.has(rowId)) {
            next.add(rowId);
        }
    });
    return next;
}
