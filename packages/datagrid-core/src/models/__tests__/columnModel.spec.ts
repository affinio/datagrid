import { describe, expect, it } from "vitest"
import { createDataGridColumnModel } from "../index"

describe("createDataGridColumnModel", () => {
  it("builds deterministic order and visibility snapshot", () => {
    const model = createDataGridColumnModel({
      columns: [
        { key: "a", label: "A" },
        { key: "b", label: "B", visible: false },
        { key: "c", label: "C" },
      ],
    })

    const snapshot = model.getSnapshot()
    expect(snapshot.order).toEqual(["a", "b", "c"])
    expect(snapshot.visibleColumns.map(column => column.key)).toEqual(["a", "c"])
    model.dispose()
  })

  it("applies order/visibility/pin/width mutations", () => {
    const model = createDataGridColumnModel({
      columns: [
        { key: "a", label: "A" },
        { key: "b", label: "B" },
        { key: "c", label: "C" },
      ],
    })

    model.setColumnOrder(["c", "a"])
    model.setColumnVisibility("b", false)
    model.setColumnPin("a", "left")
    model.setColumnWidth("c", 240)

    const snapshot = model.getSnapshot()
    expect(snapshot.order).toEqual(["c", "a", "b"])
    expect(snapshot.visibleColumns.map(column => column.key)).toEqual(["c", "a"])
    expect(model.getColumn("a")?.pin).toBe("left")
    expect(model.getColumn("c")?.width).toBe(240)
    model.dispose()
  })

  it("accepts headless column defs without UI-only fields", () => {
    const model = createDataGridColumnModel({
      columns: [
        { key: "id" },
        { key: "status", pin: "right", width: 120 },
      ],
    })

    const snapshot = model.getSnapshot()
    expect(snapshot.order).toEqual(["id", "status"])
    expect(snapshot.columns[0]?.column.label).toBeUndefined()
    expect(snapshot.columns[1]?.pin).toBe("right")
    expect(snapshot.columns[1]?.width).toBe(120)
    model.dispose()
  })

  it("keeps adapter metadata in a dedicated meta channel", () => {
    const model = createDataGridColumnModel({
      columns: [
        { key: "name", label: "Name", meta: { isSystem: true, align: "left", formatter: "text" } },
      ],
    })

    const column = model.getColumn("name")
    expect(column?.column.meta).toEqual({
      isSystem: true,
      align: "left",
      formatter: "text",
    })
    model.dispose()
  })
})
