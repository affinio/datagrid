import type { Ref } from "vue"

export interface UseDataGridTableStageScrollSyncOptions {
  bodyViewportRef: Ref<HTMLElement | null>
  isColumnResizing: Ref<boolean>
  applyColumnResizeFromPointer: (clientX: number) => void
  stopColumnResize: () => void
  handleInteractionWindowMouseMove: (event: MouseEvent) => void
  handleInteractionWindowMouseUp: () => void
  handleInteractionWindowPointerUp: () => void
  handleInteractionWindowPointerCancel: () => void
  handleInteractionWindowBlur: () => void
  handleInteractionWindowContextMenuCapture: (event: MouseEvent) => boolean
  syncViewport: (event: Event) => void
}

export interface UseDataGridTableStageScrollSyncResult {
  handleWindowMouseMove: (event: MouseEvent) => void
  handleWindowPointerUp: (event: PointerEvent) => void
  handleWindowPointerCancel: (event: PointerEvent) => void
  handleWindowBlur: () => void
  handleWindowContextMenuCapture: (event: MouseEvent) => boolean
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

  function resolveHeaderHorizontalViewport(bodyViewport: HTMLElement): HTMLElement {
    if (bodyViewport.dataset.datagridScrollOwner !== "shared-vertical-prototype") {
      return bodyViewport
    }
    return bodyViewport.closest(".grid-stage")
      ?.querySelector<HTMLElement>(".grid-body-center-horizontal-scrollport--active")
      ?? bodyViewport
  }

  const handleHeaderScroll = (event: Event): void => {
    const headerViewport = event.target as HTMLElement | null
    const bodyViewport = options.bodyViewportRef.value
    if (!headerViewport || !bodyViewport) {
      return
    }
    const horizontalViewport = resolveHeaderHorizontalViewport(bodyViewport)
    const nextScrollLeft = headerViewport.scrollLeft
    if (horizontalViewport.scrollLeft === nextScrollLeft) {
      return
    }
    horizontalViewport.scrollLeft = nextScrollLeft
    if (horizontalViewport !== bodyViewport) {
      return
    }
    options.syncViewport(createSyntheticScrollEvent(bodyViewport))
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
    handleHeaderWheel,
    handleHeaderScroll,
    handleWindowMouseUp,
  }
}
