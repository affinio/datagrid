import { describe, expect, it } from "vitest"
import { useDataGridCopyRangeHelpers } from "../useDataGridCopyRangeHelpers"

describe("useDataGridCopyRangeHelpers contract", () => {
  it("identifies multi-cell ranges and returns selected range first", () => {
    const helpers = useDataGridCopyRangeHelpers({
      resolveSelectionRange: () => ({ startRow: 1, endRow: 2, startColumn: 3, endColumn: 4 }),
      resolveCurrentCellCoord: () => ({ rowIndex: 9, columnIndex: 9 }),
    })

    expect(
      helpers.isMultiCellSelection({ startRow: 1, endRow: 2, startColumn: 3, endColumn: 4 }),
    ).toBe(true)
    expect(helpers.resolveCopyRange()).toEqual({
      startRow: 1,
      endRow: 2,
      startColumn: 3,
      endColumn: 4,
    })
  })

  it("falls back to current cell when there is no active range", () => {
    const helpers = useDataGridCopyRangeHelpers({
      resolveSelectionRange: () => null,
      resolveCurrentCellCoord: () => ({ rowIndex: 5, columnIndex: 7 }),
    })

    expect(helpers.resolveCopyRange()).toEqual({
      startRow: 5,
      endRow: 5,
      startColumn: 7,
      endColumn: 7,
    })
    expect(helpers.isMultiCellSelection(null)).toBe(false)
  })
})
