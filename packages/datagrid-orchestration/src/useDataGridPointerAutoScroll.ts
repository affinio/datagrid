import type { DataGridPointerCoordinates } from "./dataGridPointerContracts"

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

function isPointerInteractionActive(state: DataGridPointerAutoScrollInteractionState): boolean {
  return state.isDragSelecting || state.isFillDragging || state.isRangeMoving
}

function resolveActiveInteractionPointer(
  options: UseDataGridPointerAutoScrollOptions,
  state: DataGridPointerAutoScrollInteractionState,
): DataGridPointerCoordinates | null {
  if (state.isRangeMoving) {
    return options.resolveRangeMovePointer()
  }
  if (state.isFillDragging) {
    return options.resolveFillPointer()
  }
  if (state.isDragSelecting) {
    return options.resolveDragPointer()
  }
  return null
}

export function useDataGridPointerAutoScroll(
  options: UseDataGridPointerAutoScrollOptions,
): UseDataGridPointerAutoScrollResult {
  const requestFrame = options.requestAnimationFrame ?? ((callback: FrameRequestCallback) => window.requestAnimationFrame(callback))
  const cancelFrame = options.cancelAnimationFrame ?? ((handle: number) => window.cancelAnimationFrame(handle))

  let frameHandle: number | null = null

  const runFrame = () => {
    const interactionState = options.resolveInteractionState()
    if (!isPointerInteractionActive(interactionState)) {
      frameHandle = null
      return
    }

    const viewport = options.resolveViewportElement()
    const pointer = resolveActiveInteractionPointer(options, interactionState)
    if (viewport && pointer) {
      const rect = viewport.getBoundingClientRect()
      const topBoundary = rect.top + options.resolveHeaderHeight()
      const deltaY = options.resolveAxisAutoScrollDelta(pointer.clientY, topBoundary, rect.bottom)
      const deltaX = options.resolveAxisAutoScrollDelta(pointer.clientX, rect.left, rect.right)

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

      if (interactionState.isRangeMoving) {
        options.applyRangeMovePreviewFromPointer()
      } else if (interactionState.isFillDragging) {
        options.applyFillPreviewFromPointer()
      } else if (interactionState.isDragSelecting) {
        options.applyDragSelectionFromPointer()
      }
    }

    frameHandle = requestFrame(runFrame)
  }

  function startInteractionAutoScroll() {
    if (frameHandle !== null) {
      return
    }
    frameHandle = requestFrame(runFrame)
  }

  function stopAutoScrollFrameIfIdle() {
    if (!isPointerInteractionActive(options.resolveInteractionState()) && frameHandle !== null) {
      cancelFrame(frameHandle)
      frameHandle = null
    }
  }

  function dispose() {
    if (frameHandle === null) {
      return
    }
    cancelFrame(frameHandle)
    frameHandle = null
  }

  return {
    startInteractionAutoScroll,
    stopAutoScrollFrameIfIdle,
    dispose,
  }
}
