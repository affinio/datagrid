import { resolveAnimationFrameScheduler } from "../internal/browserAnimationFrame"
import {
  createDataGridPendingViewportScrollState,
  resolveDataGridPendingScrollFlushPlan,
  resolveDataGridPendingScrollUpdate,
} from "../internal/dataGridViewportState"

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
  const { requestFrame, cancelFrame } = resolveAnimationFrameScheduler({
    requestAnimationFrame: options.requestAnimationFrame,
    cancelAnimationFrame: options.cancelAnimationFrame,
  })

  let pendingState = createDataGridPendingViewportScrollState()
  let pendingFrame: number | null = null

  function flushPendingScroll(): void {
    const plan = resolveDataGridPendingScrollFlushPlan(
      pendingState,
      options.isContextMenuVisible(),
      options.hasInlineEditor(),
    )
    pendingState = plan.nextState

    if (plan.shouldCloseContextMenu) {
      options.closeContextMenu()
    }

    if (plan.nextTop !== null && plan.nextTop !== options.resolveScrollTop()) {
      options.setScrollTop(plan.nextTop)
    }

    if (plan.nextLeft !== null && plan.nextLeft !== options.resolveScrollLeft()) {
      options.setScrollLeft(plan.nextLeft)
    }

    if (plan.shouldCommitInlineEdit) {
      options.commitInlineEdit()
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
    pendingState = createDataGridPendingViewportScrollState()
  }

  function onViewportScroll(event: Event): void {
    const target = event.currentTarget as HTMLElement | null
    if (!target) {
      return
    }
    const shouldCloseContextMenu = options.shouldCloseContextMenuOnScroll
      ? options.shouldCloseContextMenuOnScroll()
      : true
    pendingState = resolveDataGridPendingScrollUpdate(pendingState, {
      scrollTop: target.scrollTop,
      scrollLeft: target.scrollLeft,
      isContextMenuVisible: options.isContextMenuVisible(),
      shouldCloseContextMenu,
      hasInlineEditor: options.hasInlineEditor(),
    })

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
