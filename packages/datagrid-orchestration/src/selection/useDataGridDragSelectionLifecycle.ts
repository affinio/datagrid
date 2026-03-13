export interface UseDataGridDragSelectionLifecycleOptions<TCoord = { rowIndex: number; columnIndex: number }> {
  setDragSelecting: (value: boolean) => void
  clearDragPointer: () => void
  clearLastDragCoord: () => void
  stopAutoScrollFrameIfIdle: () => void
  resolveLastDragCoord?: () => TCoord | null
}

export interface UseDataGridDragSelectionLifecycleResult {
  stopDragSelection: () => void
}

export function useDataGridDragSelectionLifecycle<TCoord = { rowIndex: number; columnIndex: number }>(
  options: UseDataGridDragSelectionLifecycleOptions<TCoord>,
): UseDataGridDragSelectionLifecycleResult {
  function stopDragSelection() {
    options.setDragSelecting(false)
    options.clearDragPointer()
    options.clearLastDragCoord()
    options.stopAutoScrollFrameIfIdle()
  }

  return {
    stopDragSelection,
  }
}
