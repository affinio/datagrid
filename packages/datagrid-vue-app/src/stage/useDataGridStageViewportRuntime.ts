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
  centerBodyContentRef?: Readonly<Ref<HTMLElement | null>>
  perfTraceEnabled?: boolean
}

export interface UseDataGridStageViewportRuntimeResult {
  bodyViewportEl: Ref<HTMLElement | null>
  verticalBodyViewportEl: Ref<HTMLElement | null>
  centerHorizontalViewportEl: Ref<HTMLElement | null>
  sharedVerticalViewportEl: Ref<HTMLElement | null>
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
  captureSharedVerticalViewportRef: (value: Element | ComponentPublicInstance | null) => void
  capturePinnedTopViewportRef: (value: Element | ComponentPublicInstance | null) => void
  capturePinnedBottomViewportRef: (value: Element | ComponentPublicInstance | null) => void
  handleCenterViewportScroll: (event: Event) => void
  handleSharedVerticalViewportScroll: (event: Event) => void
  handleHeaderViewportScroll: (event: Event) => void
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

function isHorizontalWheelGesture(event: WheelEvent): boolean {
  const absX = Math.abs(Number.isFinite(event.deltaX) ? event.deltaX : 0)
  const absY = Math.abs(Number.isFinite(event.deltaY) ? event.deltaY : 0)
  return absX > 0 && absX > absY
}

interface SharedViewportScrollEventTarget {
  scrollTop: number
  scrollLeft: number
  clientWidth: number
  clientHeight: number
  parentElement: HTMLElement | null
  __datagridCompositeViewportTarget: true
}


export function useDataGridStageViewportRuntime(
  options: UseDataGridStageViewportRuntimeOptions,
): UseDataGridStageViewportRuntimeResult {
  const bodyViewportEl = ref<HTMLElement | null>(null)
  const verticalBodyViewportEl = ref<HTMLElement | null>(null)
  const centerHorizontalViewportEl = ref<HTMLElement | null>(null)
  const sharedVerticalViewportEl = ref<HTMLElement | null>(null)
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
  const programmaticHeaderScrollLeft = new WeakMap<HTMLElement, number>()
  const sharedViewportScrollEventTarget: SharedViewportScrollEventTarget = {
    scrollTop: 0,
    scrollLeft: 0,
    clientWidth: 0,
    clientHeight: 0,
    parentElement: null,
    __datagridCompositeViewportTarget: true,
  }
  const perfTraceEnabled = options.perfTraceEnabled ?? resolveDataGridPerfTraceEnabled()


  function syncScrollOwnerRefs(): void {
    centerHorizontalViewportEl.value = bodyViewportEl.value
    verticalBodyViewportEl.value = sharedVerticalViewportEl.value ?? bodyViewportEl.value
  }

  const resolveVerticalBodyViewport = (): HTMLElement | null => verticalBodyViewportEl.value
  const resolveCenterHorizontalViewport = (): HTMLElement | null => centerHorizontalViewportEl.value

  function syncSharedVerticalContentOffset(scrollTop: number): void {
    const scrollTopValue = `${Math.max(0, scrollTop)}px`
    for (const element of [
      options.leftPaneContentRef.value,
      options.centerBodyContentRef?.value ?? null,
      options.rightPaneContentRef.value,
    ]) {
      if (!element) {
        continue
      }
      if (element.style.transform) {
        element.style.removeProperty("transform")
      }
      if (element.style.getPropertyValue("--datagrid-body-scroll-top") !== scrollTopValue) {
        element.style.setProperty("--datagrid-body-scroll-top", scrollTopValue)
      }
    }
  }

  function syncSharedHorizontalPeers(scrollLeft: number, source?: HTMLElement | null): void {
    const headerViewport = options.stageRootEl.value?.querySelector<HTMLElement>(".grid-header-viewport") ?? null
    if (headerViewport && headerViewport !== source && headerViewport.scrollLeft !== scrollLeft) {
      programmaticHeaderScrollLeft.set(headerViewport, scrollLeft)
      headerViewport.scrollLeft = scrollLeft
      programmaticHeaderScrollLeft.set(headerViewport, headerViewport.scrollLeft)
    }
    const pinnedBottomViewport = bottomViewportEl.value
    if (pinnedBottomViewport && pinnedBottomViewport !== source && pinnedBottomViewport.scrollLeft !== scrollLeft) {
      pinnedBottomViewport.scrollLeft = scrollLeft
    }
  }

  const linkedPaneScrollSync = useDataGridLinkedPaneScrollSync({
    resolveSourceScrollTop: () => resolveVerticalBodyViewport()?.scrollTop ?? 0,
    mode: "direct-transform",
    resolvePaneElements: () => [],
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
    resolveBodyViewport: resolveVerticalBodyViewport,
    resolveMainViewport: resolveCenterHorizontalViewport,
    setHandledScrollTop: (value: number) => {
      const verticalViewport = resolveVerticalBodyViewport()
      if (verticalViewport) {
        verticalViewport.scrollTop = value
        syncSharedVerticalContentOffset(value)
      }
    },
    setHandledScrollLeft: (value: number) => {
      const horizontalViewport = resolveCenterHorizontalViewport()
      if (horizontalViewport) {
        horizontalViewport.scrollLeft = value
      }
    },
    syncLinkedScroll: linkedPaneScrollSync.onSourceScroll,
    scheduleLinkedScrollSyncLoop: linkedPaneScrollSync.scheduleSyncLoop,
    isLinkedScrollSyncLoopScheduled: linkedPaneScrollSync.isSyncLoopScheduled,
    onWheelConsumed: () => {
      const verticalViewport = resolveVerticalBodyViewport()
      if (!verticalViewport) {
        return
      }
      markBodyViewportScrolling()
      options.viewport.value.handleViewportScroll(createSharedViewportScrollEvent(verticalViewport))
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

  function readBodyViewportScrollState(fallbackViewport?: HTMLElement | null): BodyViewportScrollState {
    return {
      scrollTop: (resolveVerticalBodyViewport() ?? fallbackViewport)?.scrollTop ?? 0,
      scrollLeft: (resolveCenterHorizontalViewport() ?? fallbackViewport)?.scrollLeft ?? 0,
    }
  }

  function createSharedViewportScrollEvent(
    fallbackViewport: HTMLElement,
    scrollState?: Pick<BodyViewportScrollState, "scrollTop" | "scrollLeft">,
  ): Event {
    const verticalViewport = resolveVerticalBodyViewport() ?? fallbackViewport
    const horizontalViewport = resolveCenterHorizontalViewport() ?? fallbackViewport
    sharedViewportScrollEventTarget.scrollTop = scrollState?.scrollTop ?? verticalViewport.scrollTop
    sharedViewportScrollEventTarget.scrollLeft = scrollState?.scrollLeft ?? horizontalViewport.scrollLeft
    sharedViewportScrollEventTarget.clientWidth = horizontalViewport.clientWidth
    sharedViewportScrollEventTarget.clientHeight = verticalViewport.clientHeight
    sharedViewportScrollEventTarget.parentElement = horizontalViewport.parentElement
    return { target: sharedViewportScrollEventTarget } as unknown as Event
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
    const nextElement = resolveElementRef(value)
    if (bodyViewportEl.value === nextElement) {
      syncScrollOwnerRefs()
      return
    }
    bodyViewportEl.value = nextElement
    syncScrollOwnerRefs()
    const syncers = options.gridChromeSyncers.value
    syncers.syncBodyViewportMetrics()
    syncers.connectGridChromeResizeObserver()
    syncers.scheduleGridChromeRedraw()
  }

  function captureSharedVerticalViewportRef(value: Element | ComponentPublicInstance | null): void {
    const nextElement = resolveElementRef(value)
    if (sharedVerticalViewportEl.value === nextElement) {
      syncScrollOwnerRefs()
      return
    }
    sharedVerticalViewportEl.value = nextElement
    syncScrollOwnerRefs()
    syncSharedVerticalContentOffset(sharedVerticalViewportEl.value?.scrollTop ?? 0)
    options.viewport.value.bodyViewportRef(value)
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
    if (element === resolveCenterHorizontalViewport()) {
      syncSharedHorizontalPeers(element.scrollLeft, element)
    }
    const previousScrollTop = observedBodyViewportScrollTop
    const previousScrollLeft = observedBodyViewportScrollLeft
    const scrollState = readBodyViewportScrollState(element)
    if (!hasBodyViewportScrollStateChanged(scrollState)) {
      return
    }
    const viewportScrollEvent = createSharedViewportScrollEvent(element, scrollState)
    options.viewport.value.handleViewportScroll(viewportScrollEvent)
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

  function handleSharedVerticalViewportScroll(event: Event): void {
    const verticalViewport = event.target as HTMLElement | null
    const horizontalViewport = resolveCenterHorizontalViewport()
    if (!verticalViewport || !horizontalViewport || verticalViewport !== resolveVerticalBodyViewport()) {
      return
    }
    if (verticalViewport.scrollLeft !== 0) {
      verticalViewport.scrollLeft = 0
    }
    syncSharedVerticalContentOffset(verticalViewport.scrollTop)
    handleCenterViewportScroll(event)
  }

  function handlePinnedBottomViewportScroll(event: Event): void {
    const element = event.target as HTMLElement | null
    const verticalViewport = resolveVerticalBodyViewport()
    const horizontalViewport = resolveCenterHorizontalViewport()
    if (!element || !verticalViewport || !horizontalViewport || horizontalViewport.scrollLeft === element.scrollLeft) {
      return
    }
    horizontalViewport.scrollLeft = element.scrollLeft
    syncSharedHorizontalPeers(element.scrollLeft, element)
    markBodyViewportScrolling()
    const scrollState = readBodyViewportScrollState(verticalViewport)
    options.viewport.value.handleViewportScroll(createSharedViewportScrollEvent(verticalViewport, scrollState))
    scheduleBodyViewportScrollStateSync(scrollState)
    scheduleScrollGridChromeRedraw("center-scroll")
  }

  function handleHeaderViewportScroll(event: Event): void {
    const element = event.target as HTMLElement | null
    const verticalViewport = resolveVerticalBodyViewport()
    const horizontalViewport = resolveCenterHorizontalViewport()
    if (!element || !verticalViewport || !horizontalViewport) {
      return
    }
    const expectedProgrammaticScrollLeft = programmaticHeaderScrollLeft.get(element)
    if (expectedProgrammaticScrollLeft !== undefined) {
      programmaticHeaderScrollLeft.delete(element)
      if (element.scrollLeft === expectedProgrammaticScrollLeft) {
        return
      }
    }
    const nextScrollLeft = element.scrollLeft
    const previousScrollLeft = observedBodyViewportScrollLeft
    if (horizontalViewport.scrollLeft !== nextScrollLeft) {
      horizontalViewport.scrollLeft = nextScrollLeft
    }
    syncSharedHorizontalPeers(nextScrollLeft, element)
    const scrollState = readBodyViewportScrollState(verticalViewport)
    if (scrollState.scrollLeft === previousScrollLeft && !hasBodyViewportScrollStateChanged(scrollState)) {
      return
    }
    markBodyViewportScrolling()
    options.viewport.value.handleViewportScroll(createSharedViewportScrollEvent(verticalViewport, scrollState))
    scheduleBodyViewportScrollStateSync(scrollState)
    if (scrollState.scrollLeft !== previousScrollLeft) {
      schedulePinnedBottomViewportScrollLeftSync()
    }
    scheduleScrollGridChromeRedraw("center-scroll")
  }

  function handlePinnedTopViewportScroll(event: Event): void {
    handlePinnedBottomViewportScroll(event)
  }

  function handleLinkedViewportWheel(event: WheelEvent): void {
    if (!isHorizontalWheelGesture(event)) {
      managedWheelScroll.reset()
      return
    }
    managedWheelScroll.onLinkedViewportWheel(event)
  }

  function handleBodyViewportWheel(_event: WheelEvent): void {
    managedWheelScroll.reset()
  }


  onMounted(() => {
    syncScrollOwnerRefs()
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
    verticalBodyViewportEl,
    centerHorizontalViewportEl,
    sharedVerticalViewportEl,
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
    captureSharedVerticalViewportRef,
    capturePinnedTopViewportRef,
    capturePinnedBottomViewportRef,
    handleCenterViewportScroll,
    handleSharedVerticalViewportScroll,
    handleHeaderViewportScroll,
    handlePinnedTopViewportScroll,
    handlePinnedBottomViewportScroll,
    handleLinkedViewportWheel,
    handleBodyViewportWheel,
  }
}
