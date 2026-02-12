import { describe, expect, it } from "vitest"
import { createSelectionSnapshot } from "../snapshot"
import {
  applyGroupSelectionPolicy,
  clampGridSelectionPoint,
  createGridSelectionContextFromFlattenedRows,
  createGridSelectionRange,
} from "../selectionState"

describe("selection grouped projection contract", () => {
  it("keeps group row as regular single row in flattened context", () => {
    const context = createGridSelectionContextFromFlattenedRows({
      rows: [
        { rowId: "group:region=eu" },
        { rowId: "leaf:incident-1" },
        { rowId: "leaf:incident-2" },
      ],
      colCount: 6,
    })

    const range = createGridSelectionRange(
      { rowIndex: 0, colIndex: 2 },
      { rowIndex: 0, colIndex: 2 },
      context,
    )

    expect(range.startRow).toBe(0)
    expect(range.endRow).toBe(0)
    expect(range.startRowId).toBe("group:region=eu")
    expect(range.endRowId).toBe("group:region=eu")
  })

  it("resolves shift-range bounds strictly by flattened row order", () => {
    const context = createGridSelectionContextFromFlattenedRows({
      rows: [
        { rowId: "group:region=eu" },
        { rowId: "leaf:incident-1" },
        { rowId: "leaf:incident-2" },
        { rowId: "group:region=us" },
      ],
      colCount: 4,
    })

    const range = createGridSelectionRange(
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 2, colIndex: 3 },
      context,
    )

    const snapshot = createSelectionSnapshot({
      ranges: [range],
      activeRangeIndex: 0,
      selectedPoint: { rowIndex: 2, colIndex: 3, rowId: null },
      getRowIdByIndex: context.getRowIdByIndex,
    })

    expect(snapshot.ranges).toHaveLength(1)
    expect(snapshot.ranges[0]).toMatchObject({
      startRow: 0,
      endRow: 2,
      startRowId: "group:region=eu",
      endRowId: "leaf:incident-2",
    })
    expect(snapshot.activeCell).toEqual({
      rowIndex: 2,
      colIndex: 3,
      rowId: "leaf:incident-2",
    })
  })

  it("clamps against collapsed flattened rows so hidden children are not selectable", () => {
    const context = createGridSelectionContextFromFlattenedRows({
      rows: [
        { rowId: "group:region=eu" },
        { rowId: "group:region=us" },
      ],
      colCount: 3,
    })

    const point = clampGridSelectionPoint({ rowIndex: 10, colIndex: 1 }, context)

    expect(point).toEqual({
      rowIndex: 1,
      colIndex: 1,
      rowId: "group:region=us",
    })
  })

  it("expands single group-row selection to descendant subtree when policy is enabled", () => {
    const rows = [
      { rowId: "group:region=eu", isGroup: true, level: 0 },
      { rowId: "leaf:incident-1", isGroup: false, level: 1 },
      { rowId: "group:service=api", isGroup: true, level: 1 },
      { rowId: "leaf:incident-2", isGroup: false, level: 2 },
      { rowId: "group:region=us", isGroup: true, level: 0 },
    ] as const
    const context = createGridSelectionContextFromFlattenedRows({ rows, colCount: 6 })
    const single = createGridSelectionRange(
      { rowIndex: 0, colIndex: 2 },
      { rowIndex: 0, colIndex: 2 },
      context,
    )

    const expanded = applyGroupSelectionPolicy(single, {
      rows,
      groupSelectsChildren: true,
    })

    expect(expanded.startRow).toBe(0)
    expect(expanded.endRow).toBe(3)
    expect(expanded.startRowId).toBe("group:region=eu")
    expect(expanded.endRowId).toBe("leaf:incident-2")
    expect(expanded.focus.rowIndex).toBe(3)
  })

  it("keeps range unchanged when groupSelectsChildren is disabled", () => {
    const rows = [
      { rowId: "group:region=eu", isGroup: true, level: 0 },
      { rowId: "leaf:incident-1", isGroup: false, level: 1 },
    ] as const
    const context = createGridSelectionContextFromFlattenedRows({ rows, colCount: 4 })
    const single = createGridSelectionRange(
      { rowIndex: 0, colIndex: 1 },
      { rowIndex: 0, colIndex: 1 },
      context,
    )

    const unchanged = applyGroupSelectionPolicy(single, {
      rows,
      groupSelectsChildren: false,
    })

    expect(unchanged).toEqual(single)
  })
})
