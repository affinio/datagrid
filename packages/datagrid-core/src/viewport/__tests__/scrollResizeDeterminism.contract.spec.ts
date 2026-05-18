import { describe, expect, it, vi } from "vitest"
import type { DataGridColumn, DataGridColumnInput, VisibleRow } from "../../types"
import { createClientRowModel, createDataGridColumnModel } from "../../models"
import { createDataGridViewportController } from "../dataGridViewportController"
import type { ImperativeRowUpdatePayload } from "../dataGridViewportTypes"

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

function createColumns(count: number): DataGridColumn[] {
  const columns: DataGridColumn[] = []
  for (let index = 0; index < count; index += 1) {
    const pin = index < 2 ? "left" : index >= count - 2 ? "right" : "none"
    columns.push({
      key: `col_${index}`,
      label: `Column ${index}`,
      pin,
      width: 88 + (index % 8) * 10,
      minWidth: 64,
      maxWidth: 260,
      visible: true,
    })
  }
  return columns
}

function toColumnModelInputs(columns: readonly DataGridColumn[]): DataGridColumnInput[] {
  return columns.map(({ key, field, label, minWidth, maxWidth, valueGetter, valueSetter, visible, pin, width }) => ({
    key,
    field,
    label,
    minWidth,
    maxWidth,
    valueGetter,
    valueSetter,
    initialState: {
      visible,
      pin,
      width,
    },
  }))
}

function createRows(count: number): VisibleRow[] {
  const rows: VisibleRow[] = new Array(count)
  for (let index = 0; index < count; index += 1) {
    rows[index] = {
      row: { id: index, value: `row-${index}` },
      rowId: index,
      originalIndex: index,
      displayIndex: index,
    }
  }
  return rows
}

function createPrng(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0x1_0000_0000
  }
}

function createControllerHarness() {
  const rows = createRows(50_000)
  const columns = createColumns(260)
  const rowModel = createClientRowModel({ rows })
  const columnModel = createDataGridColumnModel({ columns: toColumnModelInputs(columns) })
  const containerMetrics = createMeasuredElement({
    clientWidth: 1180,
    clientHeight: 700,
    scrollWidth: 240_000,
    scrollHeight: 2_200_000,
  })
  const headerMetrics = createMeasuredElement({
    clientWidth: 1180,
    clientHeight: 48,
    scrollWidth: 1180,
    scrollHeight: 48,
  })
  const onRows = vi.fn()
  const onColumns = vi.fn()
  const onScrollSync = vi.fn()

  const controller = createDataGridViewportController({
    resolvePinMode: column => (column.isSystem ? "left" : column.pin === "left" || column.pin === "right" ? column.pin : "none"),
    rowModel,
    columnModel,
    imperativeCallbacks: {
      onRows,
      onColumns,
      onScrollSync,
    },
  })

  controller.attach(containerMetrics.element, headerMetrics.element)
  controller.setViewportMetrics({
    containerWidth: containerMetrics.state.clientWidth,
    containerHeight: containerMetrics.state.clientHeight,
    headerHeight: headerMetrics.state.clientHeight,
  })

  return {
    controller,
    rowModel,
    columnModel,
    containerMetrics,
    headerMetrics,
    onRows,
    onColumns,
    onScrollSync,
  }
}

function snapshotControllerState(harness: ReturnType<typeof createControllerHarness>) {
  return {
    scrollLeft: Math.round(harness.controller.input.scrollLeft.value * 1000),
    scrollTop: Math.round(harness.controller.input.scrollTop.value * 1000),
    visibleRangeStart: harness.controller.derived.rows.visibleRange.value.start,
    visibleRangeEnd: harness.controller.derived.rows.visibleRange.value.end,
    columnRangeStart: harness.controller.derived.columns.scrollableRange.value.start,
    columnRangeEnd: harness.controller.derived.columns.scrollableRange.value.end,
    visibleColumns: harness.controller.derived.columns.visibleColumnEntries.value.length,
    pinnedLeft: harness.controller.derived.columns.pinnedLeftEntries.value.length,
    pinnedRight: harness.controller.derived.columns.pinnedRightEntries.value.length,
  }
}

function latestRowsPayload(harness: ReturnType<typeof createControllerHarness>): ImperativeRowUpdatePayload {
  const latestCall = harness.onRows.mock.calls[harness.onRows.mock.calls.length - 1]
  expect(latestCall).toBeDefined()
  return latestCall?.[0] as ImperativeRowUpdatePayload
}

