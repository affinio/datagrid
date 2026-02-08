import { onBeforeUnmount, type Ref } from "vue"
import type { ImperativeScrollSyncPayload } from "../composables/useTableViewport"

export interface DataGridViewportBridgeOptions {
  handleViewportScroll: (event: Event) => void
  scrollLeft: Ref<number>
  scrollTop: Ref<number>
  emitOverlayScrollSnapshot: (payload: { scrollLeft: number; scrollTop: number }) => void
}

export interface DataGridViewportBridge {
  handleViewportScrollEvent: (event: Event) => void
  handleViewportScrollSync: (payload: ImperativeScrollSyncPayload) => void
  cancelPendingViewportScroll: () => void
}

export function useDataGridViewportBridge(
  options: DataGridViewportBridgeOptions,
): DataGridViewportBridge {
  let pendingViewportScrollFrame: number | null = null
  let pendingViewportScrollTarget: HTMLElement | null = null

  const handleViewportScrollEvent = (event: Event) => {
    const target = event.target as HTMLElement | null
    if (!target) {
      pendingViewportScrollTarget = null
      return
    }

    pendingViewportScrollTarget = target

    if (pendingViewportScrollFrame != null) {
      return
    }

    pendingViewportScrollFrame = requestAnimationFrame(() => {
      const frameTarget = pendingViewportScrollTarget
      pendingViewportScrollFrame = null
      pendingViewportScrollTarget = null

      if (!frameTarget) {
        return
      }

      const syntheticEvent = {
        type: "scroll",
        target: frameTarget,
        currentTarget: frameTarget,
      } as unknown as Event
      options.handleViewportScroll(syntheticEvent)
    })
  }

  const handleViewportScrollSync = (payload: ImperativeScrollSyncPayload) => {
    options.scrollLeft.value = payload.scrollLeft
    options.scrollTop.value = payload.scrollTop
    options.emitOverlayScrollSnapshot({
      scrollLeft: payload.scrollLeft,
      scrollTop: payload.scrollTop,
    })
  }

  const cancelPendingViewportScroll = () => {
    if (pendingViewportScrollFrame != null) {
      cancelAnimationFrame(pendingViewportScrollFrame)
      pendingViewportScrollFrame = null
    }
    pendingViewportScrollTarget = null
  }

  onBeforeUnmount(() => {
    cancelPendingViewportScroll()
  })

  return {
    handleViewportScrollEvent,
    handleViewportScrollSync,
    cancelPendingViewportScroll,
  }
}
