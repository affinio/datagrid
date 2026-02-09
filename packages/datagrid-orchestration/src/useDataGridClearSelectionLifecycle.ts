export interface UseDataGridClearSelectionLifecycleOptions<TCoord, TRange> {
  setCellAnchor: (coord: TCoord | null) => void
  setCellFocus: (coord: TCoord | null) => void
  setActiveCell: (coord: TCoord | null) => void
  setDragSelecting: (value: boolean) => void
  setFillDragging: (value: boolean) => void
  setDragPointer: (pointer: { clientX: number; clientY: number } | null) => void
  setFillPointer: (pointer: { clientX: number; clientY: number } | null) => void
  setFillBaseRange: (range: TRange | null) => void
  setFillPreviewRange: (range: TRange | null) => void
  clearLastDragCoord: () => void
  closeContextMenu: () => void
  stopRangeMove: (applyPreview: boolean) => void
  stopColumnResize: () => void
  stopAutoScrollFrameIfIdle: () => void
}

export interface UseDataGridClearSelectionLifecycleResult {
  clearCellSelection: () => void
}

export function useDataGridClearSelectionLifecycle<TCoord, TRange>(
  options: UseDataGridClearSelectionLifecycleOptions<TCoord, TRange>,
): UseDataGridClearSelectionLifecycleResult {
  function clearCellSelection(): void {
    options.setCellAnchor(null)
    options.setCellFocus(null)
    options.setActiveCell(null)
    options.setDragSelecting(false)
    options.setFillDragging(false)
    options.setDragPointer(null)
    options.setFillPointer(null)
    options.setFillBaseRange(null)
    options.setFillPreviewRange(null)
    options.clearLastDragCoord()
    options.closeContextMenu()
    options.stopRangeMove(false)
    options.stopColumnResize()
    options.stopAutoScrollFrameIfIdle()
  }

  return {
    clearCellSelection,
  }
}
