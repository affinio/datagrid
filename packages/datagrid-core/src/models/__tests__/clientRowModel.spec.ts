import { describe, expect, it } from "vitest"
import { createClientRowModel, normalizeViewportRange } from "../index"
import type { VisibleRow } from "../../types"
import type { DataGridRowNodeInput } from "../rowModel"

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

  it("normalizes both legacy and canonical row-node inputs", () => {
    const rows: DataGridRowNodeInput<{ id: number }>[] = [
      {
        data: { id: 10 },
        row: { id: 10 },
        rowKey: "a",
        rowId: "a",
        sourceIndex: 0,
        originalIndex: 0,
        displayIndex: 0,
        state: { selected: true, group: false, pinned: "none", expanded: false },
      },
      {
        row: { id: 11 },
        rowId: "b",
        originalIndex: 1,
        displayIndex: 1,
      },
      {
        row: { id: 12 },
        rowId: "c",
        originalIndex: 2,
        displayIndex: 2,
        state: { pinned: "bottom" },
      },
    ]
    const model = createClientRowModel({ rows })

    const first = model.getRow(0)
    const second = model.getRow(1)
    const third = model.getRow(2)

    expect(first?.data.id).toBe(10)
    expect(first?.row.id).toBe(10)
    expect(first?.rowKey).toBe("a")
    expect(first?.state.selected).toBe(true)
    expect(second?.data.id).toBe(11)
    expect(second?.row.id).toBe(11)
    expect(second?.rowKey).toBe("b")
    expect(second?.state.pinned).toBe("none")
    expect(third?.data.id).toBe(12)
    expect(third?.state.pinned).toBe("bottom")

    model.dispose()
  })

  it("throws when row identity is missing and no resolver is configured", () => {
    expect(() =>
      createClientRowModel({
        rows: [{ row: { id: 999 }, originalIndex: 0, displayIndex: 0 } as DataGridRowNodeInput<{ id: number }>],
      }),
    ).toThrowError(/Missing row identity/)
  })

  it("resolves row identity through explicit resolver", () => {
    const model = createClientRowModel({
      rows: [{ row: { id: 42 }, originalIndex: 0, displayIndex: 0 }],
      resolveRowId: row => row.id,
    })

    const row = model.getRow(0)
    expect(row?.rowKey).toBe(42)
    expect(row?.rowId).toBe(42)
    model.dispose()
  })
})
