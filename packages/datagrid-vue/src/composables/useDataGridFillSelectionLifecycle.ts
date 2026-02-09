export interface UseDataGridFillSelectionLifecycleOptions<TRange = { startRow: number; endRow: number; startColumn: number; endColumn: number }> {
  applyFillPreview: () => void
  setFillDragging: (value: boolean) => void
  clearFillPointer: () => void
  clearFillBaseRange: () => void
  clearFillPreviewRange: () => void
  stopAutoScrollFrameIfIdle: () => void
  resolveFillPreviewRange?: () => TRange | null
}

export interface UseDataGridFillSelectionLifecycleResult {
  stopFillSelection: (applyPreview: boolean) => void
}

export function useDataGridFillSelectionLifecycle<TRange = { startRow: number; endRow: number; startColumn: number; endColumn: number }>(
  options: UseDataGridFillSelectionLifecycleOptions<TRange>,
): UseDataGridFillSelectionLifecycleResult {
  function stopFillSelection(applyPreview: boolean) {
    if (applyPreview) {
      options.applyFillPreview()
    }
    options.setFillDragging(false)
    options.clearFillPointer()
    options.clearFillBaseRange()
    options.clearFillPreviewRange()
    options.stopAutoScrollFrameIfIdle()
  }

  return {
    stopFillSelection,
  }
}
