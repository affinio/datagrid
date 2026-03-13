export interface DataGridCellPointerHoverCoord {
  rowIndex: number
  columnIndex: number
}

export interface UseDataGridCellPointerHoverRouterOptions<
  TRow,
  TCoord extends DataGridCellPointerHoverCoord = DataGridCellPointerHoverCoord,
> {
  isPrimaryPointerPressed?: (event: MouseEvent) => boolean
  hasInlineEditor: () => boolean
  isDragSelecting: () => boolean
  isSelectionColumn: (columnKey: string) => boolean
  resolveCellCoord: (row: TRow, columnKey: string) => TCoord | null
  resolveLastDragCoord: () => TCoord | null
  setLastDragCoord: (coord: TCoord) => void
  cellCoordsEqual: (a: TCoord | null, b: TCoord | null) => boolean
  setDragPointer: (pointer: { clientX: number; clientY: number }) => void
  applyCellSelection: (coord: TCoord, extend: boolean, fallbackAnchor?: TCoord, ensureVisible?: boolean) => void
}

export interface UseDataGridCellPointerHoverRouterResult<
  TRow,
> {
  dispatchCellPointerEnter: (row: TRow, columnKey: string, event: MouseEvent) => boolean
}

export function useDataGridCellPointerHoverRouter<
  TRow,
  TCoord extends DataGridCellPointerHoverCoord = DataGridCellPointerHoverCoord,
>(
  options: UseDataGridCellPointerHoverRouterOptions<TRow, TCoord>,
): UseDataGridCellPointerHoverRouterResult<TRow> {
  const isPrimaryPointerPressed = options.isPrimaryPointerPressed ?? ((event: MouseEvent) => (event.buttons & 1) === 1)

  function dispatchCellPointerEnter(row: TRow, columnKey: string, event: MouseEvent): boolean {
    if (options.hasInlineEditor() || !options.isDragSelecting() || options.isSelectionColumn(columnKey)) {
      return false
    }
    if (!isPrimaryPointerPressed(event)) {
      return false
    }

    const coord = options.resolveCellCoord(row, columnKey)
    if (!coord) {
      return false
    }
    if (options.cellCoordsEqual(options.resolveLastDragCoord(), coord)) {
      return false
    }

    options.setLastDragCoord(coord)
    options.setDragPointer({ clientX: event.clientX, clientY: event.clientY })
    options.applyCellSelection(coord, true, undefined, false)
    return true
  }

  return {
    dispatchCellPointerEnter,
  }
}
