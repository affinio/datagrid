export interface UseDataGridViewportBlurHandlerOptions {
  resolveViewportElement: () => HTMLElement | null
  resolveContextMenuElement: () => HTMLElement | null
  stopDragSelection: () => void
  stopFillSelection: (commit: boolean) => void
  stopRangeMove: (commit: boolean) => void
  stopColumnResize: () => void
  closeContextMenu: () => void
  hasInlineEditor: () => boolean
  commitInlineEdit: () => boolean
}

export interface UseDataGridViewportBlurHandlerResult {
  handleViewportBlur: (event: FocusEvent) => boolean
}

export function useDataGridViewportBlurHandler(
  options: UseDataGridViewportBlurHandlerOptions,
): UseDataGridViewportBlurHandlerResult {
  function handleViewportBlur(event: FocusEvent): boolean {
    const viewport = options.resolveViewportElement()
    const nextFocused = event.relatedTarget as Node | null
    if (viewport && nextFocused && viewport.contains(nextFocused)) {
      return false
    }

    const menu = options.resolveContextMenuElement()
    if (nextFocused && menu?.contains(nextFocused)) {
      return false
    }

    options.stopDragSelection()
    options.stopFillSelection(false)
    options.stopRangeMove(false)
    options.stopColumnResize()
    options.closeContextMenu()
    if (options.hasInlineEditor()) {
      options.commitInlineEdit()
    }
    return true
  }

  return {
    handleViewportBlur,
  }
}
