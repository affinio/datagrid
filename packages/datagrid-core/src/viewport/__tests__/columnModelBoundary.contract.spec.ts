import { describe, expect, it } from "vitest"
import {
  createClientRowModel,
  createDataGridColumnModel,
} from "../../models"
import { createTableViewportController } from "../tableViewportController"
import type { VisibleRow } from "../../types"

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
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "a", label: "A", width: 120 },
        { key: "b", label: "B", width: 140 },
        { key: "c", label: "C", width: 160 },
      ],
    })
    columnModel.setColumnOrder(["c", "a", "b"])
    columnModel.setColumnVisibility("b", false)
    columnModel.setColumnPin("a", "left")
    columnModel.setColumnWidth("c", 240)

    const { container, header, cleanup } = mountLayoutNodes()
    const controller = createTableViewportController({
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
    const firstModel = createDataGridColumnModel({
      columns: [
        { key: "x", label: "X", width: 120 },
        { key: "y", label: "Y", width: 120 },
      ],
    })
    const secondModel = createDataGridColumnModel({
      columns: [
        { key: "y", label: "Y", width: 180, pin: "right" },
        { key: "z", label: "Z", width: 220 },
      ],
    })

    const { container, header, cleanup } = mountLayoutNodes()
    const controller = createTableViewportController({
      resolvePinMode: column => (column.pin === "left" || column.pin === "right" ? column.pin : "none"),
      rowModel,
      columnModel: firstModel,
    })

    controller.setViewportMetrics({ containerWidth: 900, containerHeight: 420, headerHeight: 40 })
    controller.attach(container, header)
    controller.refresh(true)
    expect(controller.derived.columns.visibleColumns.value.map(column => column.key)).toContain("x")

    controller.setColumnModel(secondModel)
    controller.refresh(true)

    const keys = controller.derived.columns.visibleColumns.value.map(column => column.key)
    expect(keys).toContain("y")
    expect(keys).toContain("z")
    expect(keys).not.toContain("x")
    expect(controller.derived.columns.pinnedRightColumns.value.map(column => column.key)).toContain("y")

    controller.detach()
    controller.dispose()
    secondModel.dispose()
    firstModel.dispose()
    rowModel.dispose()
    cleanup()
  })
})
