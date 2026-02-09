export interface UseDataGridRangeMoveLifecycleOptions {
  applyRangeMove: () => boolean
  setRangeMoving: (value: boolean) => void
  clearRangeMovePointer: () => void
  clearRangeMoveBaseRange: () => void
  clearRangeMoveOrigin: () => void
  clearRangeMovePreviewRange: () => void
  stopAutoScrollFrameIfIdle: () => void
  onApplyRangeMoveError?: (error: unknown) => void
}

export interface UseDataGridRangeMoveLifecycleResult {
  stopRangeMove: (applyPreview: boolean) => void
}

export function useDataGridRangeMoveLifecycle(
  options: UseDataGridRangeMoveLifecycleOptions,
): UseDataGridRangeMoveLifecycleResult {
  function stopRangeMove(applyPreview: boolean) {
    if (applyPreview) {
      try {
        options.applyRangeMove()
      } catch (error) {
        options.onApplyRangeMoveError?.(error)
      }
    }

    options.setRangeMoving(false)
    options.clearRangeMovePointer()
    options.clearRangeMoveBaseRange()
    options.clearRangeMoveOrigin()
    options.clearRangeMovePreviewRange()
    options.stopAutoScrollFrameIfIdle()
  }

  return {
    stopRangeMove,
  }
}
