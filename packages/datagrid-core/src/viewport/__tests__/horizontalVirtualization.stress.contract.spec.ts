import { describe, expect, it } from "vitest"
import type { UiTableColumn, VisibleRow } from "../../types"
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

function createColumns(count: number): UiTableColumn[] {
  const columns: UiTableColumn[] = []
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

describe("horizontal virtualization stress contract", () => {
  it("keeps bounded windows for 100k rows and 500+ columns with pinned mix", () => {
    const columns = createColumns(520)
    const rows = createRows(100_000)
    const rowModel = createClientRowModel({ rows })
    const columnModel = createDataGridColumnModel({ columns })
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

    const controller = createTableViewportController({
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

  it("stays deterministic after teleport-like scroll and viewport resize", () => {
    const columns = createColumns(520)
    const rows = createRows(100_000)
    const rowModel = createClientRowModel({ rows })
    const columnModel = createDataGridColumnModel({ columns })
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

    const controller = createTableViewportController({
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
