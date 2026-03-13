import { resolveAnimationFrameScheduler } from "../internal/browserAnimationFrame"
import {
  computeDataGridViewportMeasuredState,
  dataGridViewportStateEqual,
} from "../internal/dataGridViewportCalculations"

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
  const scheduler = resolveAnimationFrameScheduler({
    requestAnimationFrame: options.requestAnimationFrame,
    cancelAnimationFrame: options.cancelAnimationFrame,
  })
  const minViewportBodyHeight = options.minViewportBodyHeight ?? 200

  let frame: number | null = null
  let pending = false

  function syncViewportHeight() {
    const viewport = options.resolveViewportElement()
    if (!viewport) {
      return
    }

    const current = options.resolveCurrentState()
    const header = options.resolveHeaderElement()
    const measuredHeaderHeight = header
      ? Math.max(1, Math.round(header.getBoundingClientRect().height))
      : null
    const nextState = computeDataGridViewportMeasuredState({
      viewportClientHeight: viewport.clientHeight,
      viewportClientWidth: viewport.clientWidth,
      currentHeaderHeight: current.headerHeight,
      measuredHeaderHeight,
      rowHeight: options.rowHeight,
      minViewportBodyHeight,
    })

    if (dataGridViewportStateEqual(current, nextState)) {
      return
    }

    options.applyMeasuredState(nextState)
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
    if (!scheduler.usesAnimationFrame) {
      flushViewportMeasure()
      return
    }
    frame = scheduler.requestFrame(() => flushViewportMeasure())
  }

  function dispose() {
    if (frame === null) {
      pending = false
      return
    }
    scheduler.cancelFrame(frame)
    frame = null
    pending = false
  }

  return {
    syncViewportHeight,
    scheduleViewportMeasure,
    dispose,
  }
}
