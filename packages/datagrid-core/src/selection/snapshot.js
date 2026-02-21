export function createSelectionSnapshot(options) {
    const { ranges, activeRangeIndex, selectedPoint, getRowIdByIndex } = options;
    const clonePoint = (point) => {
        const resolvedRowId = point.rowId != null
            ? point.rowId
            : getRowIdByIndex
                ? getRowIdByIndex(point.rowIndex) ?? null
                : null;
        return {
            rowIndex: point.rowIndex,
            colIndex: point.colIndex,
            rowId: resolvedRowId,
        };
    };
    const resolveRowId = (existing, rowIndex) => {
        if (existing != null) {
            return existing;
        }
        if (getRowIdByIndex) {
            const resolved = getRowIdByIndex(rowIndex);
            return resolved != null ? resolved : null;
        }
        return null;
    };
    const snapshotRanges = ranges.map(range => ({
        startRow: range.startRow,
        endRow: range.endRow,
        startCol: range.startCol,
        endCol: range.endCol,
        startRowId: resolveRowId(range.startRowId, range.startRow),
        endRowId: resolveRowId(range.endRowId, range.endRow),
        anchor: clonePoint(range.anchor),
        focus: clonePoint(range.focus),
    }));
    const activeCell = selectedPoint ? clonePoint(selectedPoint) : null;
    return {
        ranges: snapshotRanges,
        activeRangeIndex,
        activeCell,
    };
}
export function selectionSnapshotSignature(snapshot) {
    return JSON.stringify(snapshot);
}
