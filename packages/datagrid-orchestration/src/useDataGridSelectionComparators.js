export function useDataGridSelectionComparators() {
    function cellCoordsEqual(a, b) {
        if (!a || !b) {
            return false;
        }
        return a.rowIndex === b.rowIndex && a.columnIndex === b.columnIndex;
    }
    function rangesEqual(a, b) {
        if (!a || !b) {
            return false;
        }
        return (a.startRow === b.startRow &&
            a.endRow === b.endRow &&
            a.startColumn === b.startColumn &&
            a.endColumn === b.endColumn);
    }
    return {
        cellCoordsEqual,
        rangesEqual,
    };
}
