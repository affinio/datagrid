import { onBeforeUnmount, onMounted, ref, type ComponentPublicInstance, type Ref } from "vue"
import {
  useDataGridLinkedPaneScrollSync,
  useDataGridManagedWheelScroll,
  useDataGridScrollIdleGate,
  useDataGridScrollPerfTelemetry,
} from "@affino/datagrid-vue/advanced"
import type { DataGridTableStageViewportSection } from "./dataGridTableStage.types"
import {
  recordDataGridPerfSample,
  resolveDataGridPerfNow,
  resolveDataGridPerfTraceEnabled,
} from "../perf/dataGridPerfTrace"

const DATA_GRID_SCROLL_IDLE_MS = 120
type GridChromeRedrawMode = "full" | "center-scroll"

export interface UseDataGridStageViewportRuntimeSyncers {
  syncBodyViewportMetrics: () => void
  syncPinnedBottomViewportMetrics: () => void
  syncPinnedBottomViewportScrollLeft: () => void
  scheduleGridChromeRedraw: (mode?: GridChromeRedrawMode) => void
  flushGridChromeRedraw: (mode?: GridChromeRedrawMode) => void
  connectGridChromeResizeObserver: () => void
  disconnectGridChromeResizeObserver: () => void
}

export interface UseDataGridStageViewportRuntimeOptions {
  stageRootEl: Readonly<Ref<HTMLElement | null>>
  viewport: Readonly<Ref<DataGridTableStageViewportSection>>
  gridChromeSyncers: Readonly<Ref<UseDataGridStageViewportRuntimeSyncers>>
  leftPaneContentRef: Readonly<Ref<HTMLElement | null>>
  rightPaneContentRef: Readonly<Ref<HTMLElement | null>>
  perfTraceEnabled?: boolean
}

export interface UseDataGridStageViewportRuntimeResult {
  bodyViewportEl: Ref<HTMLElement | null>
  topViewportEl: Ref<HTMLElement | null>
  bottomViewportEl: Ref<HTMLElement | null>
  bodyViewportScrollTop: Ref<number>
  bodyViewportScrollLeft: Ref<number>
  bodyViewportClientWidth: Ref<number>
  bodyViewportClientHeight: Ref<number>
  pinnedTopViewportClientHeight: Ref<number>
  pinnedBottomViewportClientHeight: Ref<number>
  bodyViewportTopOffset: Ref<number>
  headerShellHeight: Ref<number>
  headerViewportClientWidth: Ref<number>
  isBodyViewportScrolling: Ref<boolean>
  isBodyViewportScrollIdle: Ref<boolean>
  runWhenBodyViewportScrollIdle: (callback: () => void) => void
  captureBodyViewportRef: (value: Element | ComponentPublicInstance | null) => void
  capturePinnedTopViewportRef: (value: Element | ComponentPublicInstance | null) => void
  capturePinnedBottomViewportRef: (value: Element | ComponentPublicInstance | null) => void
  handleCenterViewportScroll: (event: Event) => void
  handlePinnedTopViewportScroll: (event: Event) => void
  handlePinnedBottomViewportScroll: (event: Event) => void
  handleLinkedViewportWheel: (event: WheelEvent) => void
  handleBodyViewportWheel: (event: WheelEvent) => void
}

interface BodyViewportScrollState {
  scrollTop: number
  scrollLeft: number
}

