import type { DataGridPointerCoordinates } from "./dataGridPointerContracts"

export interface DataGridPointerInteractionState {
  isRangeMoving: boolean
  isColumnResizing: boolean
  isFillDragging: boolean
  isDragSelecting: boolean
}

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
}

export interface UseDataGridGlobalPointerLifecycleResult {
  finalizePointerInteractions: (pointer?: DataGridPointerCoordinates, commit?: boolean) => void
  dispatchGlobalMouseMove: (event: MouseEvent) => boolean
  dispatchGlobalMouseUp: (event: MouseEvent) => boolean
  dispatchGlobalPointerUp: (event: PointerEvent) => boolean
  dispatchGlobalPointerCancel: () => boolean
  dispatchGlobalContextMenuCapture: (event: MouseEvent) => boolean
  dispatchGlobalWindowBlur: () => boolean
}

function hasAnyInteraction(state: DataGridPointerInteractionState): boolean {
  return state.isRangeMoving || state.isColumnResizing || state.isFillDragging || state.isDragSelecting
}

function syncPointerIfChanged(
  current: DataGridPointerCoordinates | null,
  next: DataGridPointerCoordinates,
  apply: (pointer: DataGridPointerCoordinates) => void,
) {
  if (!current || current.clientX !== next.clientX || current.clientY !== next.clientY) {
    apply(next)
  }
}

export function useDataGridGlobalPointerLifecycle(
  options: UseDataGridGlobalPointerLifecycleOptions,
): UseDataGridGlobalPointerLifecycleResult {
  function finalizePointerInteractions(pointer?: DataGridPointerCoordinates, commit = true) {
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
      if (pointer) {
        options.setDragPointer(pointer)
        options.applyDragSelectionFromPointer()
      }
      options.stopDragSelection()
    }
  }

  function dispatchGlobalMouseMove(event: MouseEvent): boolean {
    const state = options.resolveInteractionState()
    if (event.buttons === 0 && hasAnyInteraction(state)) {
      finalizePointerInteractions({ clientX: event.clientX, clientY: event.clientY }, true)
      return true
    }

    if (state.isRangeMoving) {
      syncPointerIfChanged(
        options.resolveRangeMovePointer(),
        { clientX: event.clientX, clientY: event.clientY },
        options.setRangeMovePointer,
      )
      options.applyRangeMovePreviewFromPointer()
      return true
    }

    if (state.isColumnResizing) {
      options.applyColumnResizeFromPointer(event.clientX)
      return true
    }

    if (state.isFillDragging) {
      syncPointerIfChanged(
        options.resolveFillPointer(),
        { clientX: event.clientX, clientY: event.clientY },
        options.setFillPointer,
      )
      options.applyFillPreviewFromPointer()
      return true
    }

    if (!state.isDragSelecting) {
      return false
    }

    syncPointerIfChanged(
      options.resolveDragPointer(),
      { clientX: event.clientX, clientY: event.clientY },
      options.setDragPointer,
    )
    options.applyDragSelectionFromPointer()
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
    if (!hasAnyInteraction(options.resolveInteractionState())) {
      return false
    }
    event.preventDefault()
    finalizePointerInteractions({ clientX: event.clientX, clientY: event.clientY }, true)
    return true
  }

  function dispatchGlobalWindowBlur(): boolean {
    if (!hasAnyInteraction(options.resolveInteractionState())) {
      return false
    }
    finalizePointerInteractions(undefined, false)
    return true
  }

  return {
    finalizePointerInteractions,
    dispatchGlobalMouseMove,
    dispatchGlobalMouseUp,
    dispatchGlobalPointerUp,
    dispatchGlobalPointerCancel,
    dispatchGlobalContextMenuCapture,
    dispatchGlobalWindowBlur,
  }
}