function mapRowsByDisplayIndex(payload: ImperativeRowUpdatePayload): Map<number, VisibleRow> {
  const rows = payload.visibleRows ?? []
  return new Map(rows.map(row => [row.displayIndex, row]))
}

function expectRetainedRowsStable(
  before: Map<number, VisibleRow>,
  after: Map<number, VisibleRow>,
  options: { requireObjectIdentity: boolean },
) {
  let retained = 0
  for (const [displayIndex, row] of before.entries()) {
    const next = after.get(displayIndex)
    if (!next) {
      continue
    }
    retained += 1
    expect(next.rowId).toBe(row.rowId)
    expect(next.displayIndex).toBe(row.displayIndex)
    if (options.requireObjectIdentity) {
      expect(next).toBe(row)
    }
  }
  expect(retained).toBeGreaterThan(0)
}

function disposeHarness(harness: ReturnType<typeof createControllerHarness>) {
  harness.controller.dispose()
  harness.rowModel.dispose()
  harness.columnModel.dispose()
}

describe("scroll/resize determinism contract", () => {
  it("keeps repeated forced refresh idempotent for imperative callbacks", () => {
    const harness = createControllerHarness()
    harness.controller.refresh(true)

    const baselineRowsCalls = harness.onRows.mock.calls.length
    const baselineColumnsCalls = harness.onColumns.mock.calls.length
    const baselineScrollSyncCalls = harness.onScrollSync.mock.calls.length
    const baselineSnapshot = snapshotControllerState(harness)

    harness.controller.refresh(true)
    harness.controller.refresh(true)
    harness.controller.refresh(true)

    expect(harness.onRows.mock.calls.length).toBe(baselineRowsCalls)
    expect(harness.onColumns.mock.calls.length).toBe(baselineColumnsCalls)
    expect(harness.onScrollSync.mock.calls.length).toBe(baselineScrollSyncCalls)
    expect(snapshotControllerState(harness)).toEqual(baselineSnapshot)

    disposeHarness(harness)
  })

  it("stays deterministic under combined resize storm and scroll storm replay", () => {
    const runStorm = (seed: number) => {
      const random = createPrng(seed)
      const harness = createControllerHarness()
      harness.controller.refresh(true)

      for (let step = 0; step < 90; step += 1) {
        const width = 860 + Math.floor(random() * 540)
        const height = 520 + Math.floor(random() * 260)
        harness.containerMetrics.state.clientWidth = width
        harness.containerMetrics.state.clientHeight = height
        harness.containerMetrics.state.scrollWidth = width + 220_000 + Math.floor(random() * 40_000)
        harness.containerMetrics.state.scrollHeight = height + 1_800_000 + Math.floor(random() * 400_000)
        harness.headerMetrics.state.clientWidth = width
        harness.headerMetrics.state.scrollWidth = width
        harness.controller.setViewportMetrics({
          containerWidth: width,
          containerHeight: height,
          headerHeight: harness.headerMetrics.state.clientHeight,
        })

        const maxLeft = Math.max(0, harness.containerMetrics.state.scrollWidth - harness.containerMetrics.state.clientWidth)
        const maxTop = Math.max(0, harness.containerMetrics.state.scrollHeight - harness.containerMetrics.state.clientHeight)
        harness.containerMetrics.element.scrollLeft = Math.floor(random() * (maxLeft + 1))
        harness.containerMetrics.element.scrollTop = Math.floor(random() * (maxTop + 1))
        harness.containerMetrics.element.dispatchEvent(new Event("scroll"))
        harness.controller.refresh(true)
      }

      const settled = snapshotControllerState(harness)
      harness.controller.refresh(true)
      expect(snapshotControllerState(harness)).toEqual(settled)
      harness.controller.refresh(true)
      expect(snapshotControllerState(harness)).toEqual(settled)

      disposeHarness(harness)
      return settled
    }

    const firstReplay = runStorm(20260207)
    const secondReplay = runStorm(20260207)

    expect(secondReplay).toEqual(firstReplay)
    expect(firstReplay.visibleRangeStart).toBeGreaterThanOrEqual(0)
    expect(firstReplay.visibleRangeEnd).toBeGreaterThan(firstReplay.visibleRangeStart)
    expect(firstReplay.columnRangeStart).toBeGreaterThanOrEqual(0)
    expect(firstReplay.columnRangeEnd).toBeGreaterThan(firstReplay.columnRangeStart)
  })

  it("preserves retained row identity across resize, reversal, and viewport-active model refresh", () => {
    const harness = createControllerHarness()
    harness.controller.refresh(true)

    harness.containerMetrics.element.scrollLeft = 640
    harness.containerMetrics.element.scrollTop = 4_200
    harness.containerMetrics.element.dispatchEvent(new Event("scroll"))
    harness.controller.refresh(true)

    const beforeResizeRows = mapRowsByDisplayIndex(latestRowsPayload(harness))
    const beforeResizeSnapshot = snapshotControllerState(harness)

    harness.containerMetrics.state.clientWidth = 960
    harness.containerMetrics.state.clientHeight = 560
    harness.headerMetrics.state.clientWidth = 960
    harness.headerMetrics.state.scrollWidth = 960
    harness.controller.setViewportMetrics({
      containerWidth: harness.containerMetrics.state.clientWidth,
      containerHeight: harness.containerMetrics.state.clientHeight,
      headerHeight: harness.headerMetrics.state.clientHeight,
    })
    harness.controller.refresh(true)

    const afterResizeRows = mapRowsByDisplayIndex(latestRowsPayload(harness))
    expectRetainedRowsStable(beforeResizeRows, afterResizeRows, { requireObjectIdentity: true })
    expect(snapshotControllerState(harness).scrollLeft).toBe(beforeResizeSnapshot.scrollLeft)
    expect(snapshotControllerState(harness).scrollTop).toBe(beforeResizeSnapshot.scrollTop)

    const reverseTargetRow = Math.max(0, harness.controller.derived.rows.visibleRange.value.start - 2)
    harness.controller.scrollToRow(reverseTargetRow)

    const afterReverseRows = mapRowsByDisplayIndex(latestRowsPayload(harness))
    expect(harness.controller.core.overscanLeading.value).toBeGreaterThan(
      harness.controller.core.overscanTrailing.value,
    )
    expectRetainedRowsStable(afterResizeRows, afterReverseRows, { requireObjectIdentity: true })

    const activeRange = harness.controller.derived.rows.visibleRange.value
    harness.rowModel.setViewportRange(activeRange)
    harness.rowModel.setRows(createRows(50_000))
    harness.controller.refresh(true)

    const afterRefreshRows = mapRowsByDisplayIndex(latestRowsPayload(harness))
    expectRetainedRowsStable(afterReverseRows, afterRefreshRows, { requireObjectIdentity: false })
    for (const row of afterRefreshRows.values()) {
      expect(row.rowId).toBe(row.displayIndex)
    }

    disposeHarness(harness)
  })

  it("keeps adaptive overscan direction and range coverage deterministic on scroll reversal", () => {
    const harness = createControllerHarness()
    harness.controller.refresh(true)

    harness.controller.scrollToRow(120)

    const downwardPayload = latestRowsPayload(harness)
    expect(harness.controller.core.overscanTrailing.value).toBeGreaterThan(
      harness.controller.core.overscanLeading.value,
    )
    expect(downwardPayload.visibleRows?.map(row => row.displayIndex)).toEqual(
      Array.from(
        { length: downwardPayload.visibleRows?.length ?? 0 },
        (_unused, index) => (downwardPayload.visibleRows?.[0]?.displayIndex ?? 0) + index,
      ),
    )

    harness.controller.scrollToRow(64)

    const upwardPayload = latestRowsPayload(harness)
    expect(harness.controller.core.overscanLeading.value).toBeGreaterThan(
      harness.controller.core.overscanTrailing.value,
    )
    expect(upwardPayload.visibleRows?.map(row => row.displayIndex)).toEqual(
      Array.from(
        { length: upwardPayload.visibleRows?.length ?? 0 },
        (_unused, index) => (upwardPayload.visibleRows?.[0]?.displayIndex ?? 0) + index,
      ),
    )

    const snapshot = snapshotControllerState(harness)
    expect(snapshot.visibleRangeStart).toBeGreaterThanOrEqual(0)
    expect(snapshot.visibleRangeEnd).toBeGreaterThan(snapshot.visibleRangeStart)

    disposeHarness(harness)
  })
})
