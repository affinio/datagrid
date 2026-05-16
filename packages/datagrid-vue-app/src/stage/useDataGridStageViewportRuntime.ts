import { onBeforeUnmount, onMounted, ref, type ComponentPublicInstance, type Ref } from "vue"
import { useDataGridLinkedPaneScrollSync, useDataGridManagedWheelScroll } from "@affino/datagrid-vue/advanced"
import type { DataGridTableStageViewportSection } from "./dataGridTableStage.types"

const DATA_GRID_SCROLL_IDLE_MS = 120

export interface UseDataGridStageViewportRuntimeSyncers {
  syncBodyViewportMetrics: () => void
  syncPinnedBottomViewportMetrics: () => void
  syncPinnedBottomViewportScrollLeft: () => void
  scheduleGridChromeRedraw: (mode?: "full" | "center-scroll") => void
  flushGridChromeRedraw: (mode?: "full" | "center-scroll") => void
  connectGridChromeResizeObserver: () => void
  disconnectGridChromeResizeObserver: () => void
}

export interface UseDataGridStageViewportRuntimeOptions {
  stageRootEl: Readonly<Ref<HTMLElement | null>>
  viewport: Readonly<Ref<DataGridTableStageViewportSection>>
  gridChromeSyncers: Readonly<Ref<UseDataGridStageViewportRuntimeSyncers>>
  leftPaneContentRef: Readonly<Ref<HTMLElement | null>>
  rightPaneContentRef: Readonly<Ref<HTMLElement | null>>
}

export interface UseDataGridStageViewportRuntimeResult {
  bodyViewportEl: Ref<HTMLElement | null>
  bottomViewportEl: Ref<HTMLElement | null>
  bodyViewportScrollTop: Ref<number>
  bodyViewportScrollLeft: Ref<number>
  bodyViewportClientWidth: Ref<number>
  bodyViewportClientHeight: Ref<number>
  pinnedBottomViewportClientHeight: Ref<number>
  bodyViewportTopOffset: Ref<number>
  headerShellHeight: Ref<number>
  headerViewportClientWidth: Ref<number>
  isBodyViewportScrolling: Ref<boolean>
  captureBodyViewportRef: (value: Element | ComponentPublicInstance | null) => void
  capturePinnedBottomViewportRef: (value: Element | ComponentPublicInstance | null) => void
  handleCenterViewportScroll: (event: Event) => void
  handlePinnedBottomViewportScroll: (event: Event) => void
  handleLinkedViewportWheel: (event: WheelEvent) => void
  handleBodyViewportWheel: (event: WheelEvent) => void
}

function resolveElementRef(value: Element | ComponentPublicInstance | null): HTMLElement | null {
  if (value instanceof HTMLElement) {
    return value
  }
  if (value && "$el" in value) {
    const element = value.$el
    return element instanceof HTMLElement ? element : null
  }
  return null
}

function createSyntheticScrollEvent(target: HTMLElement): Event {
  return { target } as unknown as Event
}

