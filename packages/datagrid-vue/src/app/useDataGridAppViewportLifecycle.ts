import { onBeforeUnmount, onMounted, type Ref } from "vue"

export interface UseDataGridAppViewportLifecycleOptions {
  bodyViewportRef: Ref<HTMLElement | null>
  syncViewport: () => void
  handleWindowMouseMove: (event: MouseEvent) => void
  handleWindowMouseUp: () => void
  handleWindowPointerUp?: (event: PointerEvent) => void
  handleWindowPointerCancel?: (event: PointerEvent) => void
  handleWindowBlur?: () => void
  handleWindowContextMenuCapture?: (event: MouseEvent) => void
  cancelScheduledViewportSync?: () => void
  onAfterMount?: () => void
  dispose?: readonly (() => void)[]
}

export function useDataGridAppViewportLifecycle(
  options: UseDataGridAppViewportLifecycleOptions,
): void {
  let tableResizeObserver: ResizeObserver | null = null

  onMounted(() => {
    options.onAfterMount?.()

    const bodyViewport = options.bodyViewportRef.value
    if (bodyViewport && typeof ResizeObserver !== "undefined") {
      tableResizeObserver = new ResizeObserver(() => {
        options.syncViewport()
      })
      tableResizeObserver.observe(bodyViewport)
    }

    if (typeof window === "undefined") {
      return
    }

    window.addEventListener("resize", options.syncViewport)
    window.addEventListener("mousemove", options.handleWindowMouseMove)
    window.addEventListener("mouseup", options.handleWindowMouseUp)
    if (options.handleWindowPointerUp) {
      window.addEventListener("pointerup", options.handleWindowPointerUp)
    }
    if (options.handleWindowPointerCancel) {
      window.addEventListener("pointercancel", options.handleWindowPointerCancel)
    }
    if (options.handleWindowBlur) {
      window.addEventListener("blur", options.handleWindowBlur)
    }
    if (options.handleWindowContextMenuCapture) {
      window.addEventListener("contextmenu", options.handleWindowContextMenuCapture, true)
    }
  })

  onBeforeUnmount(() => {
    options.cancelScheduledViewportSync?.()
    tableResizeObserver?.disconnect()
    tableResizeObserver = null

    if (typeof window !== "undefined") {
      window.removeEventListener("resize", options.syncViewport)
      window.removeEventListener("mousemove", options.handleWindowMouseMove)
      window.removeEventListener("mouseup", options.handleWindowMouseUp)
      if (options.handleWindowPointerUp) {
        window.removeEventListener("pointerup", options.handleWindowPointerUp)
      }
      if (options.handleWindowPointerCancel) {
        window.removeEventListener("pointercancel", options.handleWindowPointerCancel)
      }
      if (options.handleWindowBlur) {
        window.removeEventListener("blur", options.handleWindowBlur)
      }
      if (options.handleWindowContextMenuCapture) {
        window.removeEventListener("contextmenu", options.handleWindowContextMenuCapture, true)
      }
    }

    for (const dispose of options.dispose ?? []) {
      dispose()
    }
  })
}
