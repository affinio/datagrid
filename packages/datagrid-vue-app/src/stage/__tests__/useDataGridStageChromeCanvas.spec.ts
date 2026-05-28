import { computed, ref } from "vue"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DataGridChromePaneModel, DataGridChromeRenderModel } from "@affino/datagrid-chrome"
import { useDataGridStageChromeCanvas } from "../useDataGridStageChromeCanvas"
import {
  DATA_GRID_PERF_STORE_KEY,
  resolveDataGridPerfStore,
} from "../../perf/dataGridPerfTrace"

function createPane(width: number, height: number): DataGridChromePaneModel {
  return {
    width,
    height,
    bands: height > 0 ? [{ top: 0, height: 24, kind: "base" }] : [],
    horizontalLines: height > 0 ? [{ position: 24 }] : [],
    verticalLines: width > 0 ? [{ position: Math.max(1, width - 1) }] : [],
  }
}

function createRenderModel(): DataGridChromeRenderModel {
  return {
    left: createPane(80, 48),
    center: createPane(160, 48),
    right: createPane(90, 48),
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

function createChromeCanvasApi(perfTraceEnabled = false) {
  const stageRoot = document.createElement("div")
  document.body.append(stageRoot)

  const canvasRefs = Array.from({ length: 9 }, () => ref(document.createElement("canvas")))

  return useDataGridStageChromeCanvas({
    stageRootEl: ref(stageRoot),
    bodyShellRef: ref(document.createElement("div")),
    bodyViewportEl: ref(document.createElement("div")),
    verticalBodyViewportEl: ref(document.createElement("div")),
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
    chromeRenderModel: computed(() => createRenderModel()),
    headerChromeRenderModel: computed(() => createRenderModel()),
    pinnedBottomChromeRenderModel: computed(() => createRenderModel()),
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
