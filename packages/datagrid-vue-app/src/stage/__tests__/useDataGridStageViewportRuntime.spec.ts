import { defineComponent, ref, shallowRef } from "vue"
import { mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { UseDataGridStageViewportRuntimeResult, UseDataGridStageViewportRuntimeSyncers } from "../useDataGridStageViewportRuntime"
import { useDataGridStageViewportRuntime } from "../useDataGridStageViewportRuntime"
import type { DataGridTableStageViewportSection } from "../dataGridTableStage.types"
import { DATA_GRID_PERF_STORE_KEY, resolveDataGridPerfStore } from "../../perf/dataGridPerfTrace"

const originalRequestAnimationFrame = globalThis.requestAnimationFrame
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame

function createViewportElement({ scrollTop = 0, scrollLeft = 0 } = {}): HTMLElement {
  const element = document.createElement("div")
  element.scrollTop = scrollTop
  element.scrollLeft = scrollLeft
  defineScrollMetrics(element, {
    clientWidth: 320,
    clientHeight: 240,
    scrollWidth: 320,
    scrollHeight: 240,
  })
  return element
}

function defineScrollMetrics(
  element: HTMLElement,
  metrics: { clientWidth: number; clientHeight: number; scrollWidth: number; scrollHeight: number },
): void {
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: metrics.clientWidth,
  })
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: metrics.clientHeight,
  })
  Object.defineProperty(element, "scrollWidth", {
    configurable: true,
    value: metrics.scrollWidth,
  })
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: metrics.scrollHeight,
  })
}

function createWheelEvent(delta: { deltaX?: number; deltaY?: number; deltaMode?: number } = {}): WheelEvent {
  return new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaX: delta.deltaX ?? 0,
    deltaY: delta.deltaY ?? 0,
    deltaMode: delta.deltaMode ?? 0,
  })
}

function createHarness(options: {
  leftPaneContent?: HTMLElement | null
  rightPaneContent?: HTMLElement | null
  centerBodyContent?: HTMLElement | null
  sharedVerticalScrollEnabled?: boolean
  perfTraceEnabled?: boolean
} = {}) {
  const viewport: DataGridTableStageViewportSection = {
    topSpacerHeight: 0,
    bottomSpacerHeight: 0,
    viewportRowStart: 0,
    viewportRowEnd: 0,
    columnWindowStart: 0,
    leftColumnSpacerWidth: 0,
    rightColumnSpacerWidth: 0,
    headerViewportRef: vi.fn(),
    bodyViewportRef: vi.fn(),
    handleHeaderWheel: vi.fn(),
    handleHeaderScroll: vi.fn(),
    handleViewportScroll: vi.fn(),
    handleViewportKeydown: vi.fn(),
  }
  const syncers: UseDataGridStageViewportRuntimeSyncers = {
    syncBodyViewportMetrics: vi.fn(),
    syncPinnedBottomViewportMetrics: vi.fn(),
    syncPinnedBottomViewportScrollLeft: vi.fn(),
    scheduleGridChromeRedraw: vi.fn(),
    flushGridChromeRedraw: vi.fn(),
    connectGridChromeResizeObserver: vi.fn(),
    disconnectGridChromeResizeObserver: vi.fn(),
  }
  let runtime: UseDataGridStageViewportRuntimeResult | null = null
  const sharedVerticalScrollEnabled = ref(options.sharedVerticalScrollEnabled ?? false)
  const wrapper = mount(defineComponent({
    setup() {
      runtime = useDataGridStageViewportRuntime({
        stageRootEl: ref(null),
        viewport: shallowRef(viewport),
        gridChromeSyncers: shallowRef(syncers),
        leftPaneContentRef: ref(options.leftPaneContent ?? null),
        rightPaneContentRef: ref(options.rightPaneContent ?? null),
        centerBodyContentRef: ref(options.centerBodyContent ?? null),
        sharedVerticalScrollEnabled,
        perfTraceEnabled: options.perfTraceEnabled,
      })
      return () => null
    },
  }))
  vi.mocked(syncers.scheduleGridChromeRedraw).mockClear()
  vi.mocked(syncers.flushGridChromeRedraw).mockClear()
  vi.mocked(syncers.syncPinnedBottomViewportScrollLeft).mockClear()
  vi.mocked(viewport.handleViewportScroll).mockClear()
  return {
    runtime: runtime as UseDataGridStageViewportRuntimeResult,
    syncers,
    viewport,
    sharedVerticalScrollEnabled,
    unmount: () => wrapper.unmount(),
  }
}

