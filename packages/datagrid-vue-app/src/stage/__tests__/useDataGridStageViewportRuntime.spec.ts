import { defineComponent, ref, shallowRef } from "vue"
import { mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { UseDataGridStageViewportRuntimeResult, UseDataGridStageViewportRuntimeSyncers } from "../useDataGridStageViewportRuntime"
import { useDataGridStageViewportRuntime } from "../useDataGridStageViewportRuntime"
import type { DataGridTableStageViewportSection } from "../dataGridTableStage.types"

const originalRequestAnimationFrame = globalThis.requestAnimationFrame
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame

function createViewportElement({ scrollTop = 0, scrollLeft = 0 } = {}): HTMLElement {
  const element = document.createElement("div")
  element.scrollTop = scrollTop
  element.scrollLeft = scrollLeft
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: 320,
  })
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: 240,
  })
  return element
}

function createHarness(options: {
  leftPaneContent?: HTMLElement | null
  rightPaneContent?: HTMLElement | null
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
  const wrapper = mount(defineComponent({
    setup() {
      runtime = useDataGridStageViewportRuntime({
        stageRootEl: ref(null),
        viewport: shallowRef(viewport),
        gridChromeSyncers: shallowRef(syncers),
        leftPaneContentRef: ref(options.leftPaneContent ?? null),
        rightPaneContentRef: ref(options.rightPaneContent ?? null),
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
    unmount: () => wrapper.unmount(),
  }
}

describe("useDataGridStageViewportRuntime", () => {
  afterEach(() => {
    vi.useRealTimers()
    globalThis.requestAnimationFrame = originalRequestAnimationFrame
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame
  })

  it("schedules center chrome redraw for horizontal body scroll instead of flushing synchronously", () => {
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
    expect(harness.syncers.scheduleGridChromeRedraw).toHaveBeenCalledWith("center-scroll")
    expect(harness.syncers.flushGridChromeRedraw).not.toHaveBeenCalled()

    frameCallbacks.forEach(callback => callback(performance.now()))

    expect(harness.syncers.syncPinnedBottomViewportScrollLeft).toHaveBeenCalledTimes(1)

    harness.unmount()
  })

  it("schedules center chrome redraw when pinned bottom scroll syncs the body viewport", () => {
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
    expect(harness.syncers.scheduleGridChromeRedraw).toHaveBeenCalledWith("center-scroll")
    expect(harness.syncers.flushGridChromeRedraw).not.toHaveBeenCalled()

    harness.unmount()
  })

  it("batches linked pinned pane transforms through requestAnimationFrame during body scroll", () => {
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

    expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(2)
    expect(leftPane.style.transform).toBe("")
    expect(rightPane.style.transform).toBe("")

    frameCallbacks[0]?.(performance.now())

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

    expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(2)
    expect(harness.runtime.bodyViewportScrollTop.value).toBe(0)
    expect(harness.runtime.bodyViewportScrollLeft.value).toBe(0)
    expect(harness.syncers.syncPinnedBottomViewportScrollLeft).not.toHaveBeenCalled()

    frameCallbacks[1]?.(performance.now())

    expect(harness.runtime.bodyViewportScrollTop.value).toBe(144)
    expect(harness.runtime.bodyViewportScrollLeft.value).toBe(32)
    expect(harness.syncers.syncPinnedBottomViewportScrollLeft).toHaveBeenCalledTimes(1)

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

    harness.unmount()
  })
})
