import type { DataGridRowNode } from "@affino/datagrid-core"

export interface DataGridCellVisualStateCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridCellVisualStateRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface UseDataGridCellVisualStatePredicatesOptions<
  TRow,
  TCoord extends DataGridCellVisualStateCoord = DataGridCellVisualStateCoord,
  TRange extends DataGridCellVisualStateRange = DataGridCellVisualStateRange,
> {
  resolveRowIndex: (row: DataGridRowNode<TRow>) => number
  resolveColumnIndex: (columnKey: string) => number
  isCellWithinRange: (rowIndex: number, columnIndex: number, range: TRange) => boolean
  resolveSelectionRange: () => TRange | null
  resolveCopiedRange: () => TRange | null
  resolveAnchorCoord: () => TCoord | null
  resolveActiveCoord: () => TCoord | null
  isFillDragging: () => boolean
  isRangeMoving: () => boolean
  resolveFillPreviewRange: () => TRange | null
  resolveFillBaseRange: () => TRange | null
  resolveMovePreviewRange: () => TRange | null
  resolveMoveBaseRange: () => TRange | null
  isInlineEditorOpen?: () => boolean
  selectColumnKey?: string
}

export interface UseDataGridCellVisualStatePredicatesResult<TRow> {
  isCellInSelection: (row: DataGridRowNode<TRow>, columnKey: string) => boolean
  isCellInCopiedRange: (row: DataGridRowNode<TRow>, columnKey: string) => boolean
  isAnchorCell: (row: DataGridRowNode<TRow>, columnKey: string) => boolean
  isActiveCell: (row: DataGridRowNode<TRow>, columnKey: string) => boolean
  isRangeEndCell: (row: DataGridRowNode<TRow>, columnKey: string) => boolean
  isCellInFillPreview: (row: DataGridRowNode<TRow>, columnKey: string) => boolean
  isCellInMovePreview: (row: DataGridRowNode<TRow>, columnKey: string) => boolean
  shouldShowFillHandle: (row: DataGridRowNode<TRow>, columnKey: string) => boolean
}

export function useDataGridCellVisualStatePredicates<
  TRow,
  TCoord extends DataGridCellVisualStateCoord = DataGridCellVisualStateCoord,
  TRange extends DataGridCellVisualStateRange = DataGridCellVisualStateRange,
>(
  options: UseDataGridCellVisualStatePredicatesOptions<TRow, TCoord, TRange>,
): UseDataGridCellVisualStatePredicatesResult<TRow> {
  const selectColumnKey = options.selectColumnKey ?? "select"

  function resolveRowColumn(
    row: DataGridRowNode<TRow>,
    columnKey: string,
  ): { rowIndex: number; columnIndex: number } | null {
    if (columnKey === selectColumnKey) {
      return null
    }
    const columnIndex = options.resolveColumnIndex(columnKey)
    if (columnIndex < 0) {
      return null
    }
    return {
      rowIndex: options.resolveRowIndex(row),
      columnIndex,
    }
  }

  function isCellInSelection(row: DataGridRowNode<TRow>, columnKey: string): boolean {
    const range = options.resolveSelectionRange()
    if (!range) {
      return false
    }
    const indexes = resolveRowColumn(row, columnKey)
    if (!indexes) {
      return false
    }
    return options.isCellWithinRange(indexes.rowIndex, indexes.columnIndex, range)
  }

  function isCellInCopiedRange(row: DataGridRowNode<TRow>, columnKey: string): boolean {
    const range = options.resolveCopiedRange()
    if (!range) {
      return false
    }
    const indexes = resolveRowColumn(row, columnKey)
    if (!indexes) {
      return false
    }
    return options.isCellWithinRange(indexes.rowIndex, indexes.columnIndex, range)
  }

  function isAnchorCell(row: DataGridRowNode<TRow>, columnKey: string): boolean {
    const anchor = options.resolveAnchorCoord()
    if (!anchor) {
      return false
    }
    const indexes = resolveRowColumn(row, columnKey)
    if (!indexes) {
      return false
    }
    return indexes.rowIndex === anchor.rowIndex && indexes.columnIndex === anchor.columnIndex
  }

  function isActiveCell(row: DataGridRowNode<TRow>, columnKey: string): boolean {
    const active = options.resolveActiveCoord()
    if (!active) {
      return false
    }
    const indexes = resolveRowColumn(row, columnKey)
    if (!indexes) {
      return false
    }
    return indexes.rowIndex === active.rowIndex && indexes.columnIndex === active.columnIndex
  }

  function isRangeEndCell(row: DataGridRowNode<TRow>, columnKey: string): boolean {
    const range = options.resolveSelectionRange()
    if (!range) {
      return false
    }
    const indexes = resolveRowColumn(row, columnKey)
    if (!indexes) {
      return false
    }
    return indexes.rowIndex === range.endRow && indexes.columnIndex === range.endColumn
  }

  function isCellInFillPreview(row: DataGridRowNode<TRow>, columnKey: string): boolean {
    const preview = options.resolveFillPreviewRange()
    if (!options.isFillDragging() || !preview) {
      return false
    }
    const indexes = resolveRowColumn(row, columnKey)
    if (!indexes) {
      return false
    }
    if (!options.isCellWithinRange(indexes.rowIndex, indexes.columnIndex, preview)) {
      return false
    }
    const base = options.resolveFillBaseRange()
    if (!base) {
      return true
    }
    return !options.isCellWithinRange(indexes.rowIndex, indexes.columnIndex, base)
  }

  function isCellInMovePreview(row: DataGridRowNode<TRow>, columnKey: string): boolean {
    const preview = options.resolveMovePreviewRange()
    if (!options.isRangeMoving() || !preview) {
      return false
    }
    const indexes = resolveRowColumn(row, columnKey)
    if (!indexes) {
      return false
    }
    if (!options.isCellWithinRange(indexes.rowIndex, indexes.columnIndex, preview)) {
      return false
    }
    const base = options.resolveMoveBaseRange()
    if (!base) {
      return true
    }
    return !options.isCellWithinRange(indexes.rowIndex, indexes.columnIndex, base)
  }

  function shouldShowFillHandle(row: DataGridRowNode<TRow>, columnKey: string): boolean {
    if (options.isFillDragging()) {
      return false
    }
    if (options.isInlineEditorOpen?.()) {
      return false
    }
    return isRangeEndCell(row, columnKey)
  }

  return {
    isCellInSelection,
    isCellInCopiedRange,
    isAnchorCell,
    isActiveCell,
    isRangeEndCell,
    isCellInFillPreview,
    isCellInMovePreview,
    shouldShowFillHandle,
  }
}
