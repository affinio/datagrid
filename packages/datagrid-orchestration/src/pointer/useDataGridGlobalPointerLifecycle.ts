import type { DataGridPointerCoordinates } from "../internal/dataGridPointerContracts"
import { resolveAnimationFrameScheduler } from "../internal/browserAnimationFrame"
import {
  hasAnyDataGridPointerInteraction,
  syncDataGridPointerIfChanged,
} from "../internal/dataGridPointerInteractionState"

export interface DataGridPointerInteractionState {
  isRangeMoving: boolean
  isColumnResizing: boolean
  isFillDragging: boolean
  isDragSelecting: boolean
}

export type DataGridPointerPreviewApplyMode = "sync" | "raf"

export interface UseDataGridGlobalPointerLifecycleOptions {
  resolveInteractionState: () => DataGridPointerInteractionState

  resolveRangeMovePointer: () => DataGridPointerCoordinates | null
  setRangeMovePointer: (pointer: DataGridPointerCoordinates) => void
  applyRangeMovePreviewFromPointer: () => void
  stopRangeMove: (commit: boolean) => void

  applyColumnResizeFromPointer: (clientX: number) => void
  stopColumnResize: () => void

  resolveFillPointer: () => DataGridPointerCoordinates | null
  setFillPointer: (pointer: DataGridPointerCoordinates) => void
  applyFillPreviewFromPointer: () => void
  stopFillSelection: (commit: boolean) => void

  resolveDragPointer: () => DataGridPointerCoordinates | null
  setDragPointer: (pointer: DataGridPointerCoordinates) => void
  applyDragSelectionFromPointer: () => void
  stopDragSelection: () => void

  pointerPreviewApplyMode?: DataGridPointerPreviewApplyMode
  requestAnimationFrame?: (callback: FrameRequestCallback) => number
  cancelAnimationFrame?: (handle: number) => void
}

export interface UseDataGridGlobalPointerLifecycleResult {
  finalizePointerInteractions: (pointer?: DataGridPointerCoordinates, commit?: boolean) => void
  dispatchGlobalMouseMove: (event: MouseEvent) => boolean
  dispatchGlobalMouseUp: (event: MouseEvent) => boolean
  dispatchGlobalPointerUp: (event: PointerEvent) => boolean
  dispatchGlobalPointerCancel: () => boolean
  dispatchGlobalContextMenuCapture: (event: MouseEvent) => boolean
  dispatchGlobalWindowBlur: () => boolean
  dispose: () => void
}

