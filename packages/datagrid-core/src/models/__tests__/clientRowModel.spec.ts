import { describe, expect, it } from "vitest"
import { createClientRowModel, normalizeViewportRange } from "../index"
import type { VisibleRow } from "../../types"

function buildRows(count: number): VisibleRow<{ id: number }>[] {
  return Array.from({ length: count }, (_, index) => ({
    row: { id: index },
    rowId: index,
    originalIndex: index,
    displayIndex: index,
  }))
}

describe("createClientRowModel", () => {
  it("normalizes viewport range to row count", () => {
    expect(normalizeViewportRange({ start: 10, end: 100 }, 3)).toEqual({ start: 2, end: 2 })
    expect(normalizeViewportRange({ start: -10, end: -1 }, 0)).toEqual({ start: 0, end: 0 })
  })

  it("updates viewport range and notifies subscribers", () => {
    const model = createClientRowModel({ rows: buildRows(20) })
    let notifications = 0
    const unsubscribe = model.subscribe(snapshot => {
      notifications += 1
      expect(snapshot.rowCount).toBe(20)
    })

    model.setViewportRange({ start: 2, end: 8 })
    expect(model.getSnapshot().viewportRange).toEqual({ start: 2, end: 8 })
    expect(notifications).toBe(1)

    model.setViewportRange({ start: 2, end: 8 })
    expect(notifications).toBe(1)

    unsubscribe()
    model.dispose()
  })

  it("returns rows in canonical range", () => {
    const rows = buildRows(10)
    const model = createClientRowModel({ rows })
    const node = model.getRow(3)
    expect(node?.row.id).toBe(3)
    expect(node?.rowKey).toBe(3)
    expect(node?.sourceIndex).toBe(3)
    expect(node?.displayIndex).toBe(3)
    expect(node?.state).toEqual({
      selected: false,
      group: false,
      pinned: "none",
      expanded: false,
    })
    expect(model.getRowsInRange({ start: 2, end: 5 }).map(row => row.row.id)).toEqual([2, 3, 4, 5])
    model.dispose()
  })
})
