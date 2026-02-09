export interface DataGridCopyRangeCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridCopyRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface UseDataGridCopyRangeHelpersOptions<
  TCoord extends DataGridCopyRangeCoord = DataGridCopyRangeCoord,
  TRange extends DataGridCopyRange = DataGridCopyRange,
> {
  resolveSelectionRange: () => TRange | null
  resolveCurrentCellCoord: () => TCoord | null
}

export interface UseDataGridCopyRangeHelpersResult<
  TRange extends DataGridCopyRange = DataGridCopyRange,
> {
  isMultiCellSelection: (range: TRange | null) => boolean
  resolveCopyRange: () => TRange | null
}

export function useDataGridCopyRangeHelpers<
  TCoord extends DataGridCopyRangeCoord = DataGridCopyRangeCoord,
  TRange extends DataGridCopyRange = DataGridCopyRange,
>(
  options: UseDataGridCopyRangeHelpersOptions<TCoord, TRange>,
): UseDataGridCopyRangeHelpersResult<TRange> {
  function isMultiCellSelection(range: TRange | null): boolean {
    if (!range) {
      return false
    }
    return range.startRow !== range.endRow || range.startColumn !== range.endColumn
  }

  function resolveCopyRange(): TRange | null {
    const selected = options.resolveSelectionRange()
    if (selected) {
      return selected
    }
    const current = options.resolveCurrentCellCoord()
    if (!current) {
      return null
    }
    return {
      startRow: current.rowIndex,
      endRow: current.rowIndex,
      startColumn: current.columnIndex,
      endColumn: current.columnIndex,
    } as TRange
  }

  return {
    isMultiCellSelection,
    resolveCopyRange,
  }
}
