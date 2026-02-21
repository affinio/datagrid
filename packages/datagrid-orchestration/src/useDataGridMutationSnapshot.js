export function useDataGridMutationSnapshot(options) {
    const cloneCoord = options.cloneCoord ?? ((coord) => ({ ...coord }));
    const cloneRange = options.cloneRange ?? ((range) => ({ ...range }));
    function cloneRows(rows) {
        return rows.map(row => options.cloneRow(row));
    }
    function cloneCoordOrNull(coord) {
        return coord ? cloneCoord(coord) : null;
    }
    function cloneRangeOrNull(range) {
        return range ? cloneRange(range) : null;
    }
    function captureGridMutationSnapshot() {
        return {
            sourceRows: cloneRows(options.resolveRows()),
            cellAnchor: cloneCoordOrNull(options.resolveCellAnchor()),
            cellFocus: cloneCoordOrNull(options.resolveCellFocus()),
            activeCell: cloneCoordOrNull(options.resolveActiveCell()),
            copiedSelectionRange: cloneRangeOrNull(options.resolveCopiedSelectionRange()),
        };
    }
    function applyGridMutationSnapshot(snapshot) {
        options.setRows(cloneRows(snapshot.sourceRows));
        options.setCellAnchor(cloneCoordOrNull(snapshot.cellAnchor));
        options.setCellFocus(cloneCoordOrNull(snapshot.cellFocus));
        options.setActiveCell(cloneCoordOrNull(snapshot.activeCell));
        options.setCopiedSelectionRange(cloneRangeOrNull(snapshot.copiedSelectionRange));
    }
    function toTransactionRange(range) {
        if (!range) {
            return null;
        }
        return {
            startRow: range.startRow,
            endRow: range.endRow,
            startColumn: range.startColumn,
            endColumn: range.endColumn,
        };
    }
    function toSingleCellRange(coord) {
        if (!coord) {
            return null;
        }
        return {
            startRow: coord.rowIndex,
            endRow: coord.rowIndex,
            startColumn: coord.columnIndex,
            endColumn: coord.columnIndex,
        };
    }
    return {
        captureGridMutationSnapshot,
        applyGridMutationSnapshot,
        toTransactionRange,
        toSingleCellRange,
    };
}
