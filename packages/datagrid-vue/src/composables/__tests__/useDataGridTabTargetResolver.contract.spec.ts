import { describe, expect, it } from "vitest"
import { useDataGridTabTargetResolver } from "../useDataGridTabTargetResolver"

interface TestCoord {
  rowIndex: number
  columnIndex: number
}

describe("useDataGridTabTargetResolver contract", () => {
  it("returns null when no navigable columns are available", () => {
    const resolver = useDataGridTabTargetResolver<TestCoord>({
      resolveNavigableColumnIndexes: () => [],
      normalizeCellCoord: coord => coord,
    })

    expect(resolver.resolveTabTarget({ rowIndex: 2, columnIndex: 3 }, false)).toBeNull()
  })

  it("advances to next column and wraps row forward", () => {
    const resolver = useDataGridTabTargetResolver<TestCoord>({
      resolveNavigableColumnIndexes: () => [1, 4, 7],
      normalizeCellCoord: coord => coord,
    })

    expect(resolver.resolveTabTarget({ rowIndex: 2, columnIndex: 1 }, false)).toEqual({
      rowIndex: 2,
      columnIndex: 4,
    })
    expect(resolver.resolveTabTarget({ rowIndex: 2, columnIndex: 7 }, false)).toEqual({
      rowIndex: 3,
      columnIndex: 1,
    })
  })

  it("moves backwards and wraps row when needed", () => {
    const resolver = useDataGridTabTargetResolver<TestCoord>({
      resolveNavigableColumnIndexes: () => [1, 4, 7],
      normalizeCellCoord: coord => coord,
    })

    expect(resolver.resolveTabTarget({ rowIndex: 6, columnIndex: 4 }, true)).toEqual({
      rowIndex: 6,
      columnIndex: 1,
    })
    expect(resolver.resolveTabTarget({ rowIndex: 6, columnIndex: 1 }, true)).toEqual({
      rowIndex: 5,
      columnIndex: 7,
    })
  })

  it("falls back to nearest greater column when current column is not navigable", () => {
    const resolver = useDataGridTabTargetResolver<TestCoord>({
      resolveNavigableColumnIndexes: () => [1, 4, 7],
      normalizeCellCoord: coord => coord,
    })

    expect(resolver.resolveTabTarget({ rowIndex: 0, columnIndex: 3 }, false)).toEqual({
      rowIndex: 0,
      columnIndex: 7,
    })
    expect(resolver.resolveTabTarget({ rowIndex: 0, columnIndex: 9 }, false)).toEqual({
      rowIndex: 1,
      columnIndex: 1,
    })
  })
})
