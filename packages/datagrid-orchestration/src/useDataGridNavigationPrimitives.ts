import type { DataGridRowNode } from "@affino/datagrid-core"

export interface DataGridNavigationPrimitiveCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridNavigationPrimitiveRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface DataGridNavigationPrimitiveColumn {
  key: string
}

export interface UseDataGridNavigationPrimitivesOptions<
  TCoord extends DataGridNavigationPrimitiveCoord = DataGridNavigationPrimitiveCoord,
  TRange extends DataGridNavigationPrimitiveRange = DataGridNavigationPrimitiveRange,
  TColumn extends DataGridNavigationPrimitiveColumn = DataGridNavigationPrimitiveColumn,
> {
  resolveColumns: () => readonly TColumn[]
  resolveRowsLength: () => number
  resolveNavigableColumnIndexes: () => readonly number[]
  normalizeCellCoord: (coord: TCoord) => TCoord | null
  resolveCellAnchor: () => TCoord | null
  resolveCellFocus: () => TCoord | null
  resolveActiveCell: () => TCoord | null
  setCellAnchor: (coord: TCoord) => void
  setCellFocus: (coord: TCoord) => void
  setActiveCell: (coord: TCoord) => void
  ensureCellVisible: (coord: TCoord) => void
  coordsEqual: (left: TCoord | null, right: TCoord | null) => boolean
}

export interface UseDataGridNavigationPrimitivesResult<
  TCoord extends DataGridNavigationPrimitiveCoord = DataGridNavigationPrimitiveCoord,
  TRange extends DataGridNavigationPrimitiveRange = DataGridNavigationPrimitiveRange,
> {
  resolveRowIndex: (row: DataGridRowNode<unknown>) => number
  resolveColumnIndex: (columnKey: string) => number
  clampRowIndex: (rowIndex: number) => number
  getFirstNavigableColumnIndex: () => number
  getLastNavigableColumnIndex: () => number
  resolveNearestNavigableColumnIndex: (columnIndex: number, direction?: 1 | -1) => number
  getAdjacentNavigableColumnIndex: (columnIndex: number, direction: 1 | -1) => number
  positiveModulo: (value: number, divisor: number) => number
  applyCellSelection: (
    nextCoord: TCoord,
    extend: boolean,
    fallbackAnchor?: TCoord,
    ensureVisible?: boolean,
  ) => void
  isCoordInsideRange: (coord: TCoord, range: TRange) => boolean
}

export function useDataGridNavigationPrimitives<
  TCoord extends DataGridNavigationPrimitiveCoord = DataGridNavigationPrimitiveCoord,
  TRange extends DataGridNavigationPrimitiveRange = DataGridNavigationPrimitiveRange,
  TColumn extends DataGridNavigationPrimitiveColumn = DataGridNavigationPrimitiveColumn,
>(
  options: UseDataGridNavigationPrimitivesOptions<TCoord, TRange, TColumn>,
): UseDataGridNavigationPrimitivesResult<TCoord, TRange> {
  function resolveRowIndex(row: DataGridRowNode<unknown>): number {
    const candidate = [row.displayIndex, row.sourceIndex, row.originalIndex].find(Number.isFinite) ?? 0
    return Math.max(0, Math.trunc(candidate))
  }

  function resolveColumnIndex(columnKey: string): number {
    return options.resolveColumns().findIndex(column => column.key === columnKey)
  }

  function clampRowIndex(rowIndex: number): number {
    const maxRowIndex = Math.max(0, options.resolveRowsLength() - 1)
    return Math.max(0, Math.min(maxRowIndex, Math.trunc(rowIndex)))
  }

  function getFirstNavigableColumnIndex(): number {
    return options.resolveNavigableColumnIndexes()[0] ?? -1
  }

  function getLastNavigableColumnIndex(): number {
    const indexes = options.resolveNavigableColumnIndexes()
    return indexes[indexes.length - 1] ?? -1
  }

  function resolveNearestNavigableColumnIndex(columnIndex: number, direction: 1 | -1 = 1): number {
    const indexes = options.resolveNavigableColumnIndexes()
    if (!indexes.length) {
      return -1
    }
    if (indexes.includes(columnIndex)) {
      return columnIndex
    }
    if (direction > 0) {
      return indexes.find(index => index >= columnIndex) ?? getLastNavigableColumnIndex()
    }
    for (let index = indexes.length - 1; index >= 0; index -= 1) {
      const candidate = indexes[index]
      if (candidate !== undefined && candidate <= columnIndex) {
        return candidate
      }
    }
    return getFirstNavigableColumnIndex()
  }

  function getAdjacentNavigableColumnIndex(columnIndex: number, direction: 1 | -1): number {
    const indexes = options.resolveNavigableColumnIndexes()
    if (!indexes.length) {
      return -1
    }
    const currentPos = indexes.indexOf(columnIndex)
    if (currentPos === -1) {
      return resolveNearestNavigableColumnIndex(columnIndex, direction)
    }
    const nextPos = Math.max(0, Math.min(indexes.length - 1, currentPos + direction))
    return indexes[nextPos] ?? columnIndex
  }

  function positiveModulo(value: number, divisor: number): number {
    if (divisor <= 0) {
      return 0
    }
    const remainder = value % divisor
    return remainder < 0 ? remainder + divisor : remainder
  }

  function applyCellSelection(
    nextCoord: TCoord,
    extend: boolean,
    fallbackAnchor?: TCoord,
    ensureVisible = true,
  ): void {
    const normalized = options.normalizeCellCoord(nextCoord)
    if (!normalized) {
      return
    }

    let nextAnchor: TCoord
    let nextFocus: TCoord
    if (extend) {
      const anchor = options.resolveCellAnchor() ?? fallbackAnchor ?? options.resolveActiveCell() ?? normalized
      nextAnchor = options.normalizeCellCoord(anchor as TCoord) ?? normalized
      nextFocus = normalized
    } else {
      nextAnchor = normalized
      nextFocus = normalized
    }

    if (!options.coordsEqual(options.resolveCellAnchor(), nextAnchor)) {
      options.setCellAnchor(nextAnchor)
    }
    if (!options.coordsEqual(options.resolveCellFocus(), nextFocus)) {
      options.setCellFocus(nextFocus)
    }
    if (!options.coordsEqual(options.resolveActiveCell(), normalized)) {
      options.setActiveCell(normalized)
    }
    if (ensureVisible) {
      options.ensureCellVisible(normalized)
    }
  }

  function isCoordInsideRange(coord: TCoord, range: TRange): boolean {
    return (
      coord.rowIndex >= range.startRow &&
      coord.rowIndex <= range.endRow &&
      coord.columnIndex >= range.startColumn &&
      coord.columnIndex <= range.endColumn
    )
  }

  return {
    resolveRowIndex,
    resolveColumnIndex,
    clampRowIndex,
    getFirstNavigableColumnIndex,
    getLastNavigableColumnIndex,
    resolveNearestNavigableColumnIndex,
    getAdjacentNavigableColumnIndex,
    positiveModulo,
    applyCellSelection,
    isCoordInsideRange,
  }
}
