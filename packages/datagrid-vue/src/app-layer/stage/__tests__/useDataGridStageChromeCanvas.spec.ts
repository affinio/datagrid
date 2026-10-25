import { computed, ref } from "vue"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DataGridChromePaneModel, DataGridChromeRenderModel } from "@affino/datagrid-chrome"
import { useDataGridStageChromeCanvas } from "../useDataGridStageChromeCanvas"
import {
  DATA_GRID_PERF_STORE_KEY,
  resolveDataGridPerfStore,
} from "../../perf/dataGridPerfTrace"

function createPane(width: number, height: number, includeRightEdge = false, includeBottomEdge = false): DataGridChromePaneModel {
  return {
    width,
    height,
    bands: height > 0 ? [{ top: 0, height: 24, kind: "base" }] : [],
    horizontalLines: height > 0 ? [{ position: includeBottomEdge ? height : 24 }] : [],
    verticalLines: width > 0 ? [{ position: includeRightEdge ? width : Math.max(1, width - 1) }] : [],
  }
}

function createRenderModel(includeRightEdge = false, includeBottomEdge = false): DataGridChromeRenderModel {
  return {
    left: createPane(80, 48, includeRightEdge, includeBottomEdge),
    center: createPane(160, 48, includeRightEdge, includeBottomEdge),
    right: createPane(90, 48, includeRightEdge, includeBottomEdge),
  }
}

type CanvasContextStub = CanvasRenderingContext2D & {
  moveTo: ReturnType<typeof vi.fn>
  lineTo: ReturnType<typeof vi.fn>
}

function createCanvasContext(): CanvasContextStub {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    set strokeStyle(_value: string) {},
    set fillStyle(_value: string) {},
    set lineWidth(_value: number) {},
  } as unknown as CanvasContextStub
}

function installCanvasContextMock(): CanvasContextStub {
  const context = createCanvasContext()
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
  return context
}

function createChromeCanvasApi(
  perfTraceEnabled = false,
  elements: {
    stageRoot?: HTMLElement
    bodyShell?: HTMLElement
    bodyViewport?: HTMLElement
    verticalBodyViewport?: HTMLElement
  } = {},
  headerRightEdgeLines = false,
  canvasTargets = true,
  onRenderModelRead: () => void = () => undefined,
  pinnedBottomOuterEdge = false,
) {
  const stageRoot = elements.stageRoot ?? document.createElement("div")
  document.body.append(stageRoot)
  const bodyShell = elements.bodyShell ?? document.createElement("div")
  const bodyViewport = elements.bodyViewport ?? document.createElement("div")
  const verticalBodyViewport = elements.verticalBodyViewport ?? document.createElement("div")

  const canvasRefs = Array.from({ length: 9 }, () => ref<HTMLCanvasElement | null>(
    canvasTargets ? document.createElement("canvas") : null,
  ))

  return useDataGridStageChromeCanvas({
    stageRootEl: ref(stageRoot),
    bodyShellRef: ref(bodyShell),
    bodyViewportEl: ref(bodyViewport),
    verticalBodyViewportEl: ref(verticalBodyViewport),
    bottomViewportEl: ref(document.createElement("div")),
    leftHeaderChromeCanvasEl: canvasRefs[0]!,
    centerHeaderChromeCanvasEl: canvasRefs[1]!,
    rightHeaderChromeCanvasEl: canvasRefs[2]!,
    leftChromeCanvasEl: canvasRefs[3]!,
    centerChromeCanvasEl: canvasRefs[4]!,
    rightChromeCanvasEl: canvasRefs[5]!,
    leftBottomChromeCanvasEl: canvasRefs[6]!,
    centerBottomChromeCanvasEl: canvasRefs[7]!,
    rightBottomChromeCanvasEl: canvasRefs[8]!,
    bodyViewportScrollTop: ref(0),
    bodyViewportScrollLeft: ref(0),
    bodyViewportClientWidth: ref(160),
    bodyViewportClientHeight: ref(48),
    bodyViewportShellClientWidth: ref(160),
    pinnedBottomViewportClientHeight: ref(48),
    bodyViewportTopOffset: ref(0),
    headerShellHeight: ref(24),
    headerViewportClientWidth: ref(160),
    chromeRenderModel: computed(() => {
      onRenderModelRead()
      return createRenderModel()
    }),
    headerChromeRenderModel: computed(() => {
      onRenderModelRead()
      return createRenderModel(headerRightEdgeLines)
    }),
    pinnedBottomChromeRenderModel: computed(() => {
      onRenderModelRead()
      return createRenderModel(false, pinnedBottomOuterEdge)
    }),
    hasPivotHeaderGroups: computed(() => false),
    perfTraceEnabled,
  })
}

