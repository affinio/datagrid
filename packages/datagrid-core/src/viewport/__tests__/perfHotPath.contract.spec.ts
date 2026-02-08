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

function createColumns(count: number): DataGridColumn[] {
  const columns: DataGridColumn[] = []
  for (let index = 0; index < count; index += 1) {
    columns.push({
      key: `col_${index}`,
      label: `Column ${index}`,
      pin: "none",
      width: 96,
      minWidth: 72,
      maxWidth: 192,
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

describe("viewport perf hot-path contracts", () => {
  it("reuses visibleRows arrays through bounded snapshot pool under scroll churn", () => {
    const rowModel = createClientRowModel({ rows: createRows(10_000) })
    const columnModel = createDataGridColumnModel({ columns: createColumns(24) })
    const containerMetrics = createMeasuredElement({
      clientWidth: 1280,
      clientHeight: 760,
      scrollWidth: 1280,
      scrollHeight: 500_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 1280,
      clientHeight: 48,
      scrollWidth: 1280,
      scrollHeight: 48,
    })
    const visibleRowsReferences: VisibleRow[][] = []

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel,
      columnModel,
      imperativeCallbacks: {
        onRows(payload) {
          if (payload.visibleRows) {
            visibleRowsReferences.push(payload.visibleRows)
          }
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

    for (let step = 1; step <= 48; step += 1) {
      containerMetrics.element.scrollTop = step * 72
      containerMetrics.element.dispatchEvent(new Event("scroll"))
      controller.refresh(true)
    }

    const uniqueReferences = new Set(visibleRowsReferences)
    expect(visibleRowsReferences.length).toBeGreaterThan(12)
    expect(uniqueReferences.size).toBeLessThanOrEqual(3)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })

  it("does not emit redundant onRows callbacks for stable frame signature", () => {
    const rowModel = createClientRowModel({ rows: createRows(1_200) })
    const columnModel = createDataGridColumnModel({ columns: createColumns(12) })
    const containerMetrics = createMeasuredElement({
      clientWidth: 1024,
      clientHeight: 640,
      scrollWidth: 1024,
      scrollHeight: 120_000,
    })
    const headerMetrics = createMeasuredElement({
      clientWidth: 1024,
      clientHeight: 44,
      scrollWidth: 1024,
      scrollHeight: 44,
    })
    let onRowsCalls = 0

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel,
      columnModel,
      imperativeCallbacks: {
        onRows() {
          onRowsCalls += 1
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

    const baselineCalls = onRowsCalls
    controller.refresh(true)
    controller.refresh(true)
    controller.refresh(true)
    expect(onRowsCalls).toBe(baselineCalls)

    controller.dispose()
    rowModel.dispose()
    columnModel.dispose()
  })
})