export function useDataGridGlobalPointerLifecycle(
  options: UseDataGridGlobalPointerLifecycleOptions,
): UseDataGridGlobalPointerLifecycleResult {
  const pointerPreviewApplyMode = options.pointerPreviewApplyMode ?? "sync"
  const scheduler = resolveAnimationFrameScheduler({
    requestAnimationFrame: options.requestAnimationFrame,
    cancelAnimationFrame: options.cancelAnimationFrame,
  })

  let pendingPreviewFrame: number | null = null
  let pendingPreviewKind: "range" | "fill" | "drag" | null = null

  function canUseRaf(): boolean {
    return pointerPreviewApplyMode === "raf" && scheduler.usesAnimationFrame
  }

  function clearPendingPreview() {
    pendingPreviewKind = null
    if (pendingPreviewFrame === null) {
      return
    }
    scheduler.cancelFrame(pendingPreviewFrame)
    pendingPreviewFrame = null
  }

  function applyPreview(kind: "range" | "fill" | "drag") {
    if (kind === "range") {
      options.applyRangeMovePreviewFromPointer()
      return
    }
    if (kind === "fill") {
      options.applyFillPreviewFromPointer()
      return
    }
    options.applyDragSelectionFromPointer()
  }

  function flushPendingPreview() {
    pendingPreviewFrame = null
    const kind = pendingPreviewKind
    pendingPreviewKind = null
    if (!kind) {
      return
    }
    applyPreview(kind)
  }

  function schedulePreview(kind: "range" | "fill" | "drag") {
    if (!canUseRaf()) {
      applyPreview(kind)
      return
    }
    pendingPreviewKind = kind
    if (pendingPreviewFrame !== null) {
      return
    }
    pendingPreviewFrame = scheduler.requestFrame(() => flushPendingPreview())
  }

  function finalizePointerInteractions(pointer?: DataGridPointerCoordinates, commit = true) {
    clearPendingPreview()
    const state = options.resolveInteractionState()

    if (state.isRangeMoving) {
      if (pointer) {
        options.setRangeMovePointer(pointer)
        options.applyRangeMovePreviewFromPointer()
      }
      options.stopRangeMove(commit)
    }

    if (state.isColumnResizing) {
      options.stopColumnResize()
    }

    if (state.isFillDragging) {
      if (pointer) {
        options.setFillPointer(pointer)
        options.applyFillPreviewFromPointer()
      }
      options.stopFillSelection(commit)
    }

    if (state.isDragSelecting) {
      // Drag-selection preview is already updated on pointer move/enter events.
      // Re-applying by release coordinates is brittle when layout shifts.
      options.stopDragSelection()
    }
  }

  function dispatchGlobalMouseMove(event: MouseEvent): boolean {
    const state = options.resolveInteractionState()
    if (event.buttons === 0 && hasAnyDataGridPointerInteraction(state)) {
      // Fallback path when mouseup/pointerup was not observed.
      // Keep the final pointer for move/fill/resize flows; drag-selection no
      // longer re-applies from release coordinates in finalize.
      finalizePointerInteractions({ clientX: event.clientX, clientY: event.clientY }, true)
      return true
    }

    if (state.isRangeMoving) {
      syncDataGridPointerIfChanged(
        options.resolveRangeMovePointer(),
        { clientX: event.clientX, clientY: event.clientY },
        options.setRangeMovePointer,
      )
      schedulePreview("range")
      return true
    }

    if (state.isColumnResizing) {
      options.applyColumnResizeFromPointer(event.clientX)
      return true
    }

    if (state.isFillDragging) {
      syncDataGridPointerIfChanged(
        options.resolveFillPointer(),
        { clientX: event.clientX, clientY: event.clientY },
        options.setFillPointer,
      )
      schedulePreview("fill")
      return true
    }

    if (!state.isDragSelecting) {
      return false
    }

    syncDataGridPointerIfChanged(
      options.resolveDragPointer(),
      { clientX: event.clientX, clientY: event.clientY },
      options.setDragPointer,
    )
    schedulePreview("drag")
    return true
  }

  function dispatchGlobalMouseUp(event: MouseEvent): boolean {
    finalizePointerInteractions({ clientX: event.clientX, clientY: event.clientY }, true)
    return true
  }

  function dispatchGlobalPointerUp(event: PointerEvent): boolean {
    finalizePointerInteractions({ clientX: event.clientX, clientY: event.clientY }, true)
    return true
  }

  function dispatchGlobalPointerCancel(): boolean {
    finalizePointerInteractions(undefined, false)
    return true
  }

  function dispatchGlobalContextMenuCapture(event: MouseEvent): boolean {
    if (!hasAnyDataGridPointerInteraction(options.resolveInteractionState())) {
      return false
    }
    event.preventDefault()
    finalizePointerInteractions({ clientX: event.clientX, clientY: event.clientY }, true)
    return true
  }

  function dispatchGlobalWindowBlur(): boolean {
    if (!hasAnyDataGridPointerInteraction(options.resolveInteractionState())) {
      return false
    }
    finalizePointerInteractions(undefined, false)
    return true
  }

  function dispose() {
    clearPendingPreview()
  }

  return {
    finalizePointerInteractions,
    dispatchGlobalMouseMove,
    dispatchGlobalMouseUp,
    dispatchGlobalPointerUp,
    dispatchGlobalPointerCancel,
    dispatchGlobalContextMenuCapture,
    dispatchGlobalWindowBlur,
    dispose,
  }
}
