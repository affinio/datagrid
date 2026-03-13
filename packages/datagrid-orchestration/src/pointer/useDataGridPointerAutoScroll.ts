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

  const runFrame = () => {
    const interactionState = options.resolveInteractionState()
    if (!isDataGridPointerInteractionActive(interactionState)) {
      frameHandle = null
      return
    }

    const viewport = options.resolveViewportElement()
    const pointer = resolveDataGridActiveInteractionPointer(options, interactionState)
    if (viewport && pointer) {
      const rect = viewport.getBoundingClientRect()
      const topBoundary = rect.top + options.resolveHeaderHeight()
      const deltaY = options.resolveAxisAutoScrollDelta(pointer.clientY, topBoundary, rect.bottom)
      const allowHorizontalAutoScroll = options.resolveAllowHorizontalAutoScroll?.() ?? true
      const deltaX = !allowHorizontalAutoScroll || pointer.clientX < rect.left || pointer.clientX > rect.right
        ? 0
        : options.resolveAxisAutoScrollDelta(pointer.clientX, rect.left, rect.right)

      if (deltaX !== 0 || deltaY !== 0) {
        const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
        const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
        const nextTop = Math.max(0, Math.min(maxScrollTop, viewport.scrollTop + deltaY))
        const nextLeft = Math.max(0, Math.min(maxScrollLeft, viewport.scrollLeft + deltaX))

        if (nextTop !== viewport.scrollTop) {
          viewport.scrollTop = nextTop
        }
        if (nextLeft !== viewport.scrollLeft) {
          viewport.scrollLeft = nextLeft
        }

        options.setScrollPosition({
          top: viewport.scrollTop,
          left: viewport.scrollLeft,
        })
      }

      const activeKind = resolveDataGridActiveInteractionKind(interactionState)
      if (activeKind === "range") {
        options.applyRangeMovePreviewFromPointer()
      } else if (activeKind === "fill") {
        options.applyFillPreviewFromPointer()
      } else if (activeKind === "drag") {
        options.applyDragSelectionFromPointer()
      }
    }

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
