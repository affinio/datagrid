import type { Ref } from "vue"

export interface UseDataGridTableStageScrollSyncOptions {
  isColumnResizing: Ref<boolean>
  applyColumnResizeFromPointer: (clientX: number) => void
  stopColumnResize: () => void
  handleInteractionWindowMouseMove: (event: MouseEvent) => void
  handleInteractionWindowMouseUp: () => void
  handleInteractionWindowPointerUp: () => void
  handleInteractionWindowPointerCancel: () => void
  handleInteractionWindowBlur: () => void
  handleInteractionWindowContextMenuCapture: (event: MouseEvent) => boolean
}

export interface UseDataGridTableStageScrollSyncResult {
  handleWindowMouseMove: (event: MouseEvent) => void
  handleWindowPointerUp: (event: PointerEvent) => void
  handleWindowPointerCancel: (event: PointerEvent) => void
  handleWindowBlur: () => void
  handleWindowContextMenuCapture: (event: MouseEvent) => boolean
  handleWindowMouseUp: () => void
}

export function useDataGridTableStageScrollSync(
  options: UseDataGridTableStageScrollSyncOptions,
): UseDataGridTableStageScrollSyncResult {
  const handleWindowMouseMove = (event: MouseEvent): void => {
    if (options.isColumnResizing.value) {
      options.applyColumnResizeFromPointer(event.clientX)
      return
    }
    options.handleInteractionWindowMouseMove(event)
  }

  const handleWindowMouseUp = (): void => {
    options.stopColumnResize()
    options.handleInteractionWindowMouseUp()
  }

  const handleWindowPointerUp = (): void => {
    options.stopColumnResize()
    options.handleInteractionWindowPointerUp()
  }

  const handleWindowPointerCancel = (): void => {
    options.stopColumnResize()
    options.handleInteractionWindowPointerCancel()
  }

  const handleWindowBlur = (): void => {
    options.stopColumnResize()
    options.handleInteractionWindowBlur()
  }

  const handleWindowContextMenuCapture = (event: MouseEvent): boolean => {
    if (options.isColumnResizing.value) {
      event.preventDefault()
      options.stopColumnResize()
      options.handleInteractionWindowContextMenuCapture(event)
      return true
    }
    return options.handleInteractionWindowContextMenuCapture(event)
  }

  return {
    handleWindowMouseMove,
    handleWindowPointerUp,
    handleWindowPointerCancel,
    handleWindowBlur,
    handleWindowContextMenuCapture,
    handleWindowMouseUp,
  }
}
