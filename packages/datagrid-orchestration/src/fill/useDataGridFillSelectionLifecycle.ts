export interface UseDataGridFillSelectionLifecycleOptions<TRange = { startRow: number; endRow: number; startColumn: number; endColumn: number }> {
  applyFillPreview: () => void
  setFillDragging: (value: boolean) => void
  clearFillDragStartPointer: () => void
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
    const errors: unknown[] = []
    const runCleanup = (cleanup: () => void): void => {
      try { cleanup() } catch (error) { errors.push(error) }
    }
    try {
      if (applyPreview) options.applyFillPreview()
    } catch (error) {
      errors.push(error)
    } finally {
      runCleanup(() => options.setFillDragging(false))
      runCleanup(options.clearFillDragStartPointer)
      runCleanup(options.clearFillPointer)
      runCleanup(options.clearFillBaseRange)
      runCleanup(options.clearFillPreviewRange)
      runCleanup(options.stopAutoScrollFrameIfIdle)
    }
    if (errors.length > 0) {
      if (errors.length === 1) throw errors[0]
      throw Object.assign(new Error("[DataGridFill] finalization completed with errors."), { errors })
    }
  }

  return {
    stopFillSelection,
  }
}
