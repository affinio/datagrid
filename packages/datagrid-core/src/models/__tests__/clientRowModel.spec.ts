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
        kind: "leaf",
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
        rows: [{ row: { id: 999 }, originalIndex: 0, displayIndex: 0 } as unknown as DataGridRowNodeInput<{ id: number }>],
      }),
    ).toThrowError(/Missing row identity/)
  })

  it("resolves row identity through explicit resolver", () => {
    const model = createClientRowModel({
      rows: [{ row: { id: 42 }, originalIndex: 0, displayIndex: 0 } as unknown as DataGridRowNodeInput<{ id: number }>],
      resolveRowId: row => row.id,
    })

    const row = model.getRow(0)
    expect(row?.rowKey).toBe(42)
    expect(row?.rowId).toBe(42)
    model.dispose()
  })

  it("returns snapshot copies that do not mutate internal state", () => {
    const model = createClientRowModel({
      rows: buildRows(5),
    })

    model.setSortModel([{ key: "id", direction: "asc" }])
    model.setFilterModel({
      columnFilters: { id: ["1"] },
      advancedFilters: {},
    })
    model.setGroupBy({ fields: ["id"], expandedByDefault: true })

    const snapshot = model.getSnapshot()
    const snapshotSort = [...snapshot.sortModel]
    snapshotSort[0] = { key: "id", direction: "desc" }
    ;(snapshot.filterModel?.columnFilters.id ?? []).push("2")
    ;(snapshot.groupBy?.fields ?? []).push("owner")

    const nextSnapshot = model.getSnapshot()
    expect(nextSnapshot.sortModel).toEqual([{ key: "id", direction: "asc" }])
    expect(nextSnapshot.filterModel).toEqual({
      columnFilters: { id: ["1"] },
      advancedFilters: {},
    })
    expect(nextSnapshot.groupBy).toEqual({ fields: ["id"], expandedByDefault: true })
    expect(nextSnapshot.groupExpansion).toEqual({
      expandedByDefault: true,
      toggledGroupKeys: [],
    })

    model.dispose()
  })

  it("normalizes and toggles group by state through row model API", () => {
    const model = createClientRowModel({
      rows: buildRows(3),
    })

    model.setGroupBy({ fields: ["", " owner ", "owner"], expandedByDefault: false })
    expect(model.getSnapshot().groupBy).toEqual({
      fields: ["owner"],
      expandedByDefault: false,
    })
    model.toggleGroup("owner=alice")
    expect(model.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: ["owner=alice"],
    })

    model.setGroupBy({ fields: [] })
    expect(model.getSnapshot().groupBy).toBeNull()
    expect(model.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [],
    })

    model.dispose()
  })

  it("applies deterministic projection order: filter -> sort -> group -> flatten", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 3, team: "A", score: 30 }, rowId: "r3", originalIndex: 0, displayIndex: 0 },
        { row: { id: 1, team: "B", score: 10 }, rowId: "r1", originalIndex: 1, displayIndex: 1 },
        { row: { id: 2, team: "A", score: 20 }, rowId: "r2", originalIndex: 2, displayIndex: 2 },
      ],
    })

    model.setFilterModel({
      columnFilters: { team: ["A"] },
      advancedFilters: {},
    })
    model.setSortModel([{ key: "id", direction: "desc" }])
    model.setGroupBy({ fields: ["team"], expandedByDefault: true })

    const first = model.getRowsInRange({ start: 0, end: 4 })
    expect(first).toHaveLength(3)
    expect(first[0]?.kind).toBe("group")
    expect(first[0]?.groupMeta?.groupField).toBe("team")
    expect(first[0]?.groupMeta?.groupValue).toBe("A")
    expect(first[1]?.kind).toBe("leaf")
    expect((first[1]?.row as { id?: number })?.id).toBe(3)
    expect((first[2]?.row as { id?: number })?.id).toBe(2)
    expect(first[0]?.displayIndex).toBe(0)
    expect(first[1]?.displayIndex).toBe(1)
    expect(first[2]?.displayIndex).toBe(2)

    const groupKey = String(first[0]?.groupMeta?.groupKey ?? "")
    model.toggleGroup(groupKey)
    const collapsed = model.getRowsInRange({ start: 0, end: 4 })
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.kind).toBe("group")
    expect(collapsed[0]?.state.expanded).toBe(false)

    model.dispose()
  })

  it("applies advanced expression filters before sort/group projection", () => {
    const model = createClientRowModel({
      rows: [
        { row: { id: 1, owner: "noc", latencyMs: 120, status: "active" }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, owner: "ops", latencyMs: 75, status: "warning" }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: { id: 3, owner: "noc", latencyMs: 50, status: "inactive" }, rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
    })

    model.setFilterModel({
      columnFilters: {},
      advancedFilters: {},
      advancedExpression: {
        kind: "group",
        operator: "and",
        children: [
          {
            kind: "condition",
            key: "status",
            operator: "in",
            value: ["active", "warning"],
            type: "text",
          },
          {
            kind: "condition",
            key: "latencyMs",
            operator: "gt",
            value: 90,
            type: "number",
          },
        ],
      },
    })

    const rows = model.getRowsInRange({ start: 0, end: 10 })
    expect(rows).toHaveLength(1)
    expect((rows[0]?.row as { id?: number })?.id).toBe(1)
    expect((model.getSnapshot().filterModel?.advancedExpression as { kind?: string })?.kind).toBe("group")

    model.dispose()
  })

  it("materializes sort keys once per row during each sort projection pass", () => {
    let scoreReads = 0
    const makeRow = (id: number, score: number): { id: number; score: number } => {
      const row = { id } as { id: number; score: number }
      Object.defineProperty(row, "score", {
        enumerable: true,
        configurable: false,
        get() {
          scoreReads += 1
          return score
        },
      })
      return row
    }

    const model = createClientRowModel({
      rows: [
        { row: makeRow(1, 30), rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: makeRow(2, 10), rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: makeRow(3, 20), rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
    })

    model.setSortModel([{ key: "score", direction: "asc" }])
    const sorted = model.getRowsInRange({ start: 0, end: 3 })

    expect(sorted.map(row => (row.row as { id: number }).id)).toEqual([2, 3, 1])
    expect(scoreReads).toBe(3)

    model.dispose()
  })
})
