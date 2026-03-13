export interface DataGridRangeMoveStartCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridRangeMoveStartRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface DataGridRangeMoveStartPointer {
  clientX: number
  clientY: number
}

export interface UseDataGridRangeMoveStartOptions<
  TCoord extends DataGridRangeMoveStartCoord,
  TRange extends DataGridRangeMoveStartRange,
> {
  resolveSelectionRange: () => TRange | null
  isCoordInsideRange: (coord: TCoord, range: TRange) => boolean
  closeContextMenu: () => void
  focusViewport: () => void
  stopDragSelection: () => void
  stopFillSelection: (applyPreview: boolean) => void
  setRangeMoving: (value: boolean) => void
  setRangeMovePointer: (pointer: DataGridRangeMoveStartPointer) => void
  setRangeMoveBaseRange: (range: TRange) => void
  setRangeMoveOrigin: (coord: TCoord) => void
  setRangeMovePreviewRange: (range: TRange) => void
  startInteractionAutoScroll: () => void
  setLastAction: (message: string) => void
}

export interface UseDataGridRangeMoveStartResult<
  TCoord extends DataGridRangeMoveStartCoord,
> {
  startRangeMove: (coord: TCoord, pointer: DataGridRangeMoveStartPointer) => boolean
}

export function useDataGridRangeMoveStart<
  TCoord extends DataGridRangeMoveStartCoord,
  TRange extends DataGridRangeMoveStartRange,
>(
  options: UseDataGridRangeMoveStartOptions<TCoord, TRange>,
): UseDataGridRangeMoveStartResult<TCoord> {
  function startRangeMove(coord: TCoord, pointer: DataGridRangeMoveStartPointer): boolean {
    const currentRange = options.resolveSelectionRange()
    if (!currentRange || !options.isCoordInsideRange(coord, currentRange)) {
      return false
    }
    options.closeContextMenu()
    options.focusViewport()
    options.stopDragSelection()
    options.stopFillSelection(false)
    options.setRangeMoving(true)
    options.setRangeMovePointer({ clientX: pointer.clientX, clientY: pointer.clientY })
    options.setRangeMoveBaseRange({ ...currentRange })
    options.setRangeMoveOrigin(coord)
    options.setRangeMovePreviewRange({ ...currentRange })
    options.startInteractionAutoScroll()
    options.setLastAction("Move preview active")
    return true
  }

  return {
    startRangeMove,
  }
}
