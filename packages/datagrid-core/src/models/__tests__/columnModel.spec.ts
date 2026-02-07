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
})
