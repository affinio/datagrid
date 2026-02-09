import { describe, expect, it } from "vitest"
import { useDataGridCellRangeHelpers } from "../useDataGridCellRangeHelpers"

interface Row {
  idx: number
}

interface Coord {
  rowIndex: number
  columnIndex: number
}

interface Range {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

describe("useDataGridCellRangeHelpers contract", () => {
  const rows: Row[] = [{ idx: 0 }, { idx: 1 }, { idx: 2 }]
  const navigable = [1, 2, 4]

  function createApi(candidate: Coord | null = null) {
    return useDataGridCellRangeHelpers<Row, Coord, Range>({
      resolveRowsLength: () => rows.length,
      resolveFirstNavigableColumnIndex: () => navigable[0] ?? -1,
      resolveCandidateCurrentCell: () => candidate,
      resolveColumnIndex: key => (key === "blocked" ? 0 : key === "good" ? 2 : -1),
      resolveNearestNavigableColumnIndex: (columnIndex, direction = 1) => {
        if (navigable.includes(columnIndex)) {
          return columnIndex
        }
        if (direction > 0) {
          return navigable.find(index => index >= columnIndex) ?? -1
        }
        for (let index = navigable.length - 1; index >= 0; index -= 1) {
          const candidateIndex = navigable[index]
          if (typeof candidateIndex === "number" && candidateIndex <= columnIndex) {
            return candidateIndex
          }
        }
        return -1
      },
      clampRowIndex: rowIndex => Math.max(0, Math.min(rows.length - 1, Math.trunc(rowIndex))),
      resolveRowIndex: row => row.idx,
      isColumnSelectable: key => key !== "blocked",
    })
  }

  it("normalizes coordinates and ranges", () => {
    const api = createApi()
    expect(api.normalizeCellCoord({ rowIndex: 5, columnIndex: 3 })).toEqual({ rowIndex: 2, columnIndex: 4 })
    expect(api.normalizeSelectionRange({
      startRow: 2,
      endRow: 0,
      startColumn: 4,
      endColumn: 1,
    })).toEqual({
      startRow: 0,
      endRow: 2,
      startColumn: 1,
      endColumn: 4,
    })
  })

  it("resolves current and row-based coordinates", () => {
    const apiWithCandidate = createApi({ rowIndex: 1, columnIndex: 2 })
    expect(apiWithCandidate.resolveCurrentCellCoord()).toEqual({ rowIndex: 1, columnIndex: 2 })

    const apiWithoutCandidate = createApi(null)
    expect(apiWithoutCandidate.resolveCurrentCellCoord()).toEqual({ rowIndex: 0, columnIndex: 1 })

    expect(apiWithoutCandidate.resolveCellCoord({ idx: 1 }, "good")).toEqual({ rowIndex: 1, columnIndex: 2 })
    expect(apiWithoutCandidate.resolveCellCoord({ idx: 1 }, "blocked")).toBeNull()
  })

  it("builds extended range and checks containment", () => {
    const api = createApi()
    const extended = api.buildExtendedRange({
      startRow: 1,
      endRow: 1,
      startColumn: 2,
      endColumn: 2,
    }, {
      rowIndex: 2,
      columnIndex: 4,
    })
    expect(extended).toEqual({
      startRow: 1,
      endRow: 2,
      startColumn: 2,
      endColumn: 4,
    })
    expect(api.isCellWithinRange(2, 3, extended as Range)).toBe(true)
    expect(api.isCellWithinRange(0, 1, extended as Range)).toBe(false)
  })
})
