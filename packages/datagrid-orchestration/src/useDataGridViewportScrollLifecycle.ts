export interface UseDataGridViewportScrollLifecycleOptions {
  isContextMenuVisible: () => boolean
  shouldCloseContextMenuOnScroll?: () => boolean
  closeContextMenu: () => void
  resolveScrollTop: () => number
  resolveScrollLeft: () => number
  setScrollTop: (value: number) => void
  setScrollLeft: (value: number) => void
  hasInlineEditor: () => boolean
  commitInlineEdit: () => void
}

export interface UseDataGridViewportScrollLifecycleResult {
  onViewportScroll: (event: Event) => void
}

export function useDataGridViewportScrollLifecycle(
  options: UseDataGridViewportScrollLifecycleOptions,
): UseDataGridViewportScrollLifecycleResult {
  function onViewportScroll(event: Event): void {
    const target = event.currentTarget as HTMLElement | null
    if (!target) {
      return
    }
    const shouldCloseContextMenu = options.shouldCloseContextMenuOnScroll
      ? options.shouldCloseContextMenuOnScroll()
      : true
    if (options.isContextMenuVisible() && shouldCloseContextMenu) {
      options.closeContextMenu()
    }
    const nextTop = target.scrollTop
    const nextLeft = target.scrollLeft
    if (nextTop !== options.resolveScrollTop()) {
      options.setScrollTop(nextTop)
    }
    if (nextLeft !== options.resolveScrollLeft()) {
      options.setScrollLeft(nextLeft)
    }
    if (options.hasInlineEditor()) {
      options.commitInlineEdit()
    }
  }

  return {
    onViewportScroll,
  }
}
