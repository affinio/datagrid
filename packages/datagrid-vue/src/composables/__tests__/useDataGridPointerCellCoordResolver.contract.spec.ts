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
  it("returns null when viewport is missing or row count is zero", () => {
    const resolver = useDataGridPointerCellCoordResolver<Coord>({
      resolveViewportElement: () => null,
      resolveRowCount: () => 0,
      resolveColumnMetrics: () => [],
      resolveColumns: () => [],
      resolveHeaderHeight: () => 40,
      resolveRowHeight: () => 32,
      resolveNearestNavigableColumnIndex: index => index,
      normalizeCellCoord: coord => coord,
    })

    expect(resolver.resolveCellCoordFromPointer(100, 100)).toBeNull()
  })

  it("resolves center area using viewport scroll offset", () => {
    const viewport = createViewport({ left: 10, top: 20, width: 300, height: 220 }, 96, 120)
    const resolver = useDataGridPointerCellCoordResolver<Coord>({
      resolveViewportElement: () => viewport,
      resolveRowCount: () => 500,
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
      rowIndex: 4,
      columnIndex: 2,
    })
  })

  it("resolves pinned-left and pinned-right hit-zones without scroll drift", () => {
    const viewport = createViewport({ left: 100, top: 50, width: 500, height: 260 }, 0, 260)
    const resolver = useDataGridPointerCellCoordResolver<Coord>({
      resolveViewportElement: () => viewport,
      resolveRowCount: () => 100,
      resolveColumnMetrics: () => [
        { columnIndex: 0, start: 0, end: 80, width: 80 },
        { columnIndex: 1, start: 80, end: 220, width: 140 },
        { columnIndex: 2, start: 220, end: 360, width: 140 },
        { columnIndex: 3, start: 360, end: 500, width: 140 },
      ],
      resolveColumns: () => [{ pin: "left" }, { pin: null }, { pin: null }, { pin: "right" }],
      resolveHeaderHeight: () => 40,
      resolveRowHeight: () => 32,
      resolveNearestNavigableColumnIndex: index => index,
      normalizeCellCoord: coord => coord,
    })

    expect(resolver.resolveCellCoordFromPointer(120, 120)?.columnIndex).toBe(0)
    expect(resolver.resolveCellCoordFromPointer(590, 120)?.columnIndex).toBe(3)
  })

  it("clamps absolute X to available metrics and resolves last column fallback", () => {
    const resolver = useDataGridPointerCellCoordResolver<Coord>({
      resolveViewportElement: () => null,
      resolveRowCount: () => 1,
      resolveColumnMetrics: () => [
        { columnIndex: 0, start: 0, end: 50, width: 50 },
        { columnIndex: 1, start: 50, end: 100, width: 50 },
      ],
      resolveColumns: () => [{ pin: null }, { pin: null }],
      resolveHeaderHeight: () => 0,
      resolveRowHeight: () => 32,
      resolveNearestNavigableColumnIndex: index => index,
      normalizeCellCoord: coord => coord,
    })

    expect(resolver.resolveColumnIndexByAbsoluteX(-50)).toBe(0)
    expect(resolver.resolveColumnIndexByAbsoluteX(49)).toBe(0)
    expect(resolver.resolveColumnIndexByAbsoluteX(9999)).toBe(1)
  })
})
