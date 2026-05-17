import { onBeforeUnmount, onMounted, watch, type Ref } from "vue"

export interface UseDataGridAppViewportLifecycleOptions {
  bodyViewportRef: Ref<HTMLElement | null>
  globalPointerListenersActive?: Readonly<Ref<boolean>>
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
  let globalPointerListenersAttached = false

  const shouldKeepGlobalPointerListenersAttached = (): boolean => {
    return options.globalPointerListenersActive?.value ?? true
  }

  const attachGlobalPointerListeners = (): void => {
    if (globalPointerListenersAttached || typeof window === "undefined") {
      return
    }
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
    globalPointerListenersAttached = true
  }

  const detachGlobalPointerListeners = (): void => {
    if (!globalPointerListenersAttached || typeof window === "undefined") {
      return
    }
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
    globalPointerListenersAttached = false
  }

  const syncGlobalPointerListeners = (): void => {
    if (shouldKeepGlobalPointerListenersAttached()) {
      attachGlobalPointerListeners()
      return
    }
    detachGlobalPointerListeners()
  }

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
    syncGlobalPointerListeners()
  })

  const stopGlobalPointerListenerWatch = options.globalPointerListenersActive
    ? watch(
        options.globalPointerListenersActive,
        () => {
          syncGlobalPointerListeners()
        },
        { flush: "sync" },
      )
    : null

  onBeforeUnmount(() => {
    stopGlobalPointerListenerWatch?.()
    options.cancelScheduledViewportSync?.()
    tableResizeObserver?.disconnect()
    tableResizeObserver = null

    if (typeof window !== "undefined") {
      window.removeEventListener("resize", options.syncViewport)
      detachGlobalPointerListeners()
    }

    for (const dispose of options.dispose ?? []) {
      dispose()
    }
  })
}
