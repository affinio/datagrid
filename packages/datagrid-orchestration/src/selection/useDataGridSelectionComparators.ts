export interface DataGridSelectionComparatorCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridSelectionComparatorRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface UseDataGridSelectionComparatorsResult<
  TCoord extends DataGridSelectionComparatorCoord = DataGridSelectionComparatorCoord,
  TRange extends DataGridSelectionComparatorRange = DataGridSelectionComparatorRange,
> {
  cellCoordsEqual: (a: TCoord | null, b: TCoord | null) => boolean
  rangesEqual: (a: TRange | null, b: TRange | null) => boolean
}

export function useDataGridSelectionComparators<
  TCoord extends DataGridSelectionComparatorCoord = DataGridSelectionComparatorCoord,
  TRange extends DataGridSelectionComparatorRange = DataGridSelectionComparatorRange,
>(): UseDataGridSelectionComparatorsResult<TCoord, TRange> {
  function cellCoordsEqual(a: TCoord | null, b: TCoord | null): boolean {
    if (!a || !b) {
      return false
    }
    return a.rowIndex === b.rowIndex && a.columnIndex === b.columnIndex
  }

  function rangesEqual(a: TRange | null, b: TRange | null): boolean {
    if (!a || !b) {
      return false
    }
    return (
      a.startRow === b.startRow &&
      a.endRow === b.endRow &&
      a.startColumn === b.startColumn &&
      a.endColumn === b.endColumn
    )
  }

  return {
    cellCoordsEqual,
    rangesEqual,
  }
}

