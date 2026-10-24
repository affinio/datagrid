import { afterEach, describe, expect, it } from "vitest"
import { mountColumnReorderingDemo } from "./main"

describe("column reordering example", () => {
  const mounted: Array<Awaited<ReturnType<typeof mountColumnReorderingDemo>>> = []
  afterEach(async () => {
    await Promise.all(mounted.splice(0).map(demo => demo.destroy()))
  })

  it("reorders columns through Core and keeps the selected logical column active", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    const demo = mountColumnReorderingDemo(root)
    mounted.push(demo)
    await demo.grid.ready

    demo.grid.api.selection.setSnapshot({
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 1,
        endCol: 1,
        startRowId: "i-1",
        endRowId: "i-1",
        anchor: { rowIndex: 0, colIndex: 1, rowId: "i-1" },
        focus: { rowIndex: 0, colIndex: 1, rowId: "i-1" },
      }],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 1, rowId: "i-1" },
    })

    const source = root.querySelector<HTMLElement>('[data-column-key="owner"]')!
    const target = root.querySelector<HTMLElement>('[data-column-key="region"]')!
    source.dispatchEvent(new Event("dragstart", { bubbles: true, cancelable: true }))
    target.dispatchEvent(new MouseEvent("dragover", { bubbles: true, cancelable: true, clientX: -1 }))
    target.dispatchEvent(new MouseEvent("drop", { bubbles: true, cancelable: true, clientX: -1 }))

    expect(demo.grid.api.columns.getSnapshot().visibleColumns.map(column => column.key))
      .toEqual(["initiative", "status", "owner", "region", "value"])
    expect(demo.grid.api.selection.getSnapshot()?.activeCell).toMatchObject({ rowIndex: 0, colIndex: 2, rowId: "i-1" })
  })

  it("allows cross-zone drops into pinned zones", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    const demo = mountColumnReorderingDemo(root)
    mounted.push(demo)
    await demo.grid.ready

    const source = root.querySelector<HTMLElement>('[data-column-key="status"]')!
    const target = root.querySelector<HTMLElement>('[data-column-key="initiative"]')!
    source.dispatchEvent(new Event("dragstart", { bubbles: true, cancelable: true }))
    target.dispatchEvent(new MouseEvent("drop", { bubbles: true, cancelable: true, clientX: 1e6 }))
    expect(demo.grid.api.columns.get("status")?.pin).toBe("left")
    expect(demo.grid.api.columns.getSnapshot().zoneOrder.pinnedLeft).toEqual(["initiative", "status"])
  })
})
