import { describe, expect, it } from "vitest"
import type { DataGridColumn, VisibleRow } from "../../types"
import { createClientRowModel, createDataGridColumnModel } from "../../models"
import { createDataGridViewportController } from "../dataGridViewportController"

interface MutableElementMetrics {
  clientWidth: number
  clientHeight: number
  scrollWidth: number
  scrollHeight: number
}

function createMeasuredElement(initial: MutableElementMetrics) {
  const state: MutableElementMetrics = { ...initial }
  const element = document.createElement("div") as HTMLDivElement

  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    get: () => state.clientWidth,
  })
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    get: () => state.clientHeight,
  })
  Object.defineProperty(element, "scrollWidth", {
    configurable: true,
    get: () => state.scrollWidth,
  })
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    get: () => state.scrollHeight,
  })

  return {
    element,
    state,
  }
}

function createRows(count: number): VisibleRow[] {
  const rows: VisibleRow[] = []
  for (let index = 0; index < count; index += 1) {
    rows.push({
      row: { id: index, value: `row-${index}` },
      rowId: index,
      originalIndex: index,
      displayIndex: index,
    })
  }
  return rows
}

describe("viewport integration snapshot contract", () => {
  it("exposes deterministic pinned/overlay/viewport state through public snapshot", () => {
    const columns: DataGridColumn[] = [
      { key: "a", label: "A", pin: "left", width: 100, minWidth: 80, maxWidth: 220, visible: true },
      { key: "b", label: "B", pin: "left", width: 120, minWidth: 80, maxWidth: 220, visible: true },
      { key: "c", label: "C", pin: "none", width: 90, minWidth: 80, maxWidth: 220, visible: true },
      { key: "d", label: "D", pin: "none", width: 110, minWidth: 80, maxWidth: 220, visible: true },
      { key: "e", label: "E", pin: "right", width: 130, minWidth: 80, maxWidth: 220, visible: true },
    ]
    const rowModel = createClientRowModel({ rows: createRows(300) })
    const columnModel = createDataGridColumnModel({ columns })
    const containerMetrics = createMeasuredElement({
      clientWidth: 800,
      clientHeight: 520,
      scrollWidth: 2600,
      scrollHeight: 12_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 800,
      clientHeight: 48,
      scrollWidth: 800,
      scrollHeight: 48,
    })
    const windowPayloads: Array<{
      rowStart: number
      rowEnd: number
      colStart: number
      colEnd: number
      scrollTop: number
      scrollLeft: number
    }> = []
    const controller = createDataGridViewportController({
      resolvePinMode: column => (column.pin === "left" || column.pin === "right" ? column.pin : "none"),
      rowModel,
      columnModel,
      imperativeCallbacks: {
        onWindow(payload) {
          windowPayloads.push({
            rowStart: payload.virtualWindow.rowStart,
            rowEnd: payload.virtualWindow.rowEnd,
            colStart: payload.virtualWindow.colStart,
            colEnd: payload.virtualWindow.colEnd,
            scrollTop: payload.scrollTop,
            scrollLeft: payload.scrollLeft,
          })
        },
      },
    })

    controller.attach(containerMetrics.element, headerMetrics.element)
    controller.setViewportMetrics({
      containerWidth: containerMetrics.state.clientWidth,
      containerHeight: containerMetrics.state.clientHeight,
      headerHeight: headerMetrics.state.clientHeight,
    })
    controller.refresh(true)

    containerMetrics.element.scrollLeft = 240
    containerMetrics.element.scrollTop = 1180
    containerMetrics.element.dispatchEvent(new Event("scroll"))
    controller.refresh(true)

    const snapshot = controller.getIntegrationSnapshot()
    const windowSnapshot = controller.getVirtualWindow()

    expect(snapshot.scrollLeft).toBe(controller.input.scrollLeft.value)
    expect(snapshot.scrollTop).toBe(controller.input.scrollTop.value)
    expect(snapshot.virtualWindow).toEqual(windowSnapshot)
    expect(snapshot.overlaySync.scrollLeft).toBe(snapshot.scrollLeft)
    expect(snapshot.overlaySync.scrollTop).toBe(snapshot.scrollTop)
    expect(snapshot.pinnedWidth.left).toBe(220)
    expect(snapshot.pinnedWidth.right).toBe(130)
    expect(snapshot.visibleColumnRange.total).toBe(2)
    expect(snapshot.visibleRowRange.total).toBe(300)
    expect(snapshot.visibleRowRange.end).toBeGreaterThan(snapshot.visibleRowRange.start)
    expect(snapshot.visibleRowRange.start).toBe(snapshot.virtualWindow.rowStart)
    expect(snapshot.visibleRowRange.end).toBe(snapshot.virtualWindow.rowEnd)
    expect(snapshot.visibleColumnRange.start).toBe(snapshot.virtualWindow.colStart)
    expect(snapshot.visibleColumnRange.end).toBe(snapshot.virtualWindow.colEnd)
    expect(snapshot.virtualWindow.overscan.top).toBeGreaterThanOrEqual(0)
    expect(snapshot.virtualWindow.overscan.bottom).toBeGreaterThanOrEqual(0)
    expect(snapshot.virtualWindow.overscan.left).toBeGreaterThanOrEqual(0)
    expect(snapshot.virtualWindow.overscan.right).toBeGreaterThanOrEqual(0)
    expect(windowPayloads.length).toBeGreaterThan(0)
    const latestWindowPayload = windowPayloads[windowPayloads.length - 1]!
    expect(latestWindowPayload.rowStart).toBe(snapshot.virtualWindow.rowStart)
    expect(latestWindowPayload.rowEnd).toBe(snapshot.virtualWindow.rowEnd)
    expect(latestWindowPayload.colStart).toBe(snapshot.virtualWindow.colStart)
    expect(latestWindowPayload.colEnd).toBe(snapshot.virtualWindow.colEnd)
    expect(latestWindowPayload.scrollTop).toBe(snapshot.scrollTop)
    expect(latestWindowPayload.scrollLeft).toBe(snapshot.scrollLeft)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it("returns immutable-by-copy snapshots across repeated refresh", () => {
    const rowModel = createClientRowModel({ rows: createRows(120) })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "value", label: "Value", width: 180, pin: "none", visible: true }],
    })
    const containerMetrics = createMeasuredElement({
      clientWidth: 720,
      clientHeight: 420,
      scrollWidth: 720,
      scrollHeight: 7200,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 720,
      clientHeight: 42,
      scrollWidth: 720,
      scrollHeight: 42,
    })
    let onWindowCalls = 0
    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel,
      columnModel,
      imperativeCallbacks: {
        onWindow() {
          onWindowCalls += 1
        },
      },
    })

    controller.attach(containerMetrics.element, headerMetrics.element)
    controller.setViewportMetrics({
      containerWidth: containerMetrics.state.clientWidth,
      containerHeight: containerMetrics.state.clientHeight,
      headerHeight: headerMetrics.state.clientHeight,
    })
    controller.refresh(true)
    const baselineWindowCalls = onWindowCalls

    containerMetrics.element.scrollTop = 320
    containerMetrics.element.dispatchEvent(new Event("scroll"))
    controller.refresh(true)
    const afterScrollWindowCalls = onWindowCalls
    expect(afterScrollWindowCalls).toBe(baselineWindowCalls + 1)
    controller.refresh(true)
    controller.refresh(true)
    expect(onWindowCalls).toBe(afterScrollWindowCalls)

    const baseline = controller.getIntegrationSnapshot()
    const baselineWindow = controller.getVirtualWindow()
    const syncStateCopy = controller.getViewportSyncState()
    syncStateCopy.scrollLeft = 999_999
    syncStateCopy.scrollTop = 999_999
    baseline.overlaySync.scrollLeft = 111
    baseline.overlaySync.scrollTop = 222
    baseline.virtualWindow.rowStart = 999_999
    baseline.virtualWindow.colStart = 999_999
    baseline.virtualWindow.overscan.top = 999_999
    baselineWindow.rowStart = 555_555
    baselineWindow.colStart = 555_555
    baselineWindow.overscan.top = 555_555

    controller.refresh(true)
    const repeat = controller.getIntegrationSnapshot()
    controller.refresh(true)
    const repeatB = controller.getIntegrationSnapshot()

    expect(repeat).toEqual(repeatB)
    expect(onWindowCalls).toBe(baselineWindowCalls)
    expect(repeat.overlaySync.scrollLeft).not.toBe(111)
    expect(repeat.overlaySync.scrollTop).not.toBe(222)
    expect(repeat.virtualWindow.rowStart).not.toBe(999_999)
    expect(repeat.virtualWindow.colStart).not.toBe(999_999)
    expect(repeat.virtualWindow.overscan.top).not.toBe(999_999)
    expect(repeat.virtualWindow.rowStart).not.toBe(555_555)
    expect(repeat.virtualWindow.colStart).not.toBe(555_555)
    expect(repeat.virtualWindow.overscan.top).not.toBe(555_555)
    expect(controller.getViewportSyncState().scrollLeft).not.toBe(999_999)
    expect(controller.getViewportSyncState().scrollTop).not.toBe(999_999)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })
})
