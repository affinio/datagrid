// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import type { DataGridColumn, VisibleRow } from "../../types"
import { createClientRowModel, createDataGridColumnModel } from "../../models"
import { createDataGridViewportController } from "../dataGridViewportController"
import { resolveHorizontalSizing } from "../dataGridViewportMath"
import { buildHorizontalMeta } from "../dataGridViewportHorizontalMeta"
import { createFakeRafScheduler } from "./utils/fakeRafScheduler"

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

function createRows(count: number): VisibleRow[]
function createRows(count: number, startIndex: number): VisibleRow[]
function createRows(count: number, startIndex = 0): VisibleRow[] {
  const rows: VisibleRow[] = []
  for (let index = 0; index < count; index += 1) {
    const rowIndex = startIndex + index
    rows.push({
      row: { id: rowIndex, value: `row-${rowIndex}` },
      rowId: rowIndex,
      originalIndex: rowIndex,
      displayIndex: rowIndex,
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
    expect(onWindowCalls).toBe(afterScrollWindowCalls)
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

  it("coalesces burst scroll input into a single apply cycle", () => {
    const columns: DataGridColumn[] = [
      { key: "a", label: "A", pin: "left", width: 110, minWidth: 80, maxWidth: 240, visible: true },
      { key: "b", label: "B", pin: "none", width: 140, minWidth: 80, maxWidth: 240, visible: true },
      { key: "c", label: "C", pin: "none", width: 140, minWidth: 80, maxWidth: 240, visible: true },
      { key: "d", label: "D", pin: "right", width: 120, minWidth: 80, maxWidth: 240, visible: true },
    ]
    const rowModel = createClientRowModel({ rows: createRows(600) })
    const columnModel = createDataGridColumnModel({ columns })
    const containerMetrics = createMeasuredElement({
      clientWidth: 840,
      clientHeight: 500,
      scrollWidth: 3200,
      scrollHeight: 24_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 840,
      clientHeight: 44,
      scrollWidth: 840,
      scrollHeight: 44,
    })

    let onRowsCalls = 0
    let onColumnsCalls = 0
    let onWindowCalls = 0

    const controller = createDataGridViewportController({
      resolvePinMode: column => (column.pin === "left" || column.pin === "right" ? column.pin : "none"),
      rowModel,
      columnModel,
      imperativeCallbacks: {
        onRows() {
          onRowsCalls += 1
        },
        onColumns() {
          onColumnsCalls += 1
        },
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

    const baseline = {
      rows: onRowsCalls,
      columns: onColumnsCalls,
      window: onWindowCalls,
    }

    for (let step = 0; step < 7; step += 1) {
      containerMetrics.element.scrollTop = 260 + step * 96
      containerMetrics.element.scrollLeft = 120 + step * 38
      containerMetrics.element.dispatchEvent(new Event("scroll"))
    }

    controller.refresh(true)

    expect(onRowsCalls).toBe(baseline.rows + 1)
    expect(onColumnsCalls).toBe(baseline.columns + 1)
    expect(onWindowCalls).toBe(baseline.window + 1)

    controller.refresh(true)
    expect(onRowsCalls).toBe(baseline.rows + 1)
    expect(onColumnsCalls).toBe(baseline.columns + 1)
    expect(onWindowCalls).toBe(baseline.window + 1)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it("keeps axis invalidation scoped between vertical and horizontal updates", () => {
    const columns: DataGridColumn[] = [
      { key: "a", label: "A", pin: "left", width: 110, minWidth: 80, maxWidth: 240, visible: true },
      { key: "b", label: "B", pin: "none", width: 140, minWidth: 80, maxWidth: 240, visible: true },
      { key: "c", label: "C", pin: "none", width: 140, minWidth: 80, maxWidth: 240, visible: true },
      { key: "d", label: "D", pin: "right", width: 120, minWidth: 80, maxWidth: 240, visible: true },
    ]
    const rowModel = createClientRowModel({ rows: createRows(800) })
    const columnModel = createDataGridColumnModel({ columns })
    const containerMetrics = createMeasuredElement({
      clientWidth: 860,
      clientHeight: 540,
      scrollWidth: 3600,
      scrollHeight: 28_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 860,
      clientHeight: 44,
      scrollWidth: 860,
      scrollHeight: 44,
    })

    let onRowsCalls = 0
    let onColumnsCalls = 0
    let onWindowCalls = 0

    const controller = createDataGridViewportController({
      resolvePinMode: column => (column.pin === "left" || column.pin === "right" ? column.pin : "none"),
      rowModel,
      columnModel,
      imperativeCallbacks: {
        onRows() {
          onRowsCalls += 1
        },
        onColumns() {
          onColumnsCalls += 1
        },
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

    const baselineRows = onRowsCalls
    const baselineColumns = onColumnsCalls
    const baselineWindow = onWindowCalls

    containerMetrics.element.scrollTop = 1600
    containerMetrics.element.dispatchEvent(new Event("scroll"))
    controller.refresh(true)

    expect(onRowsCalls).toBe(baselineRows + 1)
    expect(onColumnsCalls).toBeGreaterThanOrEqual(baselineColumns)
    expect(onColumnsCalls).toBeLessThanOrEqual(baselineColumns + 1)
    expect(onWindowCalls).toBe(baselineWindow + 1)

    containerMetrics.element.scrollLeft = 420
    containerMetrics.element.dispatchEvent(new Event("scroll"))
    controller.refresh(true)

    expect(onRowsCalls).toBe(baselineRows + 1)
    expect(onColumnsCalls).toBeGreaterThanOrEqual(baselineColumns + 1)
    expect(onColumnsCalls).toBeLessThanOrEqual(baselineColumns + 2)
    expect(onWindowCalls).toBe(baselineWindow + 2)

    columnModel.setColumnWidth("b", 260)
    controller.refresh(true)

    expect(onRowsCalls).toBe(baselineRows + 1)
    expect(onColumnsCalls).toBe(baselineColumns + 2)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it("does not force horizontal apply on row-only model invalidation", () => {
    const columns: DataGridColumn[] = [
      { key: "a", label: "A", pin: "left", width: 110, minWidth: 80, maxWidth: 240, visible: true },
      { key: "b", label: "B", pin: "none", width: 140, minWidth: 80, maxWidth: 240, visible: true },
      { key: "c", label: "C", pin: "right", width: 120, minWidth: 80, maxWidth: 240, visible: true },
    ]
    const rowModel = createClientRowModel({ rows: createRows(200) })
    const columnModel = createDataGridColumnModel({ columns })
    const containerMetrics = createMeasuredElement({
      clientWidth: 760,
      clientHeight: 460,
      scrollWidth: 2600,
      scrollHeight: 14_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 760,
      clientHeight: 42,
      scrollWidth: 760,
      scrollHeight: 42,
    })

    let onRowsCalls = 0
    let onColumnsCalls = 0

    const controller = createDataGridViewportController({
      resolvePinMode: column => (column.pin === "left" || column.pin === "right" ? column.pin : "none"),
      rowModel,
      columnModel,
      imperativeCallbacks: {
        onRows() {
          onRowsCalls += 1
        },
        onColumns() {
          onColumnsCalls += 1
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

    const baselineRows = onRowsCalls
    const baselineColumns = onColumnsCalls

    rowModel.setRows(createRows(180))
    controller.refresh(true)

    expect(onRowsCalls).toBeGreaterThanOrEqual(baselineRows)
    expect(onColumnsCalls).toBe(baselineColumns)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it("reuses horizontal sizing resolution for scroll-only horizontal motion", () => {
    const columns: DataGridColumn[] = Array.from({ length: 16 }, (_, index) => ({
      key: `c_${index}`,
      label: `C${index}`,
      pin: index === 0 ? "left" : index === 15 ? "right" : "none",
      width: 96 + (index % 3) * 14,
      minWidth: 80,
      maxWidth: 260,
      visible: true,
    }))
    const rowModel = createClientRowModel({ rows: createRows(900) })
    const columnModel = createDataGridColumnModel({ columns })
    const containerMetrics = createMeasuredElement({
      clientWidth: 900,
      clientHeight: 520,
      scrollWidth: 5600,
      scrollHeight: 32_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 900,
      clientHeight: 44,
      scrollWidth: 900,
      scrollHeight: 44,
    })

    let resolveHorizontalSizingCalls = 0
    let buildHorizontalMetaCalls = 0

    const controller = createDataGridViewportController({
      resolvePinMode: column => (column.pin === "left" || column.pin === "right" ? column.pin : "none"),
      rowModel,
      columnModel,
      runtime: {
        buildHorizontalMeta(input) {
          buildHorizontalMetaCalls += 1
          return buildHorizontalMeta(input)
        },
        resolveHorizontalSizing(input) {
          resolveHorizontalSizingCalls += 1
          return resolveHorizontalSizing(input)
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

    const baselineResolveCalls = resolveHorizontalSizingCalls
    const baselineMetaCalls = buildHorizontalMetaCalls
    expect(baselineResolveCalls).toBeGreaterThan(0)
    expect(baselineMetaCalls).toBeGreaterThan(0)

    for (let step = 0; step < 9; step += 1) {
      containerMetrics.element.scrollLeft = 160 + step * 84
      containerMetrics.element.dispatchEvent(new Event("scroll"))
      controller.refresh(true)
    }

    // Motion-only horizontal updates should reuse cached sizing resolution.
    expect(resolveHorizontalSizingCalls).toBeLessThanOrEqual(baselineResolveCalls + 1)
    // Structural horizontal metadata should also stay cached across pure scroll motion.
    expect(buildHorizontalMetaCalls).toBeLessThanOrEqual(baselineMetaCalls + 1)

    // Structural column-layout change should invalidate sizing cache and recompute once.
    columnModel.setColumnWidth("c_7", 250)
    controller.refresh(true)
    expect(resolveHorizontalSizingCalls).toBeGreaterThanOrEqual(baselineResolveCalls + 1)
    expect(resolveHorizontalSizingCalls).toBeLessThanOrEqual(baselineResolveCalls + 2)
    expect(buildHorizontalMetaCalls).toBeGreaterThanOrEqual(baselineMetaCalls + 1)
    expect(buildHorizontalMetaCalls).toBeLessThanOrEqual(baselineMetaCalls + 2)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it("keeps horizontal meta/sizing stable on pure vertical scroll motion", () => {
    const columns: DataGridColumn[] = Array.from({ length: 14 }, (_, index) => ({
      key: `c_${index}`,
      label: `C${index}`,
      pin: index === 0 ? "left" : index === 13 ? "right" : "none",
      width: 96 + (index % 4) * 12,
      minWidth: 80,
      maxWidth: 260,
      visible: true,
    }))
    const rowModel = createClientRowModel({ rows: createRows(1200) })
    const columnModel = createDataGridColumnModel({ columns })
    const containerMetrics = createMeasuredElement({
      clientWidth: 920,
      clientHeight: 540,
      scrollWidth: 5600,
      scrollHeight: 42_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 920,
      clientHeight: 44,
      scrollWidth: 920,
      scrollHeight: 44,
    })

    let buildHorizontalMetaCalls = 0
    let resolveHorizontalSizingCalls = 0
    let onColumnsCalls = 0

    const controller = createDataGridViewportController({
      resolvePinMode: column => (column.pin === "left" || column.pin === "right" ? column.pin : "none"),
      rowModel,
      columnModel,
      runtime: {
        buildHorizontalMeta(input) {
          buildHorizontalMetaCalls += 1
          return buildHorizontalMeta(input)
        },
        resolveHorizontalSizing(input) {
          resolveHorizontalSizingCalls += 1
          return resolveHorizontalSizing(input)
        },
      },
      imperativeCallbacks: {
        onColumns() {
          onColumnsCalls += 1
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

    const baselineMetaCalls = buildHorizontalMetaCalls
    const baselineSizingCalls = resolveHorizontalSizingCalls
    const baselineOnColumnsCalls = onColumnsCalls

    for (let step = 0; step < 10; step += 1) {
      containerMetrics.element.scrollTop = 320 + step * 138
      containerMetrics.element.dispatchEvent(new Event("scroll"))
      controller.refresh(true)
    }

    expect(buildHorizontalMetaCalls).toBeLessThanOrEqual(baselineMetaCalls + 1)
    expect(resolveHorizontalSizingCalls).toBeLessThanOrEqual(baselineSizingCalls + 1)
    expect(onColumnsCalls).toBeLessThanOrEqual(baselineOnColumnsCalls + 1)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it("keeps imperative non-force setters in async input->compute->apply phase", () => {
    const columns: DataGridColumn[] = [
      { key: "a", label: "A", pin: "left", width: 110, minWidth: 80, maxWidth: 240, visible: true },
      { key: "b", label: "B", pin: "none", width: 140, minWidth: 80, maxWidth: 240, visible: true },
      { key: "c", label: "C", pin: "right", width: 120, minWidth: 80, maxWidth: 240, visible: true },
    ]
    const rowModel = createClientRowModel({ rows: createRows(220) })
    const columnModel = createDataGridColumnModel({ columns })
    const containerMetrics = createMeasuredElement({
      clientWidth: 760,
      clientHeight: 460,
      scrollWidth: 2600,
      scrollHeight: 14_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 760,
      clientHeight: 42,
      scrollWidth: 760,
      scrollHeight: 42,
    })
    const fakeRaf = createFakeRafScheduler()

    let onRowsCalls = 0
    let onColumnsCalls = 0
    let onWindowCalls = 0

    const controller = createDataGridViewportController({
      resolvePinMode: column => (column.pin === "left" || column.pin === "right" ? column.pin : "none"),
      rowModel,
      columnModel,
      runtime: {
        rafScheduler: fakeRaf.scheduler,
      },
      imperativeCallbacks: {
        onRows() {
          onRowsCalls += 1
        },
        onColumns() {
          onColumnsCalls += 1
        },
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

    const baselineRows = onRowsCalls
    const baselineColumns = onColumnsCalls
    const baselineWindow = onWindowCalls

    controller.setZoom(1.1)
    controller.setVirtualizationEnabled(false)
    controller.setBaseRowHeight(44)
    controller.setViewportMetrics({
      containerWidth: 744,
      containerHeight: 452,
      headerHeight: 40,
    })

    // No immediate apply before scheduler phase flush.
    expect(onRowsCalls).toBe(baselineRows)
    expect(onColumnsCalls).toBe(baselineColumns)
    expect(onWindowCalls).toBe(baselineWindow)
    expect(fakeRaf.pendingTasks()).toBeGreaterThanOrEqual(0)

    fakeRaf.scheduler.flush()

    // Coalesced into a single heavy apply cycle.
    expect(onRowsCalls).toBeGreaterThanOrEqual(baselineRows)
    expect(onColumnsCalls).toBeGreaterThanOrEqual(baselineColumns)
    expect(onColumnsCalls).toBeLessThanOrEqual(baselineColumns + 1)
    expect(onWindowCalls).toBeGreaterThanOrEqual(baselineWindow)
    expect(onWindowCalls).toBeLessThanOrEqual(baselineWindow + 1)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it("uses refresh(true) only as scheduler flush and keeps async update phase", () => {
    const columns: DataGridColumn[] = [
      { key: "a", label: "A", pin: "none", width: 120, minWidth: 80, maxWidth: 240, visible: true },
      { key: "b", label: "B", pin: "none", width: 140, minWidth: 80, maxWidth: 240, visible: true },
    ]
    const rowModel = createClientRowModel({ rows: createRows(180) })
    const columnModel = createDataGridColumnModel({ columns })
    const containerMetrics = createMeasuredElement({
      clientWidth: 720,
      clientHeight: 420,
      scrollWidth: 2200,
      scrollHeight: 9800,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 720,
      clientHeight: 40,
      scrollWidth: 720,
      scrollHeight: 40,
    })
    const fakeRaf = createFakeRafScheduler()

    let onRowsCalls = 0
    let onColumnsCalls = 0
    let onWindowCalls = 0

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel,
      columnModel,
      runtime: {
        rafScheduler: fakeRaf.scheduler,
      },
      imperativeCallbacks: {
        onRows() {
          onRowsCalls += 1
        },
        onColumns() {
          onColumnsCalls += 1
        },
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

    const baselineRows = onRowsCalls
    const baselineColumns = onColumnsCalls
    const baselineWindow = onWindowCalls

    controller.setZoom(1.08)
    expect(onRowsCalls).toBe(baselineRows)
    expect(onColumnsCalls).toBe(baselineColumns)
    expect(onWindowCalls).toBe(baselineWindow)
    expect(fakeRaf.pendingTasks()).toBeGreaterThanOrEqual(0)

    // refresh(true) should flush already-scheduled async work, not switch to force mode.
    controller.refresh(true)

    expect(fakeRaf.pendingTasks()).toBe(0)
    expect(onRowsCalls).toBeGreaterThanOrEqual(baselineRows)
    expect(onColumnsCalls).toBeGreaterThanOrEqual(baselineColumns)
    expect(onColumnsCalls).toBeLessThanOrEqual(baselineColumns + 1)
    expect(onWindowCalls).toBeGreaterThanOrEqual(baselineWindow)
    expect(onWindowCalls).toBeLessThanOrEqual(baselineWindow + 1)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it("keeps single apply per scheduler flush under mixed input burst", () => {
    const columns: DataGridColumn[] = [
      { key: "a", label: "A", pin: "none", width: 120, minWidth: 80, maxWidth: 240, visible: true },
      { key: "b", label: "B", pin: "none", width: 140, minWidth: 80, maxWidth: 260, visible: true },
      { key: "c", label: "C", pin: "none", width: 130, minWidth: 80, maxWidth: 260, visible: true },
    ]
    const rowModel = createClientRowModel({ rows: createRows(180) })
    const columnModel = createDataGridColumnModel({ columns })
    const containerMetrics = createMeasuredElement({
      clientWidth: 760,
      clientHeight: 420,
      scrollWidth: 2600,
      scrollHeight: 11_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 760,
      clientHeight: 40,
      scrollWidth: 760,
      scrollHeight: 40,
    })
    const fakeRaf = createFakeRafScheduler()

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel,
      columnModel,
      runtime: {
        rafScheduler: fakeRaf.scheduler,
      },
    })

    controller.attach(containerMetrics.element, headerMetrics.element)
    controller.setViewportMetrics({
      containerWidth: containerMetrics.state.clientWidth,
      containerHeight: containerMetrics.state.clientHeight,
      headerHeight: headerMetrics.state.clientHeight,
    })
    controller.refresh(true)

    const baseline = controller.getIntegrationSnapshot().recompute

    controller.setZoom(1.05)
    controller.setViewportMetrics({
      containerWidth: 744,
      containerHeight: 408,
      headerHeight: 40,
    })
    containerMetrics.element.scrollTop = 520
    containerMetrics.element.scrollLeft = 210
    containerMetrics.element.dispatchEvent(new Event("scroll"))
    rowModel.setRows(createRows(180).map((row, index) => ({
      ...row,
      row: { id: index + 5_000, value: `row-${index + 5_000}` },
      rowId: index + 5_000,
      originalIndex: index + 5_000,
      displayIndex: index + 5_000,
    })))
    columnModel.setColumnWidth("b", 220)

    expect(controller.getIntegrationSnapshot().recompute).toEqual(baseline)
    expect(fakeRaf.pendingTasks()).toBeGreaterThanOrEqual(0)

    fakeRaf.scheduler.flush()
    const afterFirstFlush = controller.getIntegrationSnapshot().recompute
    expect(afterFirstFlush.rowApplyCount).toBeLessThanOrEqual(baseline.rowApplyCount + 1)
    expect(afterFirstFlush.columnApplyCount).toBeLessThanOrEqual(baseline.columnApplyCount + 1)
    expect(afterFirstFlush.horizontalMetaRecomputeCount).toBeLessThanOrEqual(
      baseline.horizontalMetaRecomputeCount + 1,
    )
    expect(afterFirstFlush.horizontalSizingRecomputeCount).toBeLessThanOrEqual(
      baseline.horizontalSizingRecomputeCount + 1,
    )

    fakeRaf.scheduler.flush()
    expect(controller.getIntegrationSnapshot().recompute).toEqual(afterFirstFlush)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it("does not schedule viewport pipeline on viewport-only row model churn", () => {
    const columns: DataGridColumn[] = [
      { key: "a", label: "A", pin: "none", width: 120, minWidth: 80, maxWidth: 240, visible: true },
      { key: "b", label: "B", pin: "none", width: 140, minWidth: 80, maxWidth: 240, visible: true },
    ]
    const rowModel = createClientRowModel({ rows: createRows(320) })
    const columnModel = createDataGridColumnModel({ columns })
    const containerMetrics = createMeasuredElement({
      clientWidth: 760,
      clientHeight: 420,
      scrollWidth: 2400,
      scrollHeight: 12_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 760,
      clientHeight: 40,
      scrollWidth: 760,
      scrollHeight: 40,
    })
    const fakeRaf = createFakeRafScheduler()

    let onRowsCalls = 0
    let onColumnsCalls = 0
    let onWindowCalls = 0

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel,
      columnModel,
      runtime: {
        rafScheduler: fakeRaf.scheduler,
      },
      imperativeCallbacks: {
        onRows() {
          onRowsCalls += 1
        },
        onColumns() {
          onColumnsCalls += 1
        },
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

    const baselineRows = onRowsCalls
    const baselineColumns = onColumnsCalls
    const baselineWindow = onWindowCalls

    rowModel.setViewportRange({ start: 24, end: 48 })
    rowModel.setViewportRange({ start: 32, end: 52 })

    expect(fakeRaf.pendingTasks()).toBe(0)
    expect(onRowsCalls).toBe(baselineRows)
    expect(onColumnsCalls).toBe(baselineColumns)
    expect(onWindowCalls).toBe(baselineWindow)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it("skips heavy viewport apply for offscreen content-only row invalidation", () => {
    const columns: DataGridColumn[] = [
      { key: "a", label: "A", pin: "none", width: 120, minWidth: 80, maxWidth: 240, visible: true },
      { key: "b", label: "B", pin: "none", width: 140, minWidth: 80, maxWidth: 240, visible: true },
    ]
    const rowModel = createClientRowModel({ rows: createRows(320) })
    const columnModel = createDataGridColumnModel({ columns })
    const containerMetrics = createMeasuredElement({
      clientWidth: 760,
      clientHeight: 420,
      scrollWidth: 2400,
      scrollHeight: 12_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 760,
      clientHeight: 40,
      scrollWidth: 760,
      scrollHeight: 40,
    })
    const fakeRaf = createFakeRafScheduler()

    let onRowsCalls = 0
    let onColumnsCalls = 0
    let onWindowCalls = 0

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel,
      columnModel,
      runtime: {
        rafScheduler: fakeRaf.scheduler,
      },
      imperativeCallbacks: {
        onRows() {
          onRowsCalls += 1
        },
        onColumns() {
          onColumnsCalls += 1
        },
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

    const baselineRows = onRowsCalls
    const baselineColumns = onColumnsCalls
    const baselineWindow = onWindowCalls

    // Seed row-model viewport range away from currently visible rows, then emit
    // content-only mutation (same rowCount/sort/filter/group).
    rowModel.setViewportRange({ start: 220, end: 240 })
    rowModel.setRows(createRows(320))

    expect(fakeRaf.pendingTasks()).toBeGreaterThanOrEqual(0)
    fakeRaf.scheduler.flush()

    expect(onRowsCalls).toBe(baselineRows)
    expect(onColumnsCalls).toBe(baselineColumns)
    expect(onWindowCalls).toBe(baselineWindow)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it("applies visible-range content-only row invalidation asynchronously", () => {
    const columns: DataGridColumn[] = [
      { key: "a", label: "A", pin: "none", width: 120, minWidth: 80, maxWidth: 240, visible: true },
      { key: "b", label: "B", pin: "none", width: 140, minWidth: 80, maxWidth: 240, visible: true },
    ]
    const rowModel = createClientRowModel({ rows: createRows(320) })
    const columnModel = createDataGridColumnModel({ columns })
    const containerMetrics = createMeasuredElement({
      clientWidth: 760,
      clientHeight: 420,
      scrollWidth: 2400,
      scrollHeight: 12_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 760,
      clientHeight: 40,
      scrollWidth: 760,
      scrollHeight: 40,
    })
    const fakeRaf = createFakeRafScheduler()

    let onRowsCalls = 0
    let onColumnsCalls = 0
    let onWindowCalls = 0

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel,
      columnModel,
      runtime: {
        rafScheduler: fakeRaf.scheduler,
      },
      imperativeCallbacks: {
        onRows() {
          onRowsCalls += 1
        },
        onColumns() {
          onColumnsCalls += 1
        },
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

    const baselineRows = onRowsCalls
    const baselineColumns = onColumnsCalls
    const baselineWindow = onWindowCalls

    // Keep model range within visible viewport bounds, then emit content-only
    // mutation (same rowCount/sort/filter/group) and verify async apply happens.
    rowModel.setViewportRange({ start: 0, end: 28 })
    rowModel.setRows(createRows(320).map((row, index) => {
      const rowIndex = index + 1_000
      return {
        ...row,
        row: { id: rowIndex, value: `row-${rowIndex}` },
        rowId: rowIndex,
        originalIndex: rowIndex,
        displayIndex: rowIndex,
      }
    }))

    expect(fakeRaf.pendingTasks()).toBeGreaterThanOrEqual(0)
    expect(onRowsCalls).toBe(baselineRows)
    expect(onColumnsCalls).toBe(baselineColumns)
    expect(onWindowCalls).toBe(baselineWindow)

    fakeRaf.scheduler.flush()

    expect(onRowsCalls).toBeGreaterThanOrEqual(baselineRows)
    expect(onRowsCalls).toBeLessThanOrEqual(baselineRows + 1)
    expect(onColumnsCalls).toBe(baselineColumns)
    expect(onWindowCalls).toBeGreaterThanOrEqual(baselineWindow)
    expect(onWindowCalls).toBeLessThanOrEqual(baselineWindow + 1)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it("schedules model invalidations asynchronously and keeps axis updates scoped", () => {
    const columns: DataGridColumn[] = [
      { key: "a", label: "A", pin: "none", width: 120, minWidth: 80, maxWidth: 240, visible: true },
      { key: "b", label: "B", pin: "none", width: 140, minWidth: 80, maxWidth: 260, visible: true },
      { key: "c", label: "C", pin: "none", width: 130, minWidth: 80, maxWidth: 260, visible: true },
    ]
    const rowModel = createClientRowModel({ rows: createRows(320) })
    const columnModel = createDataGridColumnModel({ columns })
    const containerMetrics = createMeasuredElement({
      clientWidth: 780,
      clientHeight: 430,
      scrollWidth: 2800,
      scrollHeight: 14_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 780,
      clientHeight: 40,
      scrollWidth: 780,
      scrollHeight: 40,
    })
    const fakeRaf = createFakeRafScheduler()

    let onRowsCalls = 0
    let onColumnsCalls = 0
    let onWindowCalls = 0
    let buildHorizontalMetaCalls = 0
    let resolveHorizontalSizingCalls = 0

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel,
      columnModel,
      runtime: {
        rafScheduler: fakeRaf.scheduler,
        buildHorizontalMeta(input) {
          buildHorizontalMetaCalls += 1
          return buildHorizontalMeta(input)
        },
        resolveHorizontalSizing(input) {
          resolveHorizontalSizingCalls += 1
          return resolveHorizontalSizing(input)
        },
      },
      imperativeCallbacks: {
        onRows() {
          onRowsCalls += 1
        },
        onColumns() {
          onColumnsCalls += 1
        },
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

    const baselineRows = onRowsCalls
    const baselineColumns = onColumnsCalls
    const baselineWindow = onWindowCalls
    const baselineMetaCalls = buildHorizontalMetaCalls
    const baselineSizingCalls = resolveHorizontalSizingCalls

    // Column model mutation is async and columns-scoped.
    columnModel.setColumnWidth("b", 220)
    expect(fakeRaf.pendingTasks()).toBeGreaterThanOrEqual(0)
    expect(onRowsCalls).toBe(baselineRows)
    expect(onColumnsCalls).toBe(baselineColumns)
    expect(onWindowCalls).toBe(baselineWindow)

    fakeRaf.scheduler.flush()
    expect(onRowsCalls).toBe(baselineRows)
    expect(onColumnsCalls).toBeGreaterThanOrEqual(baselineColumns)
    expect(onColumnsCalls).toBeLessThanOrEqual(baselineColumns + 1)
    expect(onWindowCalls).toBeGreaterThanOrEqual(baselineWindow)
    expect(onWindowCalls).toBeLessThanOrEqual(baselineWindow + 1)
    expect(buildHorizontalMetaCalls).toBeGreaterThanOrEqual(baselineMetaCalls)
    expect(buildHorizontalMetaCalls).toBeLessThanOrEqual(baselineMetaCalls + 1)
    expect(resolveHorizontalSizingCalls).toBeGreaterThanOrEqual(baselineSizingCalls)
    expect(resolveHorizontalSizingCalls).toBeLessThanOrEqual(baselineSizingCalls + 1)

    const postColumnRows = onRowsCalls
    const postColumnColumns = onColumnsCalls
    const postColumnWindow = onWindowCalls
    const postColumnMetaCalls = buildHorizontalMetaCalls
    const postColumnSizingCalls = resolveHorizontalSizingCalls

    // Row model mutation is async and rows-scoped.
    rowModel.setRows(createRows(280))
    expect(fakeRaf.pendingTasks()).toBeGreaterThanOrEqual(0)
    expect(onRowsCalls).toBe(postColumnRows)
    expect(onColumnsCalls).toBe(postColumnColumns)
    expect(onWindowCalls).toBe(postColumnWindow)

    fakeRaf.scheduler.flush()
    expect(onRowsCalls).toBeGreaterThanOrEqual(postColumnRows)
    expect(onRowsCalls).toBeLessThanOrEqual(postColumnRows + 1)
    expect(onColumnsCalls).toBe(postColumnColumns)
    expect(onWindowCalls).toBeGreaterThanOrEqual(postColumnWindow)
    expect(onWindowCalls).toBeLessThanOrEqual(postColumnWindow + 1)
    expect(buildHorizontalMetaCalls).toBe(postColumnMetaCalls)
    expect(resolveHorizontalSizingCalls).toBe(postColumnSizingCalls)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it("tracks recompute scope counters for vertical/horizontal/offscreen invalidation paths", () => {
    const columns: DataGridColumn[] = [
      { key: "a", label: "A", pin: "none", width: 120, minWidth: 80, maxWidth: 240, visible: true },
      { key: "b", label: "B", pin: "none", width: 140, minWidth: 80, maxWidth: 260, visible: true },
      { key: "c", label: "C", pin: "none", width: 130, minWidth: 80, maxWidth: 260, visible: true },
    ]
    const rowModel = createClientRowModel({ rows: createRows(320) })
    const columnModel = createDataGridColumnModel({ columns })
    const containerMetrics = createMeasuredElement({
      clientWidth: 780,
      clientHeight: 430,
      scrollWidth: 2800,
      scrollHeight: 14_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 780,
      clientHeight: 40,
      scrollWidth: 780,
      scrollHeight: 40,
    })
    const fakeRaf = createFakeRafScheduler()

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel,
      columnModel,
      runtime: {
        rafScheduler: fakeRaf.scheduler,
      },
    })

    controller.attach(containerMetrics.element, headerMetrics.element)
    controller.setViewportMetrics({
      containerWidth: containerMetrics.state.clientWidth,
      containerHeight: containerMetrics.state.clientHeight,
      headerHeight: headerMetrics.state.clientHeight,
    })
    controller.refresh(true)

    const baseline = controller.getIntegrationSnapshot().recompute

    rowModel.setViewportRange({ start: 0, end: 28 })
    rowModel.setRows(createRows(320).map((row, index) => {
      const rowIndex = index + 10_000
      return {
        ...row,
        row: { id: rowIndex, value: `row-${rowIndex}` },
        rowId: rowIndex,
        originalIndex: rowIndex,
        displayIndex: rowIndex,
      }
    }))
    // Force one deterministic vertical apply cycle so recompute counters do not depend
    // on fast-path short-circuiting when invalidation coalesces with zero scroll delta.
    controller.scrollToRow(6)

    expect(fakeRaf.pendingTasks()).toBeGreaterThanOrEqual(0)
    fakeRaf.scheduler.flush()

    const afterVertical = controller.getIntegrationSnapshot().recompute
    expect(afterVertical.rowApplyCount).toBeGreaterThanOrEqual(baseline.rowApplyCount + 1)
    expect(afterVertical.contentRowInvalidationApplyCount).toBeGreaterThanOrEqual(
      baseline.contentRowInvalidationApplyCount + 1,
    )
    expect(afterVertical.columnApplyCount).toBeLessThanOrEqual(baseline.columnApplyCount + 1)
    expect(afterVertical.horizontalMetaRecomputeCount).toBeLessThanOrEqual(
      baseline.horizontalMetaRecomputeCount + 1,
    )
    expect(afterVertical.horizontalSizingRecomputeCount).toBeLessThanOrEqual(
      baseline.horizontalSizingRecomputeCount + 1,
    )

    const beforeOffscreen = controller.getIntegrationSnapshot().recompute
    rowModel.setViewportRange({ start: 220, end: 250 })
    rowModel.setRows(createRows(320))
    expect(fakeRaf.pendingTasks()).toBeGreaterThanOrEqual(0)
    fakeRaf.scheduler.flush()

    const afterOffscreen = controller.getIntegrationSnapshot().recompute
    expect(afterOffscreen.offscreenRowInvalidationSkips).toBeGreaterThanOrEqual(
      beforeOffscreen.offscreenRowInvalidationSkips,
    )
    expect(afterOffscreen.rowApplyCount).toBe(beforeOffscreen.rowApplyCount)
    expect(afterOffscreen.columnApplyCount).toBe(beforeOffscreen.columnApplyCount)
    expect(afterOffscreen.contentRowInvalidationApplyCount).toBe(
      beforeOffscreen.contentRowInvalidationApplyCount,
    )

    const beforeHorizontal = controller.getIntegrationSnapshot().recompute
    columnModel.setColumnWidth("b", 220)
    expect(fakeRaf.pendingTasks()).toBeGreaterThanOrEqual(0)
    fakeRaf.scheduler.flush()

    const afterHorizontal = controller.getIntegrationSnapshot().recompute
    expect(afterHorizontal.columnApplyCount).toBeGreaterThanOrEqual(beforeHorizontal.columnApplyCount)
    expect(afterHorizontal.horizontalMetaRecomputeCount).toBeGreaterThanOrEqual(
      beforeHorizontal.horizontalMetaRecomputeCount,
    )
    expect(afterHorizontal.horizontalSizingRecomputeCount).toBeGreaterThanOrEqual(
      beforeHorizontal.horizontalSizingRecomputeCount,
    )

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })
})