describe("useDataGridStageChromeCanvas", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    delete (window as unknown as Record<string, unknown>)[DATA_GRID_PERF_STORE_KEY]
    installCanvasContextMock()
  })

  it("does not record chrome draw telemetry by default", () => {
    const api = createChromeCanvasApi()

    api.flushGridChromeRedraw("center-scroll")

    expect(resolveDataGridPerfStore()?.latest("chromeDraw")).toBeNull()
  })

  it("records chrome draw telemetry when perf tracing is enabled", () => {
    const api = createChromeCanvasApi(true)

    api.flushGridChromeRedraw("center-scroll")

    expect(resolveDataGridPerfStore()?.latest("chromeDraw")).toMatchObject({
      scope: "chromeDraw",
      redrawMode: "center-scroll",
      drawnPaneCount: 3,
      bodyLineCount: 6,
      headerLineCount: 6,
      pinnedBottomLineCount: 6,
      bodyBandCount: 3,
      pinnedBottomBandCount: 3,
    })
  })

  it("skips render model reads when a redraw has no target canvases", () => {
    const onRenderModelRead = vi.fn()
    const api = createChromeCanvasApi(true, {}, false, false, onRenderModelRead)

    api.flushGridChromeRedraw("center-scroll", "center-columns-revision")

    expect(onRenderModelRead).not.toHaveBeenCalled()
    expect(resolveDataGridPerfStore()?.latest("chromeDraw")).toMatchObject({
      redrawMode: "center-scroll",
      drawnPaneCount: 0,
      skippedNoCanvasTarget: 1,
    })
  })

  it("leaves the outer header edge to the stage frame", () => {
    const context = createCanvasContext()
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
    const api = createChromeCanvasApi(false, {}, true)

    api.flushGridChromeRedraw("full")

    // The two remaining strokes belong to the body and pinned-bottom pane interiors.
    expect(context.moveTo.mock.calls.filter(([x]) => x === 89.5)).toHaveLength(2)
  })

  it("aligns interior vertical dividers after the shared boundary", () => {
    const context = createCanvasContext()
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
    const api = createChromeCanvasApi()

    api.flushGridChromeRedraw("full")

    // Interior borders use the leading edge of the next cell; only outer pane edges are inset.
    expect(context.moveTo.mock.calls.filter(([x]) => x === 158.5)).toHaveLength(0)
    expect(context.moveTo.mock.calls.filter(([x]) => x === 159.5)).toHaveLength(3)
  })

  it("leaves the pinned-bottom outer boundary to the stage frame", () => {
    const context = createCanvasContext()
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
    const api = createChromeCanvasApi(false, {}, false, true, undefined, true)

    api.flushGridChromeRedraw("full")

    expect(context.moveTo.mock.calls.some(([, y]) => y === 47.5)).toBe(false)
  })

  it("sets the header scrollport width to the body width after a classic vertical scrollbar reduces it", () => {
    const stageRoot = document.createElement("div")
    const headerViewport = document.createElement("div")
    headerViewport.className = "grid-header-viewport"
    Object.defineProperty(headerViewport, "clientWidth", { configurable: true, value: 640 })
    stageRoot.append(headerViewport)

    const bodyShell = document.createElement("div")
    Object.defineProperty(bodyShell, "clientWidth", { configurable: true, value: 640 })
    const bodyViewport = document.createElement("div")
    Object.defineProperty(bodyViewport, "clientWidth", { configurable: true, value: 625 })
    Object.defineProperty(bodyViewport, "clientHeight", { configurable: true, value: 400 })
    bodyShell.append(bodyViewport)
    bodyViewport.scrollLeft = 375
    let headerScrollLeft = 360
    let headerScrollLeftReads = 0
    let headerScrollLeftWrites = 0
    Object.defineProperty(headerViewport, "scrollLeft", {
      configurable: true,
      get() {
        headerScrollLeftReads += 1
        return headerScrollLeft
      },
      set(value: number) {
        headerScrollLeftWrites += 1
        headerScrollLeft = value
      },
    })

    const api = createChromeCanvasApi(false, {
      stageRoot,
      bodyShell,
      bodyViewport,
      verticalBodyViewport: bodyViewport,
    })

    api.syncBodyViewportMetrics()

    expect(headerViewport.style.width).toBe("625px")
    expect(headerScrollLeft).toBe(375)
    expect(headerScrollLeftReads).toBe(0)
    expect(headerScrollLeftWrites).toBe(1)
  })

  it("records merged chrome redraw sources when a pending full redraw is flushed", () => {
    const frameCallbacks: FrameRequestCallback[] = []
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined)
    const api = createChromeCanvasApi(true)

    api.scheduleGridChromeRedraw("full", "chrome-rows-revision")
    api.flushGridChromeRedraw("body-scroll", "scroll-frame")

    expect(frameCallbacks).toHaveLength(1)
    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(1)
    expect(resolveDataGridPerfStore()?.latest("chromeRedrawRequest")).toMatchObject({
      scope: "chromeRedrawRequest",
      phase: "flush",
      source: "scroll-frame",
      requestedMode: "body-scroll",
      previousPendingMode: "full",
      mergedMode: "full",
      hadPendingFrame: 1,
      pendingSources: "chrome-rows-revision|scroll-frame",
    })
    expect(resolveDataGridPerfStore()?.latest("chromeDraw")).toMatchObject({
      scope: "chromeDraw",
      redrawMode: "full",
      redrawSource: "scroll-frame",
      redrawSources: "chrome-rows-revision|scroll-frame",
    })

    requestAnimationFrameSpy.mockRestore()
    cancelAnimationFrameSpy.mockRestore()
  })

  it("refreshes an invalidated theme palette and keeps the full redraw for every pane", () => {
    const frameCallbacks: FrameRequestCallback[] = []
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined)
    const getComputedStyleSpy = vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration)
    const api = createChromeCanvasApi(true)

    api.flushGridChromeRedraw("full", "stage-mounted")
    getComputedStyleSpy.mockClear()
    api.invalidateGridChromeStyle()
    api.scheduleGridChromeRedraw("full", "theme-change")
    api.scheduleGridChromeRedraw("body-scroll", "scroll-frame")

    expect(frameCallbacks).toHaveLength(1)
    frameCallbacks[0]?.(0)
    expect(getComputedStyleSpy).toHaveBeenCalled()
    expect(resolveDataGridPerfStore()?.latest("chromeDraw")).toMatchObject({
      redrawMode: "full",
      redrawSources: "theme-change|scroll-frame",
      drawnPaneCount: 9,
    })

    requestAnimationFrameSpy.mockRestore()
    cancelAnimationFrameSpy.mockRestore()
    getComputedStyleSpy.mockRestore()
  })

  it("reuses cached chrome styles for body scroll redraws", () => {
    const getComputedStyleSpy = vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration)
    const api = createChromeCanvasApi()

    api.flushGridChromeRedraw("full")
    getComputedStyleSpy.mockClear()
    api.flushGridChromeRedraw("body-scroll")

    expect(getComputedStyleSpy).not.toHaveBeenCalled()
  })

  it("draws body pinned pane vertical dividers through the full viewport height", () => {
    const context = installCanvasContextMock()
    const api = createChromeCanvasApi()

    api.flushGridChromeRedraw("full")

    const fullHeightVerticalLineCount = context.lineTo.mock.calls.filter((call: unknown[]) => call[1] === 48).length
    expect(fullHeightVerticalLineCount).toBeGreaterThanOrEqual(6)
  })
})
