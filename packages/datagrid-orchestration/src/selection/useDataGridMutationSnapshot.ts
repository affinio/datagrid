export interface DataGridMutationSnapshotCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridMutationSnapshotRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface DataGridMutationAffectedRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface DataGridMutationSnapshotState<
  TRow,
  TCoord extends DataGridMutationSnapshotCoord = DataGridMutationSnapshotCoord,
  TRange extends DataGridMutationSnapshotRange = DataGridMutationSnapshotRange,
> {
  sourceRows: TRow[]
  cellAnchor: TCoord | null
  cellFocus: TCoord | null
  activeCell: TCoord | null
  copiedSelectionRange: TRange | null
}

export interface UseDataGridMutationSnapshotOptions<
  TRow,
  TCoord extends DataGridMutationSnapshotCoord = DataGridMutationSnapshotCoord,
  TRange extends DataGridMutationSnapshotRange = DataGridMutationSnapshotRange,
> {
  resolveRows: () => readonly TRow[]
  setRows: (rows: TRow[]) => void
  resolveCellAnchor: () => TCoord | null
  setCellAnchor: (coord: TCoord | null) => void
  resolveCellFocus: () => TCoord | null
  setCellFocus: (coord: TCoord | null) => void
  resolveActiveCell: () => TCoord | null
  setActiveCell: (coord: TCoord | null) => void
  resolveCopiedSelectionRange: () => TRange | null
  setCopiedSelectionRange: (range: TRange | null) => void
  cloneRow: (row: TRow) => TRow
  cloneCoord?: (coord: TCoord) => TCoord
  cloneRange?: (range: TRange) => TRange
}

export interface UseDataGridMutationSnapshotResult<
  TRow,
  TCoord extends DataGridMutationSnapshotCoord = DataGridMutationSnapshotCoord,
  TRange extends DataGridMutationSnapshotRange = DataGridMutationSnapshotRange,
> {
  captureGridMutationSnapshot: () => DataGridMutationSnapshotState<TRow, TCoord, TRange>
  applyGridMutationSnapshot: (snapshot: DataGridMutationSnapshotState<TRow, TCoord, TRange>) => void
  toTransactionRange: (range: TRange | null) => DataGridMutationAffectedRange | null
  toSingleCellRange: (coord: TCoord | null) => TRange | null
}

export function useDataGridMutationSnapshot<
  TRow,
  TCoord extends DataGridMutationSnapshotCoord = DataGridMutationSnapshotCoord,
  TRange extends DataGridMutationSnapshotRange = DataGridMutationSnapshotRange,
>(
  options: UseDataGridMutationSnapshotOptions<TRow, TCoord, TRange>,
): UseDataGridMutationSnapshotResult<TRow, TCoord, TRange> {
  const cloneCoord = options.cloneCoord ?? ((coord: TCoord) => ({ ...coord }))
  const cloneRange = options.cloneRange ?? ((range: TRange) => ({ ...range }))

  function cloneRows(rows: readonly TRow[]): TRow[] {
    return rows.map(row => options.cloneRow(row))
  }

  function cloneCoordOrNull(coord: TCoord | null): TCoord | null {
    return coord ? cloneCoord(coord) : null
  }

  function cloneRangeOrNull(range: TRange | null): TRange | null {
    return range ? cloneRange(range) : null
  }

  function captureGridMutationSnapshot(): DataGridMutationSnapshotState<TRow, TCoord, TRange> {
    return {
      sourceRows: cloneRows(options.resolveRows()),
      cellAnchor: cloneCoordOrNull(options.resolveCellAnchor()),
      cellFocus: cloneCoordOrNull(options.resolveCellFocus()),
      activeCell: cloneCoordOrNull(options.resolveActiveCell()),
      copiedSelectionRange: cloneRangeOrNull(options.resolveCopiedSelectionRange()),
    }
  }

  function applyGridMutationSnapshot(snapshot: DataGridMutationSnapshotState<TRow, TCoord, TRange>): void {
    options.setRows(cloneRows(snapshot.sourceRows))
    options.setCellAnchor(cloneCoordOrNull(snapshot.cellAnchor))
    options.setCellFocus(cloneCoordOrNull(snapshot.cellFocus))
    options.setActiveCell(cloneCoordOrNull(snapshot.activeCell))
    options.setCopiedSelectionRange(cloneRangeOrNull(snapshot.copiedSelectionRange))
  }

  function toTransactionRange(range: TRange | null): DataGridMutationAffectedRange | null {
    if (!range) {
      return null
    }
    return {
      startRow: range.startRow,
      endRow: range.endRow,
      startColumn: range.startColumn,
      endColumn: range.endColumn,
    }
  }

  function toSingleCellRange(coord: TCoord | null): TRange | null {
    if (!coord) {
      return null
    }
    return {
      startRow: coord.rowIndex,
      endRow: coord.rowIndex,
      startColumn: coord.columnIndex,
      endColumn: coord.columnIndex,
    } as TRange
  }

  return {
    captureGridMutationSnapshot,
    applyGridMutationSnapshot,
    toTransactionRange,
    toSingleCellRange,
  }
}
