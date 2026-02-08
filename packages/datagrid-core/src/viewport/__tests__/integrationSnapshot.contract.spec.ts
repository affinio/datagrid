import { describe, expect, it } from "vitest"
import type { DataGridColumn, VisibleRow } from "../../types"
import { createClientRowModel, createDataGridColumnModel } from "../../models"
import { createTableViewportController } from "../tableViewportController"

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
    const controller = createTableViewportController({
      resolvePinMode: column => (column.pin === "left" || column.pin === "right" ? column.pin : "none"),
      rowModel,
      columnModel,
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

    expect(snapshot.scrollLeft).toBe(controller.input.scrollLeft.value)
    expect(snapshot.scrollTop).toBe(controller.input.scrollTop.value)
    expect(snapshot.overlaySync.scrollLeft).toBe(snapshot.scrollLeft)
    expect(snapshot.overlaySync.scrollTop).toBe(snapshot.scrollTop)
    expect(snapshot.pinnedWidth.left).toBe(220)
    expect(snapshot.pinnedWidth.right).toBe(130)
    expect(snapshot.visibleColumnRange.total).toBe(2)
    expect(snapshot.visibleRowRange.total).toBe(300)
    expect(snapshot.visibleRowRange.end).toBeGreaterThan(snapshot.visibleRowRange.start)

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
    const controller = createTableViewportController({
      resolvePinMode: () => "none",
      rowModel,
      columnModel,
    })

    controller.attach(containerMetrics.element, headerMetrics.element)
    controller.setViewportMetrics({
      containerWidth: containerMetrics.state.clientWidth,
      containerHeight: containerMetrics.state.clientHeight,
      headerHeight: headerMetrics.state.clientHeight,
    })
    controller.refresh(true)

    const baseline = controller.getIntegrationSnapshot()
    const syncStateCopy = controller.getViewportSyncState()
    syncStateCopy.scrollLeft = 999_999
    syncStateCopy.scrollTop = 999_999
    baseline.overlaySync.scrollLeft = 111
    baseline.overlaySync.scrollTop = 222

    controller.refresh(true)
    const repeat = controller.getIntegrationSnapshot()
    controller.refresh(true)
    const repeatB = controller.getIntegrationSnapshot()

    expect(repeat).toEqual(repeatB)
    expect(repeat.overlaySync.scrollLeft).not.toBe(111)
    expect(repeat.overlaySync.scrollTop).not.toBe(222)
    expect(controller.getViewportSyncState().scrollLeft).not.toBe(999_999)
    expect(controller.getViewportSyncState().scrollTop).not.toBe(999_999)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })
})
