import { onBeforeUnmount, onMounted, type Ref } from "vue"

export interface UseDataGridAppViewportLifecycleOptions {
  bodyViewportRef: Ref<HTMLElement | null>
  syncViewport: () => void
  handleWindowMouseMove: (event: MouseEvent) => void
  handleWindowMouseUp: () => void
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
  })

  onBeforeUnmount(() => {
    options.cancelScheduledViewportSync?.()
    tableResizeObserver?.disconnect()
    tableResizeObserver = null

    if (typeof window !== "undefined") {
      window.removeEventListener("resize", options.syncViewport)
      window.removeEventListener("mousemove", options.handleWindowMouseMove)
      window.removeEventListener("mouseup", options.handleWindowMouseUp)
    }

    for (const dispose of options.dispose ?? []) {
      dispose()
    }
  })
}