describe("useDataGridStageViewportRuntime", () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>)[DATA_GRID_PERF_STORE_KEY]
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.requestAnimationFrame = originalRequestAnimationFrame
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame
  })

  it("exposes current body viewport as both vertical and horizontal owners", () => {
    const harness = createHarness()
    const bodyViewport = createViewportElement()

    harness.runtime.captureBodyViewportRef(bodyViewport)

    expect(harness.runtime.bodyViewportEl.value).toBe(bodyViewport)
    expect(harness.runtime.verticalBodyViewportEl.value).toBe(bodyViewport)
    expect(harness.runtime.centerHorizontalViewportEl.value).toBe(bodyViewport)

    harness.unmount()
  })

  it("uses the shared vertical viewport as vertical owner when the prototype is enabled", () => {
    const harness = createHarness({ sharedVerticalScrollEnabled: true })
    const bodyViewport = createViewportElement({ scrollLeft: 32 })
    const sharedVerticalViewport = createViewportElement({ scrollTop: 96 })

    harness.runtime.captureBodyViewportRef(bodyViewport)
    harness.runtime.captureSharedVerticalViewportRef(sharedVerticalViewport)

    expect(harness.runtime.bodyViewportEl.value).toBe(bodyViewport)
    expect(harness.runtime.sharedVerticalViewportEl.value).toBe(sharedVerticalViewport)
    expect(harness.runtime.verticalBodyViewportEl.value).toBe(sharedVerticalViewport)
    expect(harness.runtime.centerHorizontalViewportEl.value).toBe(bodyViewport)

    harness.unmount()
  })

  it("registers the shared vertical viewport as the app body viewport when the prototype is enabled", () => {
    const harness = createHarness({ sharedVerticalScrollEnabled: true })
    const bodyViewport = createViewportElement({ scrollLeft: 32 })
    const sharedVerticalViewport = createViewportElement({ scrollTop: 96 })

    harness.runtime.captureBodyViewportRef(bodyViewport)
    expect(harness.viewport.bodyViewportRef).not.toHaveBeenCalledWith(bodyViewport)

    harness.runtime.captureSharedVerticalViewportRef(sharedVerticalViewport)

    expect(harness.viewport.bodyViewportRef).toHaveBeenCalledWith(sharedVerticalViewport)

    harness.unmount()
  })

  it("reads vertical scroll from the shared owner and horizontal scroll from the center owner", () => {
    const frameCallbacks: FrameRequestCallback[] = []
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    globalThis.cancelAnimationFrame = vi.fn()
    const harness = createHarness({ sharedVerticalScrollEnabled: true })
    const bodyViewport = createViewportElement({ scrollLeft: 44 })
    const sharedVerticalViewport = createViewportElement({ scrollTop: 128, scrollLeft: 12 })
    const scrollEvent = { target: sharedVerticalViewport } as unknown as Event

    harness.runtime.captureBodyViewportRef(bodyViewport)
    harness.runtime.captureSharedVerticalViewportRef(sharedVerticalViewport)
    harness.runtime.handleSharedVerticalViewportScroll(scrollEvent)

    const forwardedEvent = vi.mocked(harness.viewport.handleViewportScroll).mock.calls[0]?.[0]
    const forwardedTarget = forwardedEvent?.target as HTMLElement | undefined
    expect(forwardedTarget?.scrollTop).toBe(128)
    expect(forwardedTarget?.scrollLeft).toBe(44)
    expect(forwardedTarget?.clientWidth).toBe(320)
    expect(forwardedTarget?.clientHeight).toBe(240)
    expect(sharedVerticalViewport.scrollLeft).toBe(0)
    expect(bodyViewport.scrollTop).toBe(0)

    frameCallbacks.forEach(callback => callback(performance.now()))

    expect(harness.runtime.bodyViewportScrollTop.value).toBe(128)
    expect(harness.runtime.bodyViewportScrollLeft.value).toBe(44)

    harness.unmount()
  })

  it("does not transform body content in the shared vertical prototype", () => {
    const centerContent = document.createElement("div")
    const harness = createHarness({
      centerBodyContent: centerContent,
      sharedVerticalScrollEnabled: true,
    })
    const bodyViewport = createViewportElement({ scrollLeft: 44 })
    const sharedVerticalViewport = createViewportElement({ scrollTop: 128 })

    harness.runtime.captureBodyViewportRef(bodyViewport)
    harness.runtime.captureSharedVerticalViewportRef(sharedVerticalViewport)
    harness.runtime.handleSharedVerticalViewportScroll({ target: sharedVerticalViewport } as unknown as Event)

    expect(centerContent.style.transform).toBe("")
    expect(bodyViewport.scrollTop).toBe(0)

    harness.unmount()
  })

  it("releases vertical wheel over linked panes to native prototype scrolling", () => {
    const harness = createHarness({ sharedVerticalScrollEnabled: true })
    const bodyViewport = createViewportElement({ scrollLeft: 24 })
    const sharedVerticalViewport = createViewportElement({ scrollTop: 80 })
    defineScrollMetrics(sharedVerticalViewport, {
      clientWidth: 320,
      clientHeight: 240,
      scrollWidth: 320,
      scrollHeight: 1200,
    })

    harness.runtime.captureBodyViewportRef(bodyViewport)
    harness.runtime.captureSharedVerticalViewportRef(sharedVerticalViewport)
    const wheelEvent = createWheelEvent({ deltaY: 48 })

    harness.runtime.handleLinkedViewportWheel(wheelEvent)

    expect(wheelEvent.defaultPrevented).toBe(false)
    expect(sharedVerticalViewport.scrollTop).toBe(80)
    expect(bodyViewport.scrollTop).toBe(0)
    expect(bodyViewport.scrollLeft).toBe(24)
    expect(harness.viewport.handleViewportScroll).not.toHaveBeenCalled()

    sharedVerticalViewport.scrollTop = 128
    harness.runtime.handleSharedVerticalViewportScroll({ target: sharedVerticalViewport } as unknown as Event)

    expect(harness.viewport.handleViewportScroll).toHaveBeenCalled()

    harness.unmount()
  })

  it("updates the prototype content scroll offset on shared vertical scroll", () => {
    const harness = createHarness({ sharedVerticalScrollEnabled: true })
    const bodyViewport = createViewportElement({ scrollLeft: 24 })
    const sharedVerticalViewport = createViewportElement({ scrollTop: 80 })

    harness.runtime.captureBodyViewportRef(bodyViewport)
    harness.runtime.captureSharedVerticalViewportRef(sharedVerticalViewport)

    expect(sharedVerticalViewport.style.getPropertyValue("--datagrid-prototype-scroll-top")).toBe("80px")

    sharedVerticalViewport.scrollTop = 128
    harness.runtime.handleSharedVerticalViewportScroll({ target: sharedVerticalViewport } as unknown as Event)

    expect(sharedVerticalViewport.style.getPropertyValue("--datagrid-prototype-scroll-top")).toBe("128px")
    expect(harness.viewport.handleViewportScroll).toHaveBeenCalled()

    harness.unmount()
  })

  it("releases vertical wheel over the center body to native prototype scrolling", () => {
    const harness = createHarness({ sharedVerticalScrollEnabled: true })
    const bodyViewport = createViewportElement({ scrollLeft: 24 })
    const sharedVerticalViewport = createViewportElement({ scrollTop: 80 })
    defineScrollMetrics(sharedVerticalViewport, {
      clientWidth: 320,
      clientHeight: 240,
      scrollWidth: 320,
      scrollHeight: 1200,
    })

    harness.runtime.captureBodyViewportRef(bodyViewport)
    harness.runtime.captureSharedVerticalViewportRef(sharedVerticalViewport)
    const wheelEvent = createWheelEvent({ deltaY: 48 })

    harness.runtime.handleBodyViewportWheel(wheelEvent)

    expect(wheelEvent.defaultPrevented).toBe(false)
    expect(sharedVerticalViewport.scrollTop).toBe(80)
    expect(bodyViewport.scrollTop).toBe(0)
    expect(bodyViewport.scrollLeft).toBe(24)
    expect(harness.viewport.handleViewportScroll).not.toHaveBeenCalled()

    harness.unmount()
  })

  it("routes horizontal wheel over linked panes to the center horizontal owner", () => {
    const harness = createHarness({ sharedVerticalScrollEnabled: true })
    const bodyViewport = createViewportElement({ scrollLeft: 40 })
    const sharedVerticalViewport = createViewportElement({ scrollTop: 80 })
    defineScrollMetrics(bodyViewport, {
      clientWidth: 320,
      clientHeight: 240,
      scrollWidth: 1200,
      scrollHeight: 240,
    })
    defineScrollMetrics(sharedVerticalViewport, {
      clientWidth: 320,
      clientHeight: 240,
      scrollWidth: 320,
      scrollHeight: 1200,
    })

    harness.runtime.captureBodyViewportRef(bodyViewport)
    harness.runtime.captureSharedVerticalViewportRef(sharedVerticalViewport)
    const wheelEvent = createWheelEvent({ deltaX: 64 })

    harness.runtime.handleLinkedViewportWheel(wheelEvent)

    expect(wheelEvent.defaultPrevented).toBe(true)
    expect(bodyViewport.scrollLeft).toBe(104)
    expect(sharedVerticalViewport.scrollTop).toBe(80)
    expect(bodyViewport.scrollTop).toBe(0)
    expect(harness.viewport.handleViewportScroll).toHaveBeenCalled()

    harness.unmount()
  })

  it("ignores bubbled center scroll events on the shared vertical handler", () => {
    const harness = createHarness({ sharedVerticalScrollEnabled: true })
    const bodyViewport = createViewportElement({ scrollLeft: 96 })
    const sharedVerticalViewport = createViewportElement({ scrollTop: 80 })

    harness.runtime.captureBodyViewportRef(bodyViewport)
    harness.runtime.captureSharedVerticalViewportRef(sharedVerticalViewport)
    harness.runtime.handleSharedVerticalViewportScroll({ target: bodyViewport } as unknown as Event)

    expect(bodyViewport.scrollLeft).toBe(96)
    expect(sharedVerticalViewport.scrollLeft).toBe(0)
    expect(harness.viewport.handleViewportScroll).not.toHaveBeenCalled()

    harness.unmount()
  })

  it("keeps the shared vertical owner out of horizontal scroll mirroring", () => {
    const harness = createHarness({ sharedVerticalScrollEnabled: true })
    const bodyViewport = createViewportElement({ scrollLeft: 96 })
    const sharedVerticalViewport = createViewportElement({ scrollTop: 80 })

    harness.runtime.captureBodyViewportRef(bodyViewport)
    harness.runtime.captureSharedVerticalViewportRef(sharedVerticalViewport)
    harness.runtime.handleCenterViewportScroll({ target: bodyViewport } as unknown as Event)

    expect(sharedVerticalViewport.scrollLeft).toBe(0)
    expect(harness.viewport.handleViewportScroll).toHaveBeenCalled()

    harness.unmount()
  })

  it("flushes center chrome redraw in the scroll frame for horizontal body scroll", () => {
    const frameCallbacks: FrameRequestCallback[] = []
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    globalThis.cancelAnimationFrame = vi.fn()
    const harness = createHarness()
    const bodyViewport = createViewportElement({ scrollLeft: 48 })

    harness.runtime.handleCenterViewportScroll({ target: bodyViewport } as unknown as Event)

    expect(harness.viewport.handleViewportScroll).toHaveBeenCalled()
    expect(harness.syncers.syncPinnedBottomViewportScrollLeft).not.toHaveBeenCalled()
    expect(harness.syncers.scheduleGridChromeRedraw).not.toHaveBeenCalled()
    expect(harness.syncers.flushGridChromeRedraw).not.toHaveBeenCalled()

    frameCallbacks.forEach(callback => callback(performance.now()))

    expect(harness.syncers.syncPinnedBottomViewportScrollLeft).toHaveBeenCalledTimes(1)
    expect(harness.syncers.flushGridChromeRedraw).toHaveBeenCalledWith("center-scroll")

    harness.unmount()
  })

  it("flushes center chrome redraw in the scroll frame when pinned bottom scroll syncs the body viewport", () => {
    const frameCallbacks: FrameRequestCallback[] = []
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    globalThis.cancelAnimationFrame = vi.fn()
    const harness = createHarness()
    const bodyViewport = createViewportElement()
    const pinnedBottomViewport = createViewportElement({ scrollLeft: 64 })
    harness.runtime.captureBodyViewportRef(bodyViewport)
    vi.mocked(harness.syncers.scheduleGridChromeRedraw).mockClear()
    vi.mocked(harness.syncers.flushGridChromeRedraw).mockClear()
    vi.mocked(harness.viewport.handleViewportScroll).mockClear()

    harness.runtime.handlePinnedBottomViewportScroll({ target: pinnedBottomViewport } as unknown as Event)

    expect(bodyViewport.scrollLeft).toBe(64)
    expect(harness.viewport.handleViewportScroll).toHaveBeenCalled()
    expect(harness.syncers.scheduleGridChromeRedraw).not.toHaveBeenCalled()
    expect(harness.syncers.flushGridChromeRedraw).not.toHaveBeenCalled()

    frameCallbacks.forEach(callback => callback(performance.now()))

    expect(harness.syncers.flushGridChromeRedraw).toHaveBeenCalledWith("center-scroll")

    harness.unmount()
  })

  it("syncs linked pinned pane transforms during raw body scroll", () => {
    const frameCallbacks: FrameRequestCallback[] = []
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    globalThis.cancelAnimationFrame = vi.fn()
    const leftPane = document.createElement("div")
    const rightPane = document.createElement("div")
    const harness = createHarness({
      leftPaneContent: leftPane,
      rightPaneContent: rightPane,
    })
    const bodyViewport = createViewportElement({ scrollTop: 120 })

    harness.runtime.handleCenterViewportScroll({ target: bodyViewport } as unknown as Event)

    expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(leftPane.style.transform).toBe("translate3d(0, -120px, 0)")
    expect(rightPane.style.transform).toBe("translate3d(0, -120px, 0)")

    harness.unmount()
  })

  it("batches body viewport scroll refs and pinned bottom sync into one frame", () => {
    const frameCallbacks: FrameRequestCallback[] = []
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    globalThis.cancelAnimationFrame = vi.fn()
    const harness = createHarness()
    const bodyViewport = createViewportElement({ scrollTop: 144, scrollLeft: 32 })

    harness.runtime.handleCenterViewportScroll({ target: bodyViewport } as unknown as Event)

    expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(harness.runtime.bodyViewportScrollTop.value).toBe(0)
    expect(harness.runtime.bodyViewportScrollLeft.value).toBe(0)
    expect(harness.syncers.syncPinnedBottomViewportScrollLeft).not.toHaveBeenCalled()

    frameCallbacks[0]?.(performance.now())

    expect(harness.runtime.bodyViewportScrollTop.value).toBe(144)
    expect(harness.runtime.bodyViewportScrollLeft.value).toBe(32)
    expect(harness.syncers.syncPinnedBottomViewportScrollLeft).toHaveBeenCalledTimes(1)
    expect(harness.syncers.flushGridChromeRedraw).toHaveBeenCalledWith("full")

    harness.unmount()
  })

  it("records stage scroll frame budget samples when perf tracing is enabled", () => {
    const frameCallbacks: FrameRequestCallback[] = []
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    globalThis.cancelAnimationFrame = vi.fn()
    const harness = createHarness({ perfTraceEnabled: true })
    const bodyViewport = createViewportElement({ scrollTop: 96, scrollLeft: 24 })

    harness.runtime.handleCenterViewportScroll({ target: bodyViewport } as unknown as Event)
    frameCallbacks.forEach(callback => callback(performance.now()))

    expect(resolveDataGridPerfStore()?.latest("stageScrollFrame")).toMatchObject({
      scope: "stageScrollFrame",
      scrollTop: 96,
      scrollLeft: 24,
      hasScrollState: 1,
      syncedPinnedBottomScrollLeft: 1,
      chromeRedrawMode: "full",
    })

    harness.unmount()
  })

  it("records stage scroll perf telemetry samples when perf tracing is enabled", () => {
    const frameCallbacks: FrameRequestCallback[] = []
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    globalThis.cancelAnimationFrame = vi.fn()
    const harness = createHarness({ perfTraceEnabled: true })
    const bodyViewport = createViewportElement({ scrollTop: 96, scrollLeft: 24 })

    harness.runtime.handleCenterViewportScroll({ target: bodyViewport } as unknown as Event)
    frameCallbacks.shift()?.(0)
    frameCallbacks.shift()?.(0)
    frameCallbacks.shift()?.(0)
    frameCallbacks.shift()?.(64)

    expect(resolveDataGridPerfStore()?.latest("stageScrollPerf")).toMatchObject({
      scope: "stageScrollPerf",
      active: 1,
      frameCount: 2,
      droppedFrames: 1,
      longTaskFrames: 1,
      avgFrameMs: 32,
    })

    harness.unmount()
  })

  it("exposes body scroll active and idle state with deferred idle callbacks", () => {
    vi.useFakeTimers()
    const harness = createHarness()
    const bodyViewport = createViewportElement({ scrollTop: 72 })
    const onIdle = vi.fn()

    expect(harness.runtime.isBodyViewportScrolling.value).toBe(false)
    expect(harness.runtime.isBodyViewportScrollIdle.value).toBe(true)

    harness.runtime.handleCenterViewportScroll({ target: bodyViewport } as unknown as Event)
    harness.runtime.runWhenBodyViewportScrollIdle(onIdle)

    expect(harness.runtime.isBodyViewportScrolling.value).toBe(true)
    expect(harness.runtime.isBodyViewportScrollIdle.value).toBe(false)
    expect(onIdle).not.toHaveBeenCalled()

    vi.advanceTimersByTime(119)

    expect(harness.runtime.isBodyViewportScrolling.value).toBe(true)
    expect(harness.runtime.isBodyViewportScrollIdle.value).toBe(false)
    expect(onIdle).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)

    expect(harness.runtime.isBodyViewportScrolling.value).toBe(false)
    expect(harness.runtime.isBodyViewportScrollIdle.value).toBe(true)
    expect(onIdle).toHaveBeenCalledTimes(1)

    harness.unmount()
  })

  it("does not sync pinned bottom scrollLeft for vertical-only body scroll", () => {
    const frameCallbacks: FrameRequestCallback[] = []
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    globalThis.cancelAnimationFrame = vi.fn()
    const harness = createHarness()
    const bodyViewport = createViewportElement({ scrollTop: 144, scrollLeft: 0 })

    harness.runtime.handleCenterViewportScroll({ target: bodyViewport } as unknown as Event)

    frameCallbacks.forEach(callback => callback(performance.now()))

    expect(harness.runtime.bodyViewportScrollTop.value).toBe(144)
    expect(harness.runtime.bodyViewportScrollLeft.value).toBe(0)
    expect(harness.syncers.syncPinnedBottomViewportScrollLeft).not.toHaveBeenCalled()
    expect(harness.syncers.flushGridChromeRedraw).toHaveBeenCalledWith("full")

    harness.unmount()
  })

  it("does not read body viewport dimensions during body scroll sampling", () => {
    const frameCallbacks: FrameRequestCallback[] = []
    const dimensionReads = {
      clientWidth: 0,
      clientHeight: 0,
    }
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    globalThis.cancelAnimationFrame = vi.fn()
    const harness = createHarness()
    const bodyViewport = createViewportElement({ scrollTop: 72, scrollLeft: 16 })
    Object.defineProperty(bodyViewport, "clientWidth", {
      configurable: true,
      get() {
        dimensionReads.clientWidth += 1
        return 320
      },
    })
    Object.defineProperty(bodyViewport, "clientHeight", {
      configurable: true,
      get() {
        dimensionReads.clientHeight += 1
        return 240
      },
    })

    harness.runtime.handleCenterViewportScroll({ target: bodyViewport } as unknown as Event)
    frameCallbacks.forEach(callback => callback(performance.now()))

    expect(harness.runtime.bodyViewportScrollTop.value).toBe(72)
    expect(harness.runtime.bodyViewportScrollLeft.value).toBe(16)
    expect(dimensionReads).toEqual({
      clientWidth: 0,
      clientHeight: 0,
    })

    harness.unmount()
  })

  it("samples body scroll offsets once during raw body scroll handling", () => {
    const frameCallbacks: FrameRequestCallback[] = []
    const scrollReads = {
      scrollTop: 0,
      scrollLeft: 0,
    }
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    globalThis.cancelAnimationFrame = vi.fn()
    const harness = createHarness()
    const bodyViewport = createViewportElement()
    Object.defineProperty(bodyViewport, "scrollTop", {
      configurable: true,
      get() {
        scrollReads.scrollTop += 1
        return 72
      },
    })
    Object.defineProperty(bodyViewport, "scrollLeft", {
      configurable: true,
      get() {
        scrollReads.scrollLeft += 1
        return 16
      },
    })

    harness.runtime.handleCenterViewportScroll({ target: bodyViewport } as unknown as Event)
    frameCallbacks.forEach(callback => callback(performance.now()))

    expect(harness.runtime.bodyViewportScrollTop.value).toBe(72)
    expect(harness.runtime.bodyViewportScrollLeft.value).toBe(16)
    expect(scrollReads).toEqual({
      scrollTop: 1,
      scrollLeft: 1,
    })

    harness.unmount()
  })

  it("skips redundant body scroll events when offsets did not change", () => {
    const frameCallbacks: FrameRequestCallback[] = []
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    globalThis.cancelAnimationFrame = vi.fn()
    const harness = createHarness()
    const bodyViewport = createViewportElement({ scrollTop: 0, scrollLeft: 0 })

    harness.runtime.handleCenterViewportScroll({ target: bodyViewport } as unknown as Event)

    expect(harness.viewport.handleViewportScroll).not.toHaveBeenCalled()
    expect(harness.syncers.syncPinnedBottomViewportScrollLeft).not.toHaveBeenCalled()
    expect(harness.syncers.flushGridChromeRedraw).not.toHaveBeenCalled()
    expect(frameCallbacks).toHaveLength(0)
    expect(harness.runtime.isBodyViewportScrolling.value).toBe(false)

    harness.unmount()
  })

  it("batches window resize metric sync through requestAnimationFrame", () => {
    const frameCallbacks: FrameRequestCallback[] = []
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    globalThis.cancelAnimationFrame = vi.fn()
    const harness = createHarness()
    vi.mocked(harness.syncers.syncBodyViewportMetrics).mockClear()

    window.dispatchEvent(new Event("resize"))
    window.dispatchEvent(new Event("resize"))

    expect(harness.syncers.syncBodyViewportMetrics).not.toHaveBeenCalled()
    expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1)

    frameCallbacks[0]?.(performance.now())

    expect(harness.syncers.syncBodyViewportMetrics).toHaveBeenCalledTimes(1)

    harness.unmount()
  })
})
