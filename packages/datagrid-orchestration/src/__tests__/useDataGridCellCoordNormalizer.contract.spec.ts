import { describe, expect, it } from "vitest"
import { useDataGridCellCoordNormalizer } from "../useDataGridCellCoordNormalizer"

describe("useDataGridCellCoordNormalizer contract", () => {
  it("clamps coordinate into current row/column bounds", () => {
    const normalizer = useDataGridCellCoordNormalizer({
      resolveRowCount: () => 5,
      resolveColumnCount: () => 4,
    })
    expect(normalizer.normalizeCellCoordBase({ rowIndex: -3, columnIndex: 12 })).toEqual({
      rowIndex: 0,
      columnIndex: 3,
    })
    expect(normalizer.normalizeCellCoordBase({ rowIndex: 2.9, columnIndex: 1.7 })).toEqual({
      rowIndex: 2,
      columnIndex: 1,
    })
  })

  it("returns null when there are no rows or columns", () => {
    const normalizer = useDataGridCellCoordNormalizer({
      resolveRowCount: () => 0,
      resolveColumnCount: () => 3,
    })
    expect(normalizer.normalizeCellCoordBase({ rowIndex: 0, columnIndex: 0 })).toBeNull()
  })
})

