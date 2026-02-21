export function getDataGridRangeWidth(range) {
    return Math.max(0, range.endColumn - range.startColumn + 1);
}
export function forEachDataGridRangeCell(range, callback) {
    for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
        const rowOffset = rowIndex - range.startRow;
        for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
            callback({
                rowIndex,
                columnIndex,
                rowOffset,
                columnOffset: columnIndex - range.startColumn,
            });
        }
    }
}
export function createDataGridMutableRowStore(options) {
    const { rows, resolveRowId, cloneRow } = options;
    const sourceById = new Map(rows.map(row => [resolveRowId(row), row]));
    const mutableById = new Map();
    const getMutableRow = (rowId) => {
        const existing = mutableById.get(rowId);
        if (existing) {
            return existing;
        }
        const source = sourceById.get(rowId);
        if (!source) {
            return null;
        }
        const clone = cloneRow(source);
        mutableById.set(rowId, clone);
        return clone;
    };
    const commitRows = (inputRows) => {
        if (mutableById.size === 0) {
            return inputRows;
        }
        return inputRows.map(row => mutableById.get(resolveRowId(row)) ?? row);
    };
    return {
        sourceById,
        mutableById,
        getMutableRow,
        commitRows,
    };
}
