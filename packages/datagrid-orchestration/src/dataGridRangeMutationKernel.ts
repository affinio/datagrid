export interface DataGridRangeMutationRect {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface DataGridRangeIterationCell {
  rowIndex: number
  columnIndex: number
  rowOffset: number
  columnOffset: number
}

export interface DataGridMutableRowStore<TRow> {
  sourceById: Map<string, TRow>
  mutableById: Map<string, TRow>
  getMutableRow: (rowId: string) => TRow | null
  commitRows: (rows: readonly TRow[]) => readonly TRow[]
}

export interface CreateDataGridMutableRowStoreOptions<TRow> {
  rows: readonly TRow[]
  resolveRowId: (row: TRow) => string
  cloneRow: (row: TRow) => TRow
}

export function getDataGridRangeWidth(range: DataGridRangeMutationRect): number {
  return Math.max(0, range.endColumn - range.startColumn + 1)
}

export function forEachDataGridRangeCell(
  range: DataGridRangeMutationRect,
  callback: (cell: DataGridRangeIterationCell) => void,
): void {
  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
    const rowOffset = rowIndex - range.startRow
    for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
      callback({
        rowIndex,
        columnIndex,
        rowOffset,
        columnOffset: columnIndex - range.startColumn,
      })
    }
  }
}

export function createDataGridMutableRowStore<TRow>(
  options: CreateDataGridMutableRowStoreOptions<TRow>,
): DataGridMutableRowStore<TRow> {
  const { rows, resolveRowId, cloneRow } = options
  const sourceById = new Map<string, TRow>(rows.map(row => [resolveRowId(row), row]))
  const mutableById = new Map<string, TRow>()

  const getMutableRow = (rowId: string): TRow | null => {
    const existing = mutableById.get(rowId)
    if (existing) {
      return existing
    }
    const source = sourceById.get(rowId)
    if (!source) {
      return null
    }
    const clone = cloneRow(source)
    mutableById.set(rowId, clone)
    return clone
  }

  const commitRows = (inputRows: readonly TRow[]): readonly TRow[] => {
    if (mutableById.size === 0) {
      return inputRows
    }
    return inputRows.map(row => mutableById.get(resolveRowId(row)) ?? row)
  }

  return {
    sourceById,
    mutableById,
    getMutableRow,
    commitRows,
  }
}