function mergeGridChromeRedrawMode(current: GridChromeRedrawMode, next: GridChromeRedrawMode): GridChromeRedrawMode {
  return current === "full" || next === "full" ? "full" : "center-scroll"
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
  const topViewportEl = ref<HTMLElement | null>(null)
  const bottomViewportEl = ref<HTMLElement | null>(null)
  const headerShellHeight = ref(0)
  const headerViewportClientWidth = ref(0)
  const bodyViewportScrollTop = ref(0)
  const bodyViewportScrollLeft = ref(0)
  const bodyViewportClientWidth = ref(0)
  const bodyViewportClientHeight = ref(0)
  const pinnedTopViewportClientHeight = ref(0)
  const pinnedBottomViewportClientHeight = ref(0)
  const bodyViewportTopOffset = ref(0)
  const isBodyViewportScrolling = ref(false)
  const isBodyViewportScrollIdle = ref(true)
  let bodyViewportScrollIdleCallbackQueued = false
  let bodyViewportScrollFrame: number | null = null
  let bodyViewportMetricsFrame: number | null = null
  let pendingBodyViewportScrollState: BodyViewportScrollState | null = null
  let pendingPinnedBottomViewportScrollLeftSync = false
  let pendingGridChromeRedrawMode: GridChromeRedrawMode | null = null
  let observedBodyViewportScrollTop = 0
  let observedBodyViewportScrollLeft = 0
  const perfTraceEnabled = options.perfTraceEnabled ?? resolveDataGridPerfTraceEnabled()

  const linkedPaneScrollSync = useDataGridLinkedPaneScrollSync({
    resolveSourceScrollTop: () => bodyViewportEl.value?.scrollTop ?? 0,
    mode: "direct-transform",
    resolvePaneElements: () => [options.leftPaneContentRef.value, options.rightPaneContentRef.value],
  })

  const bodyViewportScrollIdleGate = useDataGridScrollIdleGate({
    resolveIdleDelayMs: () => DATA_GRID_SCROLL_IDLE_MS,
    setTimeout: (callback, delay) => {
      const handle = globalThis.setTimeout(callback, delay)
      const maybeNodeTimer = handle as { unref?: () => void }
      maybeNodeTimer.unref?.()
      return handle
    },
  })
  const scrollPerfTelemetry = perfTraceEnabled
    ? useDataGridScrollPerfTelemetry({
        resolveIdleDelayMs: () => DATA_GRID_SCROLL_IDLE_MS,
        onSnapshotChange: snapshot => {
          recordDataGridPerfSample({
            scope: "stageScrollPerf",
            ts: Date.now(),
            totalMs: snapshot.avgFrameMs,
            active: snapshot.active ? 1 : 0,
            frameCount: snapshot.frameCount,
            droppedFrames: snapshot.droppedFrames,
            longTaskFrames: snapshot.longTaskFrames,
            avgFrameMs: snapshot.avgFrameMs,
            fps: snapshot.fps,
            quality: snapshot.quality,
          })
        },
      })
    : null

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
    syncLinkedScroll: linkedPaneScrollSync.onSourceScroll,
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

  function requestScrollFrame(callback: FrameRequestCallback): number {
    if (typeof globalThis.requestAnimationFrame === "function") {
      return globalThis.requestAnimationFrame(callback)
    }
    return globalThis.setTimeout(() => callback(Date.now()), 16) as unknown as number
  }

  function cancelScrollFrame(handle: number): void {
    if (typeof globalThis.cancelAnimationFrame === "function") {
      globalThis.cancelAnimationFrame(handle)
      return
    }
    globalThis.clearTimeout(handle)
  }

  function readBodyViewportScrollState(viewport: HTMLElement): BodyViewportScrollState {
    return {
      scrollTop: viewport.scrollTop,
      scrollLeft: viewport.scrollLeft,
    }
  }

  function trackObservedBodyViewportScrollState(state: Pick<BodyViewportScrollState, "scrollTop" | "scrollLeft">): void {
    observedBodyViewportScrollTop = state.scrollTop
    observedBodyViewportScrollLeft = state.scrollLeft
  }

  function hasBodyViewportScrollStateChanged(
    state: Pick<BodyViewportScrollState, "scrollTop" | "scrollLeft">,
  ): boolean {
    return state.scrollTop !== observedBodyViewportScrollTop || state.scrollLeft !== observedBodyViewportScrollLeft
  }

  function commitBodyViewportScrollState(state: BodyViewportScrollState): void {
    trackObservedBodyViewportScrollState(state)
    if (bodyViewportScrollTop.value !== state.scrollTop) {
      bodyViewportScrollTop.value = state.scrollTop
    }
    if (bodyViewportScrollLeft.value !== state.scrollLeft) {
      bodyViewportScrollLeft.value = state.scrollLeft
    }
  }

  function scheduleBodyViewportScrollFrame(): void {
    if (bodyViewportScrollFrame !== null) {
      return
    }
    bodyViewportScrollFrame = requestScrollFrame(() => {
      const frameStartedAt = perfTraceEnabled ? resolveDataGridPerfNow() : 0
      bodyViewportScrollFrame = null
      const scrollState = pendingBodyViewportScrollState
      const shouldSyncPinnedBottomScrollLeft = pendingPinnedBottomViewportScrollLeftSync
      const chromeRedrawMode = pendingGridChromeRedrawMode
      pendingBodyViewportScrollState = null
      pendingPinnedBottomViewportScrollLeftSync = false
      pendingGridChromeRedrawMode = null
      if (scrollState) {
        commitBodyViewportScrollState(scrollState)
      }
      if (shouldSyncPinnedBottomScrollLeft) {
        options.gridChromeSyncers.value.syncPinnedBottomViewportScrollLeft()
      }
      if (chromeRedrawMode) {
        options.gridChromeSyncers.value.flushGridChromeRedraw(chromeRedrawMode)
      }
      if (perfTraceEnabled) {
        recordDataGridPerfSample({
          scope: "stageScrollFrame",
          ts: Date.now(),
          totalMs: resolveDataGridPerfNow() - frameStartedAt,
          scrollTop: scrollState?.scrollTop ?? observedBodyViewportScrollTop,
          scrollLeft: scrollState?.scrollLeft ?? observedBodyViewportScrollLeft,
          hasScrollState: scrollState ? 1 : 0,
          syncedPinnedBottomScrollLeft: shouldSyncPinnedBottomScrollLeft ? 1 : 0,
          chromeRedrawMode: chromeRedrawMode ?? "none",
        })
      }
    })
  }

  function scheduleBodyViewportScrollStateSync(state: BodyViewportScrollState): void {
    trackObservedBodyViewportScrollState(state)
    pendingBodyViewportScrollState = state
    scheduleBodyViewportScrollFrame()
  }

  function schedulePinnedBottomViewportScrollLeftSync(): void {
    pendingPinnedBottomViewportScrollLeftSync = true
    scheduleBodyViewportScrollFrame()
  }

  function scheduleScrollGridChromeRedraw(mode: GridChromeRedrawMode): void {
    pendingGridChromeRedrawMode = pendingGridChromeRedrawMode
      ? mergeGridChromeRedrawMode(pendingGridChromeRedrawMode, mode)
      : mode
    scheduleBodyViewportScrollFrame()
  }

  function cancelBodyViewportScrollFrame(): void {
    if (bodyViewportScrollFrame === null) {
      return
    }
    cancelScrollFrame(bodyViewportScrollFrame)
    bodyViewportScrollFrame = null
    pendingBodyViewportScrollState = null
    pendingPinnedBottomViewportScrollLeftSync = false
    pendingGridChromeRedrawMode = null
  }

  function scheduleBodyViewportMetricsSync(): void {
    if (bodyViewportMetricsFrame !== null) {
      return
    }
    bodyViewportMetricsFrame = requestScrollFrame(() => {
      bodyViewportMetricsFrame = null
      options.gridChromeSyncers.value.syncBodyViewportMetrics()
    })
  }

  function cancelBodyViewportMetricsFrame(): void {
    if (bodyViewportMetricsFrame === null) {
      return
    }
    cancelScrollFrame(bodyViewportMetricsFrame)
    bodyViewportMetricsFrame = null
  }

  function markBodyViewportScrolling(): void {
    if (!isBodyViewportScrolling.value) {
      isBodyViewportScrolling.value = true
    }
    if (isBodyViewportScrollIdle.value) {
      isBodyViewportScrollIdle.value = false
    }
    scrollPerfTelemetry?.markScrollActivity()
    bodyViewportScrollIdleGate.markScrollActivity()
    if (bodyViewportScrollIdleCallbackQueued) {
      return
    }
    bodyViewportScrollIdleCallbackQueued = true
    bodyViewportScrollIdleGate.runWhenScrollIdle(() => {
      bodyViewportScrollIdleCallbackQueued = false
      isBodyViewportScrolling.value = false
      isBodyViewportScrollIdle.value = true
    })
  }

  function runWhenBodyViewportScrollIdle(callback: () => void): void {
    bodyViewportScrollIdleGate.runWhenScrollIdle(callback)
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

  function capturePinnedTopViewportRef(value: Element | ComponentPublicInstance | null): void {
    topViewportEl.value = resolveElementRef(value)
    pinnedTopViewportClientHeight.value = topViewportEl.value?.clientHeight ?? 0
    const syncers = options.gridChromeSyncers.value
    syncers.syncPinnedBottomViewportScrollLeft()
  }

  function handleCenterViewportScroll(event: Event): void {
    const element = event.target as HTMLElement | null
    if (!element) {
      return
    }
    const previousScrollTop = observedBodyViewportScrollTop
    const previousScrollLeft = observedBodyViewportScrollLeft
    const scrollState = readBodyViewportScrollState(element)
    if (!hasBodyViewportScrollStateChanged(scrollState)) {
      return
    }
    options.viewport.value.handleViewportScroll(event)
    markBodyViewportScrolling()
    linkedPaneScrollSync.syncNow(scrollState.scrollTop)
    scheduleBodyViewportScrollStateSync(scrollState)
    if (scrollState.scrollLeft !== previousScrollLeft) {
      schedulePinnedBottomViewportScrollLeftSync()
    }
    if (scrollState.scrollLeft !== previousScrollLeft && scrollState.scrollTop === previousScrollTop) {
      scheduleScrollGridChromeRedraw("center-scroll")
      return
    }
    scheduleScrollGridChromeRedraw("full")
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
    scheduleBodyViewportScrollStateSync(readBodyViewportScrollState(bodyViewport))
    scheduleScrollGridChromeRedraw("center-scroll")
  }

  function handlePinnedTopViewportScroll(event: Event): void {
    handlePinnedBottomViewportScroll(event)
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
      window.addEventListener("resize", scheduleBodyViewportMetricsSync)
    }
  })

  onBeforeUnmount(() => {
    linkedPaneScrollSync.reset()
    managedWheelScroll.reset()
    scrollPerfTelemetry?.dispose()
    bodyViewportScrollIdleGate.dispose()
    bodyViewportScrollIdleCallbackQueued = false
    cancelBodyViewportScrollFrame()
    cancelBodyViewportMetricsFrame()
    isBodyViewportScrolling.value = false
    isBodyViewportScrollIdle.value = true
    options.gridChromeSyncers.value.disconnectGridChromeResizeObserver()
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", scheduleBodyViewportMetricsSync)
    }
  })

  return {
    bodyViewportEl,
    topViewportEl,
    bottomViewportEl,
    bodyViewportScrollTop,
    bodyViewportScrollLeft,
    bodyViewportClientWidth,
    bodyViewportClientHeight,
    pinnedTopViewportClientHeight,
    pinnedBottomViewportClientHeight,
    bodyViewportTopOffset,
    headerShellHeight,
    headerViewportClientWidth,
    isBodyViewportScrolling,
    isBodyViewportScrollIdle,
    runWhenBodyViewportScrollIdle,
    captureBodyViewportRef,
    capturePinnedTopViewportRef,
    capturePinnedBottomViewportRef,
    handleCenterViewportScroll,
    handlePinnedTopViewportScroll,
    handlePinnedBottomViewportScroll,
    handleLinkedViewportWheel,
    handleBodyViewportWheel,
  }
}
