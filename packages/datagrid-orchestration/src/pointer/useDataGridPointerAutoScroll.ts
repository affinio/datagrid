import type { DataGridPointerCoordinates } from "../internal/dataGridPointerContracts"
import { resolveAnimationFrameScheduler } from "../internal/browserAnimationFrame"
import {
  isDataGridPointerInteractionActive,
  resolveDataGridActiveInteractionKind,
  resolveDataGridActiveInteractionPointer,
} from "../internal/dataGridPointerInteractionState"

export interface DataGridPointerAutoScrollInteractionState {
  isDragSelecting: boolean
  isFillDragging: boolean
  isRangeMoving: boolean
}

export interface DataGridPointerAutoScrollPosition {
  top: number
  left: number
}

export interface UseDataGridPointerAutoScrollOptions {
  resolveInteractionState: () => DataGridPointerAutoScrollInteractionState
  resolveRangeMovePointer: () => DataGridPointerCoordinates | null
  resolveFillPointer: () => DataGridPointerCoordinates | null
  resolveDragPointer: () => DataGridPointerCoordinates | null
  resolveAllowHorizontalAutoScroll?: () => boolean
  resolveViewportElement: () => HTMLElement | null
  resolveHeaderHeight: () => number
  resolveAxisAutoScrollDelta: (pointer: number, min: number, max: number) => number
  setScrollPosition: (next: DataGridPointerAutoScrollPosition) => void
  applyRangeMovePreviewFromPointer: () => void
  applyFillPreviewFromPointer: () => void
  applyDragSelectionFromPointer: () => void
  onFrameSample?: (sample: {
    activeKind: "drag" | "fill" | "range" | null
    totalMs: number
    deltaX: number
    deltaY: number
    scrolled: boolean
  }) => void
  requestAnimationFrame?: (callback: FrameRequestCallback) => number
  cancelAnimationFrame?: (handle: number) => void
}

export interface UseDataGridPointerAutoScrollResult {
  startInteractionAutoScroll: () => void
  stopAutoScrollFrameIfIdle: () => void
  dispose: () => void
}

export function useDataGridPointerAutoScroll(
  options: UseDataGridPointerAutoScrollOptions,
): UseDataGridPointerAutoScrollResult {
  const scheduler = resolveAnimationFrameScheduler({
    requestAnimationFrame: options.requestAnimationFrame,
    cancelAnimationFrame: options.cancelAnimationFrame,
  })

  let frameHandle: number | null = null

  const now = (): number => {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now()
    }
    return Date.now()
  }

  const runFrame = () => {
    const startedAt = options.onFrameSample ? now() : 0
    const interactionState = options.resolveInteractionState()
    if (!isDataGridPointerInteractionActive(interactionState)) {
      frameHandle = null
      return
    }

    const viewport = options.resolveViewportElement()
    const pointer = resolveDataGridActiveInteractionPointer(options, interactionState)
    let activeKind: "drag" | "fill" | "range" | null = null
    let frameDeltaX = 0
    let frameDeltaY = 0
    let scrolled = false
    if (viewport && pointer) {
      const rect = viewport.getBoundingClientRect()
      const topBoundary = rect.top + options.resolveHeaderHeight()
      const deltaY = options.resolveAxisAutoScrollDelta(pointer.clientY, topBoundary, rect.bottom)
      const allowHorizontalAutoScroll = options.resolveAllowHorizontalAutoScroll?.() ?? true
      const deltaX = !allowHorizontalAutoScroll || pointer.clientX < rect.left || pointer.clientX > rect.right
        ? 0
        : options.resolveAxisAutoScrollDelta(pointer.clientX, rect.left, rect.right)
      frameDeltaX = deltaX
      frameDeltaY = deltaY

      if (deltaX !== 0 || deltaY !== 0) {
        const currentTop = viewport.scrollTop
        const currentLeft = viewport.scrollLeft
        const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
        const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
        const nextTop = Math.max(0, Math.min(maxScrollTop, currentTop + deltaY))
        const nextLeft = Math.max(0, Math.min(maxScrollLeft, currentLeft + deltaX))

        if (nextTop !== currentTop) {
          viewport.scrollTop = nextTop
        }
        if (nextLeft !== currentLeft) {
          viewport.scrollLeft = nextLeft
        }

        options.setScrollPosition({
          top: nextTop,
          left: nextLeft,
        })
        scrolled = nextTop !== currentTop || nextLeft !== currentLeft
      }

      activeKind = resolveDataGridActiveInteractionKind(interactionState)
      if (activeKind === "range") {
        options.applyRangeMovePreviewFromPointer()
      } else if (activeKind === "fill") {
        options.applyFillPreviewFromPointer()
      } else if (activeKind === "drag") {
        options.applyDragSelectionFromPointer()
      }
    }
    options.onFrameSample?.({
      activeKind,
      totalMs: Math.max(0, now() - startedAt),
      deltaX: frameDeltaX,
      deltaY: frameDeltaY,
      scrolled,
    })

    frameHandle = scheduler.requestFrame(runFrame)
  }

  function startInteractionAutoScroll() {
    if (frameHandle !== null) {
      return
    }
    frameHandle = scheduler.requestFrame(runFrame)
  }

  function stopAutoScrollFrameIfIdle() {
    if (!isDataGridPointerInteractionActive(options.resolveInteractionState()) && frameHandle !== null) {
      scheduler.cancelFrame(frameHandle)
      frameHandle = null
    }
  }

  function dispose() {
    if (frameHandle === null) {
      return
    }
    scheduler.cancelFrame(frameHandle)
    frameHandle = null
  }

  return {
    startInteractionAutoScroll,
    stopAutoScrollFrameIfIdle,
    dispose,
  }
}
