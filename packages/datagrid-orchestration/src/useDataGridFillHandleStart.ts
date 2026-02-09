export interface DataGridFillHandleStartRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface UseDataGridFillHandleStartOptions<
  TRange extends DataGridFillHandleStartRange = DataGridFillHandleStartRange,
> {
  resolveSelectionRange: () => TRange | null
  focusViewport: () => void
  stopRangeMove: (applyPreview: boolean) => void
  setDragSelecting: (value: boolean) => void
  setDragPointer: (pointer: { clientX: number; clientY: number } | null) => void
  setFillDragging: (value: boolean) => void
  setFillBaseRange: (range: TRange | null) => void
  setFillPreviewRange: (range: TRange | null) => void
  setFillPointer: (pointer: { clientX: number; clientY: number } | null) => void
  startInteractionAutoScroll: () => void
  setLastAction: (message: string) => void
}

export interface UseDataGridFillHandleStartResult {
  onSelectionHandleMouseDown: (event: MouseEvent) => boolean
}

export function useDataGridFillHandleStart<
  TRange extends DataGridFillHandleStartRange = DataGridFillHandleStartRange,
>(
  options: UseDataGridFillHandleStartOptions<TRange>,
): UseDataGridFillHandleStartResult {
  function onSelectionHandleMouseDown(event: MouseEvent): boolean {
    if (event.button !== 0) {
      return false
    }
    const currentRange = options.resolveSelectionRange()
    if (!currentRange) {
      return false
    }

    event.preventDefault()
    event.stopPropagation()
    options.focusViewport()
    options.stopRangeMove(false)
    options.setDragSelecting(false)
    options.setDragPointer(null)
    options.setFillDragging(true)
    options.setFillBaseRange({ ...currentRange })
    options.setFillPreviewRange({ ...currentRange })
    options.setFillPointer({ clientX: event.clientX, clientY: event.clientY })
    options.startInteractionAutoScroll()
    options.setLastAction("Fill handle active")
    return true
  }

  return {
    onSelectionHandleMouseDown,
  }
}