export function useDataGridStageViewportRuntime(
  options: UseDataGridStageViewportRuntimeOptions,
): UseDataGridStageViewportRuntimeResult {
  const bodyViewportEl = ref<HTMLElement | null>(null)
  const bottomViewportEl = ref<HTMLElement | null>(null)
  const headerShellHeight = ref(0)
  const headerViewportClientWidth = ref(0)
  const bodyViewportScrollTop = ref(0)
  const bodyViewportScrollLeft = ref(0)
  const bodyViewportClientWidth = ref(0)
  const bodyViewportClientHeight = ref(0)
  const pinnedBottomViewportClientHeight = ref(0)
  const bodyViewportTopOffset = ref(0)
  const isBodyViewportScrolling = ref(false)
  let bodyViewportScrollIdleTimer: ReturnType<typeof globalThis.setTimeout> | null = null

  const linkedPaneScrollSync = useDataGridLinkedPaneScrollSync({
    resolveSourceScrollTop: () => bodyViewportEl.value?.scrollTop ?? 0,
    mode: "direct-transform",
    resolvePaneElements: () => [options.leftPaneContentRef.value, options.rightPaneContentRef.value],
  })

  const managedWheelScroll = useDataGridManagedWheelScroll({
    resolveBodyViewport: () => bodyViewportEl.value,
    resolveMainViewport: () => bodyViewportEl.value,
    setHandledScrollTop: (value: number) => {
      if (bodyViewportEl.value) {
        bodyViewportEl.value.scrollTop = value
      }
    },
    setHandledScrollLeft: (value: number) => {
      if (bodyViewportEl.value) {
        bodyViewportEl.value.scrollLeft = value
      }
    },
    syncLinkedScroll: (scrollTop: number) => {
      linkedPaneScrollSync.syncNow(scrollTop)
    },
    scheduleLinkedScrollSyncLoop: linkedPaneScrollSync.scheduleSyncLoop,
    isLinkedScrollSyncLoopScheduled: linkedPaneScrollSync.isSyncLoopScheduled,
    onWheelConsumed: () => {
      const bodyViewport = bodyViewportEl.value
      if (!bodyViewport) {
        return
      }
      markBodyViewportScrolling()
      options.viewport.value.handleViewportScroll(createSyntheticScrollEvent(bodyViewport))
    },
  })

  function clearBodyViewportScrollIdleTimer(): void {
    if (bodyViewportScrollIdleTimer == null) {
      return
    }
    globalThis.clearTimeout(bodyViewportScrollIdleTimer)
    bodyViewportScrollIdleTimer = null
  }

  function markBodyViewportScrolling(): void {
    if (!isBodyViewportScrolling.value) {
      isBodyViewportScrolling.value = true
    }
    clearBodyViewportScrollIdleTimer()
    bodyViewportScrollIdleTimer = globalThis.setTimeout(() => {
      bodyViewportScrollIdleTimer = null
      isBodyViewportScrolling.value = false
    }, DATA_GRID_SCROLL_IDLE_MS)
    const maybeNodeTimer = bodyViewportScrollIdleTimer as { unref?: () => void }
    maybeNodeTimer.unref?.()
  }

  function syncBodyViewportScrollState(viewport: HTMLElement): void {
    if (bodyViewportScrollTop.value !== viewport.scrollTop) {
      bodyViewportScrollTop.value = viewport.scrollTop
    }
    if (bodyViewportScrollLeft.value !== viewport.scrollLeft) {
      bodyViewportScrollLeft.value = viewport.scrollLeft
    }
    if (bodyViewportClientWidth.value !== viewport.clientWidth) {
      bodyViewportClientWidth.value = viewport.clientWidth
    }
    if (bodyViewportClientHeight.value !== viewport.clientHeight) {
      bodyViewportClientHeight.value = viewport.clientHeight
    }
  }

  function captureBodyViewportRef(value: Element | ComponentPublicInstance | null): void {
    bodyViewportEl.value = resolveElementRef(value)
    options.viewport.value.bodyViewportRef(value)
    const syncers = options.gridChromeSyncers.value
    syncers.syncBodyViewportMetrics()
    syncers.connectGridChromeResizeObserver()
    syncers.scheduleGridChromeRedraw()
  }

  function capturePinnedBottomViewportRef(value: Element | ComponentPublicInstance | null): void {
    bottomViewportEl.value = resolveElementRef(value)
    const syncers = options.gridChromeSyncers.value
    syncers.syncPinnedBottomViewportMetrics()
    syncers.syncPinnedBottomViewportScrollLeft()
  }

  function handleCenterViewportScroll(event: Event): void {
    options.viewport.value.handleViewportScroll(event)
    const element = event.target as HTMLElement | null
    if (!element) {
      return
    }
    markBodyViewportScrolling()
    const previousScrollTop = bodyViewportScrollTop.value
    const previousScrollLeft = bodyViewportScrollLeft.value
    linkedPaneScrollSync.syncNow(element.scrollTop)
    syncBodyViewportScrollState(element)
    options.gridChromeSyncers.value.syncPinnedBottomViewportScrollLeft()
    if (element.scrollLeft !== previousScrollLeft && element.scrollTop === previousScrollTop) {
      options.gridChromeSyncers.value.flushGridChromeRedraw("center-scroll")
      return
    }
    options.gridChromeSyncers.value.scheduleGridChromeRedraw("full")
  }

  function handlePinnedBottomViewportScroll(event: Event): void {
    const element = event.target as HTMLElement | null
    const bodyViewport = bodyViewportEl.value
    if (!element || !bodyViewport || bodyViewport.scrollLeft === element.scrollLeft) {
      return
    }
    bodyViewport.scrollLeft = element.scrollLeft
    markBodyViewportScrolling()
    options.viewport.value.handleViewportScroll(createSyntheticScrollEvent(bodyViewport))
    syncBodyViewportScrollState(bodyViewport)
    options.gridChromeSyncers.value.flushGridChromeRedraw("center-scroll")
  }

  function handleLinkedViewportWheel(event: WheelEvent): void {
    managedWheelScroll.onLinkedViewportWheel(event)
  }

  function handleBodyViewportWheel(event: WheelEvent): void {
    managedWheelScroll.onBodyViewportWheel(event)
  }

  onMounted(() => {
    options.gridChromeSyncers.value.syncBodyViewportMetrics()
    options.gridChromeSyncers.value.connectGridChromeResizeObserver()
    options.gridChromeSyncers.value.scheduleGridChromeRedraw()
    if (typeof window !== "undefined") {
      window.addEventListener("resize", options.gridChromeSyncers.value.syncBodyViewportMetrics)
    }
  })

  onBeforeUnmount(() => {
    linkedPaneScrollSync.reset()
    managedWheelScroll.reset()
    clearBodyViewportScrollIdleTimer()
    isBodyViewportScrolling.value = false
    options.gridChromeSyncers.value.disconnectGridChromeResizeObserver()
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", options.gridChromeSyncers.value.syncBodyViewportMetrics)
    }
  })

  return {
    bodyViewportEl,
    bottomViewportEl,
    bodyViewportScrollTop,
    bodyViewportScrollLeft,
    bodyViewportClientWidth,
    bodyViewportClientHeight,
    pinnedBottomViewportClientHeight,
    bodyViewportTopOffset,
    headerShellHeight,
    headerViewportClientWidth,
    isBodyViewportScrolling,
    captureBodyViewportRef,
    capturePinnedBottomViewportRef,
    handleCenterViewportScroll,
    handlePinnedBottomViewportScroll,
    handleLinkedViewportWheel,
    handleBodyViewportWheel,
  }
}
