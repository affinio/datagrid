export interface DataGridCellCoordNormalizerCoord {
  rowIndex: number
  columnIndex: number
}

export interface UseDataGridCellCoordNormalizerOptions {
  resolveRowCount: () => number
  resolveColumnCount: () => number
}

export interface UseDataGridCellCoordNormalizerResult<
  TCoord extends DataGridCellCoordNormalizerCoord = DataGridCellCoordNormalizerCoord,
> {
  normalizeCellCoordBase: (coord: TCoord) => TCoord | null
}

export function useDataGridCellCoordNormalizer<
  TCoord extends DataGridCellCoordNormalizerCoord = DataGridCellCoordNormalizerCoord,
>(
  options: UseDataGridCellCoordNormalizerOptions,
): UseDataGridCellCoordNormalizerResult<TCoord> {
  function normalizeCellCoordBase(coord: TCoord): TCoord | null {
    if (!Number.isFinite(coord.rowIndex) || !Number.isFinite(coord.columnIndex)) {
      return null
    }
    const maxRowIndex = options.resolveRowCount() - 1
    const maxColumnIndex = options.resolveColumnCount() - 1
    if (maxRowIndex < 0 || maxColumnIndex < 0) {
      return null
    }
    return {
      rowIndex: Math.max(0, Math.min(maxRowIndex, Math.trunc(coord.rowIndex))),
      columnIndex: Math.max(0, Math.min(maxColumnIndex, Math.trunc(coord.columnIndex))),
    } as TCoord
  }

  return {
    normalizeCellCoordBase,
  }
}

