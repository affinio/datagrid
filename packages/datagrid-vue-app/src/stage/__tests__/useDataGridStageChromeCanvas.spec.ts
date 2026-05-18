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

function createCanvasContext(): CanvasRenderingContext2D {
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
  } as unknown as CanvasRenderingContext2D
}

function createChromeCanvasApi(perfTraceEnabled = false) {
  const stageRoot = document.createElement("div")
  document.body.append(stageRoot)

  const canvasRefs = Array.from({ length: 9 }, () => ref(document.createElement("canvas")))

  return useDataGridStageChromeCanvas({
    stageRootEl: ref(stageRoot),
    bodyShellRef: ref(document.createElement("div")),
    bodyViewportEl: ref(document.createElement("div")),
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
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(createCanvasContext())
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
})
