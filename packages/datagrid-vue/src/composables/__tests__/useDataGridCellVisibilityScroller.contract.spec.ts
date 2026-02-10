import { describe, expect, it, vi } from "vitest"
import { useDataGridCellVisibilityScroller } from "../useDataGridCellVisibilityScroller"

interface Coord {
  rowIndex: number
  columnIndex: number
}

interface Metric {
  start: number
  end: number
}

function createViewport(scrollTop: number, scrollLeft: number, clientHeight: number, clientWidth: number): HTMLElement {
  return {
    scrollTop,
    scrollLeft,
    clientHeight,
    clientWidth,
  } as unknown as HTMLElement
}

describe("useDataGridCellVisibilityScroller contract", () => {
  it("is a no-op when viewport or column metric are missing", () => {
    const setScrollPosition = vi.fn()
    const scroller = useDataGridCellVisibilityScroller<Coord, Metric>({
      resolveViewportElement: () => null,
      resolveColumnMetric: () => null,
      resolveVirtualWindow: () => ({
        rowTotal: 10,
        colTotal: 10,
      }),
      resolveHeaderHeight: () => 40,
      resolveRowHeight: () => 32,
      setScrollPosition,
    })

    scroller.ensureCellVisible({ rowIndex: 5, columnIndex: 2 })
    expect(setScrollPosition).not.toHaveBeenCalled()
  })

  it("scrolls vertically upward when row is above visible window", () => {
    const viewport = createViewport(220, 0, 200, 400)
    const setScrollPosition = vi.fn()
    const scroller = useDataGridCellVisibilityScroller<Coord, Metric>({
      resolveViewportElement: () => viewport,
      resolveColumnMetric: () => ({ start: 0, end: 100 }),
      resolveVirtualWindow: () => ({
        rowTotal: 20,
        colTotal: 4,
      }),
      resolveHeaderHeight: () => 40,
      resolveRowHeight: () => 32,
      setScrollPosition,
    })

    scroller.ensureCellVisible({ rowIndex: 2, columnIndex: 0 })
    expect(viewport.scrollTop).toBe(64)
    expect(setScrollPosition).toHaveBeenCalledWith({ top: 64, left: 0 })
  })

  it("scrolls vertically downward when row is below visible window", () => {
    const viewport = createViewport(0, 0, 200, 400)
    const setScrollPosition = vi.fn()
    const scroller = useDataGridCellVisibilityScroller<Coord, Metric>({
      resolveViewportElement: () => viewport,
      resolveColumnMetric: () => ({ start: 0, end: 100 }),
      resolveVirtualWindow: () => ({
        rowTotal: 20,
        colTotal: 4,
      }),
      resolveHeaderHeight: () => 40,
      resolveRowHeight: () => 32,
      setScrollPosition,
    })

    scroller.ensureCellVisible({ rowIndex: 8, columnIndex: 0 })
    expect(viewport.scrollTop).toBe(128)
    expect(setScrollPosition).toHaveBeenCalledWith({ top: 128, left: 0 })
  })

  it("scrolls horizontally in both directions based on column bounds", () => {
    const viewport = createViewport(0, 150, 200, 120)
    const setScrollPosition = vi.fn()
    const metrics: Metric[] = [
      { start: 0, end: 80 },
      { start: 80, end: 160 },
      { start: 160, end: 240 },
      { start: 240, end: 320 },
    ]
    const scroller = useDataGridCellVisibilityScroller<Coord, Metric>({
      resolveViewportElement: () => viewport,
      resolveColumnMetric: columnIndex => metrics[columnIndex],
      resolveVirtualWindow: () => ({
        rowTotal: 20,
        colTotal: metrics.length,
      }),
      resolveHeaderHeight: () => 40,
      resolveRowHeight: () => 32,
      setScrollPosition,
    })

    scroller.ensureCellVisible({ rowIndex: 0, columnIndex: 0 })
    expect(viewport.scrollLeft).toBe(0)

    scroller.ensureCellVisible({ rowIndex: 0, columnIndex: 3 })
    expect(viewport.scrollLeft).toBe(200)
    expect(setScrollPosition).toHaveBeenLastCalledWith({ top: 0, left: 200 })
  })

  it("clamps coordinates using virtualWindow totals when provided", () => {
    const viewport = createViewport(0, 0, 200, 120)
    const setScrollPosition = vi.fn()
    const metrics: Metric[] = [
      { start: 0, end: 80 },
      { start: 80, end: 160 },
      { start: 160, end: 240 },
    ]
    const scroller = useDataGridCellVisibilityScroller<Coord, Metric>({
      resolveViewportElement: () => viewport,
      resolveColumnMetric: columnIndex => metrics[columnIndex],
      resolveVirtualWindow: () => ({
        rowTotal: 4,
        colTotal: 3,
      }),
      resolveHeaderHeight: () => 40,
      resolveRowHeight: () => 32,
      setScrollPosition,
    })

    scroller.ensureCellVisible({ rowIndex: 99, columnIndex: 99 })
    expect(viewport.scrollTop).toBe(0)
    expect(viewport.scrollLeft).toBe(120)
    expect(setScrollPosition).toHaveBeenLastCalledWith({ top: 0, left: 120 })
  })
})
