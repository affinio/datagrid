import { describe, expect, it } from "vitest"
import { createSelectionSnapshot } from "../snapshot"
import {
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
})
