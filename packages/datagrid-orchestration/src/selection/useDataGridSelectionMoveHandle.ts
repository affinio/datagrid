export interface DataGridSelectionMoveHandleCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridSelectionMoveHandleRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface DataGridSelectionMoveHandleSides {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

export interface UseDataGridSelectionMoveHandleOptions<
  TRow,
  TCoord extends DataGridSelectionMoveHandleCoord = DataGridSelectionMoveHandleCoord,
  TRange extends DataGridSelectionMoveHandleRange = DataGridSelectionMoveHandleRange,
> {
  resolveSelectionRange: () => TRange | null
  resolveRowIndex: (row: TRow) => number
  resolveColumnIndex: (columnKey: string) => number
  isCellWithinRange: (rowIndex: number, columnIndex: number, range: TRange) => boolean
  resolveCellCoord: (row: TRow, columnKey: string) => TCoord | null
  startRangeMove: (coord: TCoord, pointer: { clientX: number; clientY: number }) => boolean
  isRangeMoving: () => boolean
  isFillDragging: () => boolean
  isInlineEditorOpen: () => boolean
  selectColumnKey?: string
}

export interface UseDataGridSelectionMoveHandleResult<TRow> {
  getSelectionEdgeSides: (
    row: TRow,
    columnKey: string,
  ) => DataGridSelectionMoveHandleSides
  shouldShowSelectionMoveHandle: (
    row: TRow,
    columnKey: string,
    side: keyof DataGridSelectionMoveHandleSides,
  ) => boolean
  onSelectionMoveHandleMouseDown: (
    row: TRow,
    columnKey: string,
    event: MouseEvent,
  ) => boolean
}

const EMPTY_SIDES: DataGridSelectionMoveHandleSides = {
  top: false,
  right: false,
  bottom: false,
  left: false,
}

export function useDataGridSelectionMoveHandle<
  TRow,
  TCoord extends DataGridSelectionMoveHandleCoord = DataGridSelectionMoveHandleCoord,
  TRange extends DataGridSelectionMoveHandleRange = DataGridSelectionMoveHandleRange,
>(
  options: UseDataGridSelectionMoveHandleOptions<TRow, TCoord, TRange>,
): UseDataGridSelectionMoveHandleResult<TRow> {
  const selectColumnKey = options.selectColumnKey ?? "select"

  function getSelectionEdgeSides(
    row: TRow,
    columnKey: string,
  ): DataGridSelectionMoveHandleSides {
    const range = options.resolveSelectionRange()
    if (!range || columnKey === selectColumnKey) {
      return EMPTY_SIDES
    }
    const rowIndex = options.resolveRowIndex(row)
    const columnIndex = options.resolveColumnIndex(columnKey)
    if (columnIndex < 0 || !options.isCellWithinRange(rowIndex, columnIndex, range)) {
      return EMPTY_SIDES
    }
    return {
      top: rowIndex === range.startRow,
      right: columnIndex === range.endColumn,
      bottom: rowIndex === range.endRow,
      left: columnIndex === range.startColumn,
    }
  }

  function shouldShowSelectionMoveHandle(
    row: TRow,
    columnKey: string,
    side: keyof DataGridSelectionMoveHandleSides,
  ): boolean {
    if (options.isRangeMoving() || options.isFillDragging() || options.isInlineEditorOpen()) {
      return false
    }
    return getSelectionEdgeSides(row, columnKey)[side]
  }

  function onSelectionMoveHandleMouseDown(
    row: TRow,
    columnKey: string,
    event: MouseEvent,
  ): boolean {
    if (event.button !== 0) {
      return false
    }
    const coord = options.resolveCellCoord(row, columnKey)
    if (!coord) {
      return false
    }
    event.preventDefault()
    event.stopPropagation()
    return options.startRangeMove(coord, event)
  }

  return {
    getSelectionEdgeSides,
    shouldShowSelectionMoveHandle,
    onSelectionMoveHandleMouseDown,
  }
}
