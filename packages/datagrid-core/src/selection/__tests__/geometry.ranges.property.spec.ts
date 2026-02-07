import { describe, expect, it } from "vitest"
import {
  areaContainsCell,
  areaEdges,
  findAreaIndexContaining,
  findRangeIndexContaining,
  rangeContainsCell,
} from "../geometry"
import { createGridSelectionRange, type SelectionArea } from "../selectionState"

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}

function normalizeArea(area: SelectionArea): SelectionArea {
  return {
    startRow: Math.min(area.startRow, area.endRow),
    endRow: Math.max(area.startRow, area.endRow),
    startCol: Math.min(area.startCol, area.endCol),
    endCol: Math.max(area.startCol, area.endCol),
  }
}

function manualContains(area: SelectionArea, row: number, col: number): boolean {
  const normalized = normalizeArea(area)
  return (
    row >= normalized.startRow &&
    row <= normalized.endRow &&
    col >= normalized.startCol &&
    col <= normalized.endCol
  )
}

describe("selection geometry range invariants", () => {
  it("matches containment and index lookup against manual geometry checks", () => {
    for (let sample = 0; sample < 300; sample += 1) {
      const areaCount = randomInt(1, 6)
      const areas: SelectionArea[] = []

      for (let index = 0; index < areaCount; index += 1) {
        areas.push({
          startRow: randomInt(-4, 20),
          endRow: randomInt(-4, 20),
          startCol: randomInt(-3, 12),
          endCol: randomInt(-3, 12),
        })
      }

      const row = randomInt(-5, 22)
      const col = randomInt(-5, 14)

      const expectedIndex = areas.findIndex(area => manualContains(area, row, col))
      expect(findAreaIndexContaining(areas, row, col)).toBe(expectedIndex)

      for (const area of areas) {
        const contains = areaContainsCell(area, row, col)
        expect(contains).toBe(manualContains(area, row, col))

        const edges = areaEdges(area, row, col)
        if (!contains) {
          expect(edges).toBeNull()
        } else {
          const normalized = normalizeArea(area)
          expect(edges).not.toBeNull()
          expect(edges?.top).toBe(row === normalized.startRow)
          expect(edges?.bottom).toBe(row === normalized.endRow)
          expect(edges?.left).toBe(col === normalized.startCol)
          expect(edges?.right).toBe(col === normalized.endCol)
        }
      }
    }
  })

  it("keeps normalized range semantics under random anchor/focus permutations", () => {
    for (let sample = 0; sample < 300; sample += 1) {
      const rowCount = randomInt(1, 80)
      const colCount = randomInt(1, 40)
      const context = {
        grid: { rowCount, colCount },
        getRowIdByIndex: (rowIndex: number) => rowIndex,
      }

      const anchor = {
        rowIndex: randomInt(-20, rowCount + 20),
        colIndex: randomInt(-20, colCount + 20),
      }
      const focus = {
        rowIndex: randomInt(-20, rowCount + 20),
        colIndex: randomInt(-20, colCount + 20),
      }

      const range = createGridSelectionRange(anchor, focus, context)
      expect(range.startRow).toBeLessThanOrEqual(range.endRow)
      expect(range.startCol).toBeLessThanOrEqual(range.endCol)
      expect(range.startRow).toBeGreaterThanOrEqual(0)
      expect(range.endRow).toBeLessThan(rowCount)
      expect(range.startCol).toBeGreaterThanOrEqual(0)
      expect(range.endCol).toBeLessThan(colCount)

      const probeRow = randomInt(0, rowCount - 1)
      const probeCol = randomInt(0, colCount - 1)
      const manual = manualContains(range, probeRow, probeCol)
      expect(rangeContainsCell(range, probeRow, probeCol)).toBe(manual)
      const index = findRangeIndexContaining([range], probeRow, probeCol)
      expect(index).toBe(manual ? 0 : -1)
    }
  })
})
