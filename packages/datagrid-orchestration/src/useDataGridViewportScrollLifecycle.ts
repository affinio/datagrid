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
  scrollUpdateMode?: "sync" | "raf"
  requestAnimationFrame?: (callback: FrameRequestCallback) => number
  cancelAnimationFrame?: (handle: number) => void
}

export interface UseDataGridViewportScrollLifecycleResult {
  onViewportScroll: (event: Event) => void
  flushPendingScroll: () => void
  dispose: () => void
}

export function useDataGridViewportScrollLifecycle(
  options: UseDataGridViewportScrollLifecycleOptions,
): UseDataGridViewportScrollLifecycleResult {
  const scrollUpdateMode = options.scrollUpdateMode ?? "sync"
  const requestFrame = options.requestAnimationFrame ?? (callback => window.requestAnimationFrame(callback))
  const cancelFrame = options.cancelAnimationFrame ?? (handle => window.cancelAnimationFrame(handle))

  let pendingTop: number | null = null
  let pendingLeft: number | null = null
  let pendingCloseContextMenu = false
  let pendingCommitInlineEdit = false
  let pendingFrame: number | null = null

  function flushPendingScroll(): void {
    if (pendingCloseContextMenu) {
      pendingCloseContextMenu = false
      if (options.isContextMenuVisible()) {
        options.closeContextMenu()
      }
    }

    if (pendingTop !== null) {
      const nextTop = pendingTop
      pendingTop = null
      if (nextTop !== options.resolveScrollTop()) {
        options.setScrollTop(nextTop)
      }
    }

    if (pendingLeft !== null) {
      const nextLeft = pendingLeft
      pendingLeft = null
      if (nextLeft !== options.resolveScrollLeft()) {
        options.setScrollLeft(nextLeft)
      }
    }

    if (pendingCommitInlineEdit) {
      pendingCommitInlineEdit = false
      if (options.hasInlineEditor()) {
        options.commitInlineEdit()
      }
    }
  }

  function scheduleFlush(): void {
    if (pendingFrame !== null) {
      return
    }
    pendingFrame = requestFrame(() => {
      pendingFrame = null
      flushPendingScroll()
    })
  }

  function dispose(): void {
    if (pendingFrame !== null) {
      cancelFrame(pendingFrame)
      pendingFrame = null
    }
    pendingTop = null
    pendingLeft = null
    pendingCloseContextMenu = false
    pendingCommitInlineEdit = false
  }

  function onViewportScroll(event: Event): void {
    const target = event.currentTarget as HTMLElement | null
    if (!target) {
      return
    }
    const shouldCloseContextMenu = options.shouldCloseContextMenuOnScroll
      ? options.shouldCloseContextMenuOnScroll()
      : true
    if (options.isContextMenuVisible() && shouldCloseContextMenu) {
      pendingCloseContextMenu = true
    }

    pendingTop = target.scrollTop
    pendingLeft = target.scrollLeft

    if (options.hasInlineEditor()) {
      pendingCommitInlineEdit = true
    }

    if (scrollUpdateMode === "raf") {
      scheduleFlush()
      return
    }

    flushPendingScroll()
  }

  return {
    onViewportScroll,
    flushPendingScroll,
    dispose,
  }
}
