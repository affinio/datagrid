export interface DataGridDatasetCellCoord {
  rowIndex: number
  columnIndex: number
}

export interface UseDataGridCellDatasetResolverOptions<
  TRow,
  TCoord extends DataGridDatasetCellCoord = DataGridDatasetCellCoord,
> {
  resolveRows: () => readonly TRow[]
  resolveRowId: (row: TRow) => string
  resolveColumnIndex: (columnKey: string) => number
  normalizeCellCoord: (coord: TCoord) => TCoord | null
}

export interface UseDataGridCellDatasetResolverResult<
  TCoord extends DataGridDatasetCellCoord = DataGridDatasetCellCoord,
> {
  resolveRowIndexById: (rowId: string) => number
  resolveCellCoordFromDataset: (rowId: string, columnKey: string) => TCoord | null
}

export function useDataGridCellDatasetResolver<
  TRow,
  TCoord extends DataGridDatasetCellCoord = DataGridDatasetCellCoord,
>(
  options: UseDataGridCellDatasetResolverOptions<TRow, TCoord>,
): UseDataGridCellDatasetResolverResult<TCoord> {
  function resolveRowIndexById(rowId: string): number {
    return options.resolveRows().findIndex(row => String(options.resolveRowId(row)) === rowId)
  }

  function resolveCellCoordFromDataset(rowId: string, columnKey: string): TCoord | null {
    const rowIndex = resolveRowIndexById(rowId)
    if (rowIndex < 0) {
      return null
    }
    const columnIndex = options.resolveColumnIndex(columnKey)
    if (columnIndex < 0) {
      return null
    }
    return options.normalizeCellCoord({
      rowIndex,
      columnIndex,
    } as TCoord)
  }

  return {
    resolveRowIndexById,
    resolveCellCoordFromDataset,
  }
}
