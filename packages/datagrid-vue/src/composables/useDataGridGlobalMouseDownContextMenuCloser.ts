export interface UseDataGridGlobalMouseDownContextMenuCloserOptions {
  isContextMenuVisible: () => boolean
  resolveContextMenuElement: () => HTMLElement | null
  closeContextMenu: () => void
}

export interface UseDataGridGlobalMouseDownContextMenuCloserResult {
  dispatchGlobalMouseDown: (event: MouseEvent) => boolean
}

export function useDataGridGlobalMouseDownContextMenuCloser(
  options: UseDataGridGlobalMouseDownContextMenuCloserOptions,
): UseDataGridGlobalMouseDownContextMenuCloserResult {
  function dispatchGlobalMouseDown(event: MouseEvent): boolean {
    if (!options.isContextMenuVisible()) {
      return false
    }
    const target = event.target as Node | null
    const menu = options.resolveContextMenuElement()
    if (target && menu?.contains(target)) {
      return false
    }
    options.closeContextMenu()
    return true
  }

  return {
    dispatchGlobalMouseDown,
  }
}
