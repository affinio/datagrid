import { describe, expect, it } from "vitest"
import { useDataGridSelectionComparators } from "../useDataGridSelectionComparators"

describe("useDataGridSelectionComparators contract", () => {
  it("compares cell coordinates only when both values exist", () => {
    const comparators = useDataGridSelectionComparators()
    expect(comparators.cellCoordsEqual(null, { rowIndex: 1, columnIndex: 1 })).toBe(false)
    expect(comparators.cellCoordsEqual({ rowIndex: 2, columnIndex: 3 }, null)).toBe(false)
    expect(comparators.cellCoordsEqual({ rowIndex: 2, columnIndex: 3 }, { rowIndex: 2, columnIndex: 3 })).toBe(true)
    expect(comparators.cellCoordsEqual({ rowIndex: 2, columnIndex: 3 }, { rowIndex: 2, columnIndex: 4 })).toBe(false)
  })

  it("compares ranges with strict bounds equality", () => {
    const comparators = useDataGridSelectionComparators()
    const range = { startRow: 1, endRow: 3, startColumn: 2, endColumn: 5 }
    expect(comparators.rangesEqual(range, { ...range })).toBe(true)
    expect(comparators.rangesEqual(range, { ...range, endColumn: 4 })).toBe(false)
    expect(comparators.rangesEqual(null, range)).toBe(false)
  })
})

