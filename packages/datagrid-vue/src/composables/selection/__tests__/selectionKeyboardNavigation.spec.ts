import { describe, expect, it } from "vitest"
import {
  isNavigableColumn,
  resolveEdgeColumnIndex,
  resolveNavigableColumnIndices,
  resolveTabColumnTarget,
} from "../selectionKeyboardNavigation"

function column(key: string, isSystem = false) {
  return {
    key,
    label: key.toUpperCase(),
    sortable: true,
    resizable: true,
    filterable: true,
    isSystem,
  }
}

describe("selectionKeyboardNavigation", () => {
  it("filters navigable columns by excluding system columns", () => {
    const columns = [column("rowIndex", true), column("service"), column("severity"), column("actions", true)]
    expect(resolveNavigableColumnIndices(columns)).toEqual([1, 2])
    expect(isNavigableColumn(columns[0] as any)).toBe(false)
    expect(isNavigableColumn(columns[1] as any)).toBe(true)
  })

  it("resolves row-edge column to first/last navigable index", () => {
    const columns = [column("rowIndex", true), column("service"), column("severity"), column("actions", true)]
    expect(resolveEdgeColumnIndex(columns, "start")).toBe(1)
    expect(resolveEdgeColumnIndex(columns, "end")).toBe(2)
  })

  it("falls back to data bounds when no navigable columns exist", () => {
    const columns = [column("rowIndex", true), column("actions", true)]
    expect(resolveEdgeColumnIndex(columns, "start")).toBe(0)
    expect(resolveEdgeColumnIndex(columns, "end")).toBe(1)
  })

  it("computes tab target with row wrap between navigable columns", () => {
    const columns = [column("rowIndex", true), column("service"), column("owner"), column("actions", true)]

    expect(resolveTabColumnTarget({
      columns,
      currentColumnIndex: 1,
      forward: true,
    })).toEqual({ nextColumnIndex: 2, rowDelta: 0 })

    expect(resolveTabColumnTarget({
      columns,
      currentColumnIndex: 2,
      forward: true,
    })).toEqual({ nextColumnIndex: 1, rowDelta: 1 })

    expect(resolveTabColumnTarget({
      columns,
      currentColumnIndex: 1,
      forward: false,
    })).toEqual({ nextColumnIndex: 2, rowDelta: -1 })
  })
})
