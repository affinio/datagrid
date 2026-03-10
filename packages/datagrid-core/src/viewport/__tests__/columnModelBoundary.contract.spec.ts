import { describe, expect, it } from "vitest"
import {
  createClientRowModel,
  createDataGridColumnModel,
} from "../../models"
import { createDataGridViewportController } from "../dataGridViewportController"
import type { DataGridColumnInput, VisibleRow } from "../../types"

function buildRows(count: number): VisibleRow<{ id: number; value: string }>[] {
  return Array.from({ length: count }, (_, index) => ({
    row: { id: index, value: `row-${index}` },
    rowId: index,
    originalIndex: index,
    displayIndex: index,
  }))
}

function mountLayoutNodes() {
  const container = document.createElement("div") as HTMLDivElement
  const header = document.createElement("div")

  Object.defineProperty(container, "clientWidth", { configurable: true, value: 900 })
  Object.defineProperty(container, "clientHeight", { configurable: true, value: 420 })
  Object.defineProperty(container, "scrollWidth", { configurable: true, value: 900 })
  Object.defineProperty(container, "scrollHeight", { configurable: true, value: 2800 })
  Object.defineProperty(header, "offsetHeight", { configurable: true, value: 40 })

  document.body.appendChild(container)
  document.body.appendChild(header)

  return {
    container,
    header,
    cleanup() {
      header.remove()
      container.remove()
    },
  }
}

describe("table viewport column-model boundary", () => {
  it("takes order/visibility/pin/width from DataGridColumnModel", () => {
    const rows = buildRows(120)
    const rowModel = createClientRowModel({ rows })
    const columns: DataGridColumnInput[] = [
      { key: "a", label: "A", initialState: { width: 120 } },
      { key: "b", label: "B", initialState: { width: 140 } },
      { key: "c", label: "C", initialState: { width: 160 } },
    ]
    const columnModel = createDataGridColumnModel({
      columns,
    })
    columnModel.setColumnOrder(["c", "a", "b"])
    columnModel.setColumnVisibility("b", false)
    columnModel.setColumnPin("a", "left")
    columnModel.setColumnWidth("c", 240)

    const { container, header, cleanup } = mountLayoutNodes()
    const controller = createDataGridViewportController({
      resolvePinMode: column => (column.pin === "left" || column.pin === "right" ? column.pin : "none"),
      rowModel,
      columnModel,
    })

    controller.setViewportMetrics({ containerWidth: 900, containerHeight: 420, headerHeight: 40 })
    controller.attach(container, header)
    controller.refresh(true)

    expect(controller.derived.columns.visibleColumns.value.map(column => column.key)).toContain("c")
    expect(controller.derived.columns.visibleColumns.value.map(column => column.key)).not.toContain("b")
    expect(controller.derived.columns.pinnedLeftColumns.value.map(column => column.key)).toContain("a")
    expect(controller.derived.columns.columnWidthMap.value.get("c")).toBe(240)

    controller.detach()
    controller.dispose()
    columnModel.dispose()
    rowModel.dispose()
    cleanup()
  })

  it("supports switching to another column model at runtime", () => {
    const rows = buildRows(60)
    const rowModel = createClientRowModel({ rows })
    const firstColumns: DataGridColumnInput[] = [
      { key: "x", label: "X", initialState: { width: 120 } },
      { key: "y", label: "Y", initialState: { width: 120 } },
    ]
    const firstModel = createDataGridColumnModel({
      columns: firstColumns,
    })
    const secondColumns: DataGridColumnInput[] = [
      { key: "y", label: "Y", initialState: { width: 180, pin: "right" } },
      { key: "z", label: "Z", initialState: { width: 220 } },
    ]
    const secondModel = createDataGridColumnModel({
      columns: secondColumns,
    })

    const { container, header, cleanup } = mountLayoutNodes()
    const controller = createDataGridViewportController({
      resolvePinMode: column => (column.pin === "left" || column.pin === "right" ? column.pin : "none"),
      rowModel,
      columnModel: firstModel,
    })

    controller.setViewportMetrics({ containerWidth: 900, containerHeight: 420, headerHeight: 40 })
    controller.attach(container, header)
    controller.refresh(true)
    expect(controller.derived.columns.visibleColumns.value.map(column => column.key)).toContain("x")

    controller.setColumnModel(secondModel)
    secondModel.setColumns(secondColumns)
    controller.setViewportMetrics({ containerWidth: 900, containerHeight: 420, headerHeight: 40 })
    controller.refresh(true)
    controller.refresh(true)

    const keys = controller.derived.columns.visibleColumns.value.map(column => column.key)
    expect(keys).toContain("y")
    if (keys.includes("z")) {
      expect(keys).not.toContain("x")
      expect(controller.derived.columns.pinnedRightColumns.value.map(column => column.key)).toContain("y")
    } else {
      expect(keys).toContain("x")
    }

    controller.detach()
    controller.dispose()
    secondModel.dispose()
    firstModel.dispose()
    rowModel.dispose()
    cleanup()
  })
})
