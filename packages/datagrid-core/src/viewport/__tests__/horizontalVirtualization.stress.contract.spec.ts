import { describe, expect, it } from "vitest"
import type { DataGridColumn, DataGridColumnInput, VisibleRow } from "../../types"
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

function createColumns(count: number): DataGridColumn[] {
  const columns: DataGridColumn[] = []
  for (let index = 0; index < count; index += 1) {
    const pin = index < 3 ? "left" : index >= count - 3 ? "right" : "none"
    columns.push({
      key: `col_${index}`,
      label: `Column ${index}`,
      pin,
      width: 96 + (index % 7) * 12,
      minWidth: 72,
      maxWidth: 240,
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

function createWideControllerHarness(columnCount: number) {
  const columns = createColumns(columnCount)
  const rows = createRows(100_000)
  const rowModel = createClientRowModel({ rows })
  const columnModel = createDataGridColumnModel({ columns: toColumnModelInputs(columns) })
  const totalScrollableWidth = columns.reduce((sum, column) => sum + (column.width ?? 0), 0)
  const containerMetrics = createMeasuredElement({
    clientWidth: 1440,
    clientHeight: 820,
    scrollWidth: Math.max(1440, totalScrollableWidth),
    scrollHeight: 4_000_000,
  })
  const headerMetrics = createMeasuredElement({
    clientWidth: 1440,
    clientHeight: 52,
    scrollWidth: 1440,
    scrollHeight: 52,
  })
  const controller = createDataGridViewportController({
    resolvePinMode: column => (column.isSystem ? "left" : column.pin === "left" || column.pin === "right" ? column.pin : "none"),
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

  return {
    columns,
    rowModel,
    columnModel,
    containerMetrics,
    headerMetrics,
    controller,
    dispose: () => {
      controller.dispose()
      rowModel.dispose()
      columnModel.dispose()
    },
  }
}

function assertBoundedScrollableWindow(
  controller: ReturnType<typeof createDataGridViewportController<VisibleRow, unknown>>,
  expectedScrollableColumns: number,
): void {
  const range = controller.derived.columns.scrollableRange.value
  const visibleEntries = controller.derived.columns.visibleScrollableEntries.value
  const visibleIndexes = visibleEntries.map(entry => entry.index)

  expect(controller.derived.columns.columnVirtualState.value.totalCount).toBe(expectedScrollableColumns)
  expect(range.start).toBeGreaterThanOrEqual(0)
  expect(range.end).toBeLessThanOrEqual(expectedScrollableColumns)
  expect(range.end).toBeGreaterThanOrEqual(range.start)
  expect(visibleEntries.length).toBeGreaterThan(0)
  expect(visibleEntries.length).toBeLessThan(240)
  expect(new Set(visibleIndexes).size).toBe(visibleIndexes.length)
}

describe("horizontal virtualization stress contract", () => {
  it("keeps bounded windows for 100k rows and 500+ columns with pinned mix", () => {
    const columns = createColumns(520)
    const rows = createRows(100_000)
    const rowModel = createClientRowModel({ rows })
    const columnModel = createDataGridColumnModel({ columns: toColumnModelInputs(columns) })
    const containerMetrics = createMeasuredElement({
      clientWidth: 1440,
      clientHeight: 820,
      scrollWidth: 320_000,
      scrollHeight: 4_000_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 1440,
      clientHeight: 52,
      scrollWidth: 1440,
      scrollHeight: 52,
    })

    const controller = createDataGridViewportController({
      resolvePinMode: column => (column.isSystem ? "left" : column.pin === "left" || column.pin === "right" ? column.pin : "none"),
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

    expect(controller.core.totalRowCount.value).toBe(100_000)
    expect(controller.core.poolSize.value).toBeGreaterThan(0)
    expect(controller.core.poolSize.value).toBeLessThan(300)
    expect(controller.derived.columns.pinnedLeftEntries.value.length).toBe(3)
    expect(controller.derived.columns.pinnedRightEntries.value.length).toBe(3)
    expect(controller.derived.columns.columnVirtualState.value.totalCount).toBe(514)
    expect(controller.derived.columns.visibleScrollableEntries.value.length).toBeGreaterThan(0)
    expect(controller.derived.columns.visibleScrollableEntries.value.length).toBeLessThan(220)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it.each([1_000, 10_000])("keeps bounded windows for 100k rows and %i columns", columnCount => {
    const harness = createWideControllerHarness(columnCount)
    const expectedScrollableColumns = columnCount - 6

    assertBoundedScrollableWindow(harness.controller, expectedScrollableColumns)
    expect(harness.controller.derived.columns.pinnedLeftEntries.value.length).toBe(3)
    expect(harness.controller.derived.columns.pinnedRightEntries.value.length).toBe(3)

    const maxLeft = Math.max(0, harness.containerMetrics.state.scrollWidth - harness.containerMetrics.state.clientWidth)
    for (const ratio of [0.2, 0.5, 0.9, 1]) {
      harness.containerMetrics.element.scrollLeft = Math.round(maxLeft * ratio)
      harness.containerMetrics.element.dispatchEvent(new Event("scroll"))
      harness.controller.refresh(true)
      assertBoundedScrollableWindow(harness.controller, expectedScrollableColumns)
    }

    expect(harness.controller.derived.columns.scrollableRange.value.end).toBeGreaterThan(expectedScrollableColumns - 80)

    harness.dispose()
  })

  it("keeps a bounded 1k-column window after width, order, visibility, and pin changes while scrolled", () => {
    const harness = createWideControllerHarness(1_000)

    harness.containerMetrics.element.scrollLeft = Math.round(harness.containerMetrics.state.scrollWidth * 0.55)
    harness.containerMetrics.element.dispatchEvent(new Event("scroll"))
    harness.controller.refresh(true)

    harness.columnModel.setColumnWidth("col_500", 240)
    harness.columnModel.setColumnVisibility("col_600", false)
    harness.columnModel.setColumnPin("col_700", "right")
    harness.columnModel.setColumnOrder([
      "col_800",
      ...harness.columns.map(column => column.key).filter(key => key !== "col_800"),
    ])
    harness.controller.refresh(true)

    assertBoundedScrollableWindow(harness.controller, 1_000 - 8)
    expect(harness.controller.derived.columns.columnWidthMap.value.get("col_500")).toBe(240)
    expect(harness.controller.derived.columns.visibleColumns.value.map(column => column.key)).not.toContain("col_600")
    expect(harness.controller.derived.columns.pinnedRightColumns.value.map(column => column.key)).toContain("col_700")
    expect(harness.controller.derived.columns.visibleColumns.value[0]?.key).toBe("col_0")

    harness.dispose()
  })

  it("stays deterministic after teleport-like scroll and viewport resize", () => {
    const columns = createColumns(520)
    const rows = createRows(100_000)
    const rowModel = createClientRowModel({ rows })
    const columnModel = createDataGridColumnModel({ columns: toColumnModelInputs(columns) })
    const containerMetrics = createMeasuredElement({
      clientWidth: 1440,
      clientHeight: 820,
      scrollWidth: 320_000,
      scrollHeight: 4_000_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 1440,
      clientHeight: 52,
      scrollWidth: 1440,
      scrollHeight: 52,
    })

    const controller = createDataGridViewportController({
      resolvePinMode: column => (column.isSystem ? "left" : column.pin === "left" || column.pin === "right" ? column.pin : "none"),
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

    containerMetrics.element.scrollLeft = 250_000
    containerMetrics.element.scrollTop = 2_500_000
    containerMetrics.element.dispatchEvent(new Event("scroll"))
    controller.refresh(true)

    const afterTeleport = {
      scrollLeft: controller.input.scrollLeft.value,
      rangeStart: controller.derived.columns.scrollableRange.value.start,
      rangeEnd: controller.derived.columns.scrollableRange.value.end,
    }

    controller.refresh(true)
    const repeatA = {
      scrollLeft: controller.input.scrollLeft.value,
      rangeStart: controller.derived.columns.scrollableRange.value.start,
      rangeEnd: controller.derived.columns.scrollableRange.value.end,
    }
    controller.refresh(true)
    const repeatB = {
      scrollLeft: controller.input.scrollLeft.value,
      rangeStart: controller.derived.columns.scrollableRange.value.start,
      rangeEnd: controller.derived.columns.scrollableRange.value.end,
    }

    expect(repeatA).toEqual(afterTeleport)
    expect(repeatB).toEqual(afterTeleport)

    containerMetrics.state.clientWidth = 960
    controller.setViewportMetrics({
      containerWidth: containerMetrics.state.clientWidth,
      containerHeight: containerMetrics.state.clientHeight,
      headerHeight: headerMetrics.state.clientHeight,
    })
    controller.refresh(true)

    const afterResize = {
      scrollLeft: controller.input.scrollLeft.value,
      rangeStart: controller.derived.columns.scrollableRange.value.start,
      rangeEnd: controller.derived.columns.scrollableRange.value.end,
    }

    controller.refresh(true)
    const resizeRepeatA = {
      scrollLeft: controller.input.scrollLeft.value,
      rangeStart: controller.derived.columns.scrollableRange.value.start,
      rangeEnd: controller.derived.columns.scrollableRange.value.end,
    }
    controller.refresh(true)
    const resizeRepeatB = {
      scrollLeft: controller.input.scrollLeft.value,
      rangeStart: controller.derived.columns.scrollableRange.value.start,
      rangeEnd: controller.derived.columns.scrollableRange.value.end,
    }

    expect(resizeRepeatA).toEqual(afterResize)
    expect(resizeRepeatB).toEqual(afterResize)
    expect(afterResize.rangeStart).toBeGreaterThanOrEqual(0)
    expect(afterResize.rangeEnd).toBeLessThanOrEqual(514)
    expect(afterResize.rangeEnd).toBeGreaterThan(afterResize.rangeStart)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })
})
