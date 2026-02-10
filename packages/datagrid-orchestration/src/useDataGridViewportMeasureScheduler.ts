export interface DataGridViewportMeasuredState {
  viewportHeight: number
  viewportWidth: number
  headerHeight: number
}

export interface UseDataGridViewportMeasureSchedulerOptions {
  resolveViewportElement: () => HTMLElement | null
  resolveHeaderElement: () => HTMLElement | null
  resolveCurrentState: () => DataGridViewportMeasuredState
  applyMeasuredState: (next: DataGridViewportMeasuredState) => void
  rowHeight: number
  minViewportBodyHeight?: number
  requestAnimationFrame?: (callback: FrameRequestCallback) => number
  cancelAnimationFrame?: (handle: number) => void
}

export interface UseDataGridViewportMeasureSchedulerResult {
  syncViewportHeight: () => void
  scheduleViewportMeasure: () => void
  dispose: () => void
}

export function useDataGridViewportMeasureScheduler(
  options: UseDataGridViewportMeasureSchedulerOptions,
): UseDataGridViewportMeasureSchedulerResult {
  const requestFrame = options.requestAnimationFrame ?? (callback => window.requestAnimationFrame(callback))
  const cancelFrame = options.cancelAnimationFrame ?? (handle => window.cancelAnimationFrame(handle))
  const minViewportBodyHeight = options.minViewportBodyHeight ?? 200

  let frame: number | null = null
  let pending = false

  function syncViewportHeight() {
    const viewport = options.resolveViewportElement()
    if (!viewport) {
      return
    }

    const current = options.resolveCurrentState()
    const nextViewportHeight = Math.max(minViewportBodyHeight, viewport.clientHeight)
    const nextViewportWidth = viewport.clientWidth
    const header = options.resolveHeaderElement()
    const nextHeaderHeight = header
      ? Math.max(1, Math.round(header.getBoundingClientRect().height))
      : current.headerHeight

    if (
      nextViewportHeight === current.viewportHeight &&
      nextViewportWidth === current.viewportWidth &&
      nextHeaderHeight === current.headerHeight
    ) {
      return
    }

    options.applyMeasuredState({
      viewportHeight: nextViewportHeight,
      viewportWidth: nextViewportWidth,
      headerHeight: nextHeaderHeight,
    })
  }

  function flushViewportMeasure() {
    frame = null
    pending = false
    syncViewportHeight()
  }

  function scheduleViewportMeasure() {
    if (pending) {
      return
    }
    pending = true
    if (typeof window === "undefined") {
      flushViewportMeasure()
      return
    }
    frame = requestFrame(() => flushViewportMeasure())
  }

  function dispose() {
    if (frame === null) {
      pending = false
      return
    }
    cancelFrame(frame)
    frame = null
    pending = false
  }

  return {
    syncViewportHeight,
    scheduleViewportMeasure,
    dispose,
  }
}
