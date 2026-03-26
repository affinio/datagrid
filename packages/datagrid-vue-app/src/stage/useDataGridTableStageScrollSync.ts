import type { Ref } from "vue"

export interface UseDataGridTableStageScrollSyncOptions {
  bodyViewportRef: Ref<HTMLElement | null>
  isColumnResizing: Ref<boolean>
  applyColumnResizeFromPointer: (clientX: number) => void
  stopColumnResize: () => void
  handleInteractionWindowMouseMove: (event: MouseEvent) => void
  handleInteractionWindowMouseUp: () => void
  syncViewport: (event: Event) => void
}

export interface UseDataGridTableStageScrollSyncResult {
  handleWindowMouseMove: (event: MouseEvent) => void
  handleHeaderWheel: (event: WheelEvent) => void
  handleHeaderScroll: (event: Event) => void
  handleWindowMouseUp: () => void
}

export function useDataGridTableStageScrollSync(
  options: UseDataGridTableStageScrollSyncOptions,
): UseDataGridTableStageScrollSyncResult {
  const createSyntheticScrollEvent = (target: HTMLElement): Event => {
    return { target } as unknown as Event
  }

  const handleWindowMouseMove = (event: MouseEvent): void => {
    if (options.isColumnResizing.value) {
      options.applyColumnResizeFromPointer(event.clientX)
      return
    }
    options.handleInteractionWindowMouseMove(event)
  }

  const handleHeaderWheel = (event: WheelEvent): void => {
    const bodyViewport = options.bodyViewportRef.value
    if (!bodyViewport) {
      return
    }

    const horizontalDelta = Math.abs(event.deltaX) > 0 ? event.deltaX : (event.shiftKey ? event.deltaY : 0)
    const verticalDelta = horizontalDelta === 0 ? event.deltaY : 0
    if (horizontalDelta === 0 && verticalDelta === 0) {
      return
    }

    event.preventDefault()
    if (horizontalDelta !== 0) {
      bodyViewport.scrollLeft += horizontalDelta
    }
    if (verticalDelta !== 0) {
      bodyViewport.scrollTop += verticalDelta
    }
    options.syncViewport(createSyntheticScrollEvent(bodyViewport))
  }

  const handleHeaderScroll = (event: Event): void => {
    const headerViewport = event.target as HTMLElement | null
    const bodyViewport = options.bodyViewportRef.value
    if (!headerViewport || !bodyViewport) {
      return
    }
    if (bodyViewport.scrollLeft !== headerViewport.scrollLeft) {
      bodyViewport.scrollLeft = headerViewport.scrollLeft
    }
    options.syncViewport(createSyntheticScrollEvent(bodyViewport))
  }

  const handleWindowMouseUp = (): void => {
    options.stopColumnResize()
    options.handleInteractionWindowMouseUp()
  }

  return {
    handleWindowMouseMove,
    handleHeaderWheel,
    handleHeaderScroll,
    handleWindowMouseUp,
  }
}
