export interface DataGridCellCoordNormalizerCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridCellCoordNormalizerVirtualWindow {
  rowStart?: number
  rowEnd?: number
  rowTotal: number
  colStart?: number
  colEnd?: number
  colTotal: number
  overscan?: {
    top?: number
    bottom?: number
    left?: number
    right?: number
  }
}

export interface UseDataGridCellCoordNormalizerOptions {
  resolveVirtualWindow: () => DataGridCellCoordNormalizerVirtualWindow | null | undefined
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
  function resolveBounds(): { rowCount: number; columnCount: number } {
    const window = options.resolveVirtualWindow()
    const rowCount = Math.max(0, Math.trunc(window?.rowTotal ?? 0))
    const columnCount = Math.max(0, Math.trunc(window?.colTotal ?? 0))
    return {
      rowCount,
      columnCount,
    }
  }

  function normalizeCellCoordBase(coord: TCoord): TCoord | null {
    if (!Number.isFinite(coord.rowIndex) || !Number.isFinite(coord.columnIndex)) {
      return null
    }
    const bounds = resolveBounds()
    const maxRowIndex = bounds.rowCount - 1
    const maxColumnIndex = bounds.columnCount - 1
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
