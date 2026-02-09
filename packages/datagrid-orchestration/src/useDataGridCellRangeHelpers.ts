export interface DataGridCellRangeCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridCellRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface UseDataGridCellRangeHelpersOptions<
  TRow,
  TCoord extends DataGridCellRangeCoord = DataGridCellRangeCoord,
  TRange extends DataGridCellRange = DataGridCellRange,
> {
  resolveRowsLength: () => number
  resolveFirstNavigableColumnIndex: () => number
  resolveCandidateCurrentCell: () => TCoord | null
  resolveColumnIndex: (columnKey: string) => number
  resolveNearestNavigableColumnIndex: (columnIndex: number, direction?: 1 | -1) => number
  clampRowIndex: (rowIndex: number) => number
  resolveRowIndex: (row: TRow) => number
  isColumnSelectable?: (columnKey: string) => boolean
}

export interface UseDataGridCellRangeHelpersResult<
  TRow,
  TCoord extends DataGridCellRangeCoord = DataGridCellRangeCoord,
  TRange extends DataGridCellRange = DataGridCellRange,
> {
  resolveCellCoord: (row: TRow, columnKey: string) => TCoord | null
  normalizeCellCoord: (coord: TCoord) => TCoord | null
  normalizeSelectionRange: (range: TRange) => TRange | null
  buildExtendedRange: (baseRange: TRange, coord: TCoord) => TRange | null
  isCellWithinRange: (rowIndex: number, columnIndex: number, range: TRange) => boolean
  resolveCurrentCellCoord: () => TCoord | null
}

export function useDataGridCellRangeHelpers<
  TRow,
  TCoord extends DataGridCellRangeCoord = DataGridCellRangeCoord,
  TRange extends DataGridCellRange = DataGridCellRange,
>(
  options: UseDataGridCellRangeHelpersOptions<TRow, TCoord, TRange>,
): UseDataGridCellRangeHelpersResult<TRow, TCoord, TRange> {
  const isColumnSelectable = options.isColumnSelectable ?? (() => true)

  function normalizeCellCoord(coord: TCoord): TCoord | null {
    if (options.resolveRowsLength() === 0) {
      return null
    }
    const rowIndex = options.clampRowIndex(coord.rowIndex)
    const columnIndex = options.resolveNearestNavigableColumnIndex(Math.trunc(coord.columnIndex))
    if (columnIndex < 0) {
      return null
    }
    return {
      rowIndex,
      columnIndex,
    } as TCoord
  }

  function resolveCellCoord(row: TRow, columnKey: string): TCoord | null {
    if (!isColumnSelectable(columnKey)) {
      return null
    }
    const rawColumnIndex = options.resolveColumnIndex(columnKey)
    if (rawColumnIndex < 0) {
      return null
    }
    const columnIndex = options.resolveNearestNavigableColumnIndex(rawColumnIndex)
    if (columnIndex < 0) {
      return null
    }
    return {
      rowIndex: options.clampRowIndex(options.resolveRowIndex(row)),
      columnIndex,
    } as TCoord
  }

  function normalizeSelectionRange(range: TRange): TRange | null {
    const start = normalizeCellCoord({
      rowIndex: range.startRow,
      columnIndex: range.startColumn,
    } as TCoord)
    const end = normalizeCellCoord({
      rowIndex: range.endRow,
      columnIndex: range.endColumn,
    } as TCoord)
    if (!start || !end) {
      return null
    }
    return {
      startRow: Math.min(start.rowIndex, end.rowIndex),
      endRow: Math.max(start.rowIndex, end.rowIndex),
      startColumn: Math.min(start.columnIndex, end.columnIndex),
      endColumn: Math.max(start.columnIndex, end.columnIndex),
    } as TRange
  }

  function buildExtendedRange(baseRange: TRange, coord: TCoord): TRange | null {
    return normalizeSelectionRange({
      startRow: coord.rowIndex < baseRange.startRow ? coord.rowIndex : baseRange.startRow,
      endRow: coord.rowIndex > baseRange.endRow ? coord.rowIndex : baseRange.endRow,
      startColumn: coord.columnIndex < baseRange.startColumn ? coord.columnIndex : baseRange.startColumn,
      endColumn: coord.columnIndex > baseRange.endColumn ? coord.columnIndex : baseRange.endColumn,
    } as TRange)
  }

  function isCellWithinRange(rowIndex: number, columnIndex: number, range: TRange): boolean {
    return (
      rowIndex >= range.startRow &&
      rowIndex <= range.endRow &&
      columnIndex >= range.startColumn &&
      columnIndex <= range.endColumn
    )
  }

  function resolveCurrentCellCoord(): TCoord | null {
    const candidate = options.resolveCandidateCurrentCell()
    if (candidate) {
      return normalizeCellCoord(candidate)
    }
    const firstColumnIndex = options.resolveFirstNavigableColumnIndex()
    if (options.resolveRowsLength() === 0 || firstColumnIndex < 0) {
      return null
    }
    return {
      rowIndex: 0,
      columnIndex: firstColumnIndex,
    } as TCoord
  }

  return {
    resolveCellCoord,
    normalizeCellCoord,
    normalizeSelectionRange,
    buildExtendedRange,
    isCellWithinRange,
    resolveCurrentCellCoord,
  }
}
