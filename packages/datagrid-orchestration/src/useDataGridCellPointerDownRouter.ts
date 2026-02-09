export interface DataGridCellPointerCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridCellPointerRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface UseDataGridCellPointerDownRouterOptions<
  TRow,
  TCoord extends DataGridCellPointerCoord = DataGridCellPointerCoord,
  TRange extends DataGridCellPointerRange = DataGridCellPointerRange,
> {
  isSelectionColumn: (columnKey: string) => boolean
  isRangeMoveModifierActive: (event: MouseEvent) => boolean
  isEditorInteractionTarget: (target: HTMLElement | null) => boolean
  hasInlineEditor: () => boolean
  commitInlineEdit: () => boolean
  resolveCellCoord: (row: TRow, columnKey: string) => TCoord | null
  resolveSelectionRange: () => TRange | null
  isCoordInsideRange: (coord: TCoord, range: TRange) => boolean
  startRangeMove: (coord: TCoord, pointer: { clientX: number; clientY: number }) => void
  closeContextMenu: () => void
  focusViewport: () => void
  isFillDragging: () => boolean
  stopFillSelection: (commit: boolean) => void
  setDragSelecting: (value: boolean) => void
  setLastDragCoord: (coord: TCoord) => void
  setDragPointer: (pointer: { clientX: number; clientY: number }) => void
  applyCellSelection: (coord: TCoord, extend: boolean, fallbackAnchor?: TCoord) => void
  startInteractionAutoScroll: () => void
  setLastAction: (message: string) => void
}

export interface UseDataGridCellPointerDownRouterResult<
  TRow,
> {
  dispatchCellPointerDown: (row: TRow, columnKey: string, event: MouseEvent) => boolean
}

export function useDataGridCellPointerDownRouter<
  TRow,
  TCoord extends DataGridCellPointerCoord = DataGridCellPointerCoord,
  TRange extends DataGridCellPointerRange = DataGridCellPointerRange,
>(
  options: UseDataGridCellPointerDownRouterOptions<TRow, TCoord, TRange>,
): UseDataGridCellPointerDownRouterResult<TRow> {
  function dispatchCellPointerDown(row: TRow, columnKey: string, event: MouseEvent): boolean {
    if (options.isSelectionColumn(columnKey)) {
      return false
    }

    const allowModifierSecondaryButton = options.isRangeMoveModifierActive(event) && event.button === 2
    if (event.button !== 0 && !allowModifierSecondaryButton) {
      return false
    }

    const targetNode = event.target as HTMLElement | null
    if (options.isEditorInteractionTarget(targetNode)) {
      return false
    }

    if (options.hasInlineEditor()) {
      options.commitInlineEdit()
    }

    const coord = options.resolveCellCoord(row, columnKey)
    if (!coord) {
      return false
    }

    const currentRange = options.resolveSelectionRange()
    if (
      options.isRangeMoveModifierActive(event) &&
      currentRange &&
      options.isCoordInsideRange(coord, currentRange)
    ) {
      event.preventDefault()
      options.startRangeMove(coord, { clientX: event.clientX, clientY: event.clientY })
      return true
    }

    event.preventDefault()
    options.closeContextMenu()
    options.focusViewport()

    if (options.isFillDragging()) {
      options.stopFillSelection(false)
    }

    options.setDragSelecting(true)
    options.setLastDragCoord(coord)
    options.setDragPointer({ clientX: event.clientX, clientY: event.clientY })
    options.applyCellSelection(coord, event.shiftKey, coord)
    options.startInteractionAutoScroll()

    options.setLastAction(
      event.shiftKey
        ? `Extended selection to R${coord.rowIndex + 1} · ${columnKey}`
        : `Anchor set: R${coord.rowIndex + 1} · ${columnKey}`,
    )
    return true
  }

  return {
    dispatchCellPointerDown,
  }
}
