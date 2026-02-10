import { describe, expect, it } from "vitest"
import { useDataGridPointerCellCoordResolver } from "../useDataGridPointerCellCoordResolver"

interface Coord {
  rowIndex: number
  columnIndex: number
}

interface ViewportRect {
  left: number
  top: number
  width: number
  height: number
}

function createViewport(rect: ViewportRect, scrollTop: number, scrollLeft: number): HTMLElement {
  return {
    scrollTop,
    scrollLeft,
    getBoundingClientRect() {
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
      }
    },
  } as unknown as HTMLElement
}

describe("useDataGridPointerCellCoordResolver contract", () => {
  it("uses virtualWindow totals as canonical bounds", () => {
    const viewport = createViewport({ left: 10, top: 20, width: 300, height: 220 }, 64, 40)
    const resolver = useDataGridPointerCellCoordResolver<Coord>({
      resolveViewportElement: () => viewport,
      resolveVirtualWindow: () => ({
        rowTotal: 100,
        colTotal: 3,
      }),
      resolveColumnMetrics: () => [
        { columnIndex: 0, start: 0, end: 60, width: 60 },
        { columnIndex: 1, start: 60, end: 180, width: 120 },
        { columnIndex: 2, start: 180, end: 280, width: 100 },
      ],
      resolveColumns: () => [{ pin: "left" }, { pin: null }, { pin: null }],
      resolveHeaderHeight: () => 40,
      resolveRowHeight: () => 32,
      resolveNearestNavigableColumnIndex: index => index,
      normalizeCellCoord: coord => coord,
    })

    expect(resolver.resolveCellCoordFromPointer(100, 100)).toEqual({
      rowIndex: 3,
      columnIndex: 2,
    })
  })
})
