import { describe, expect, it } from "vitest"
import type { UiTableColumn } from "../../types"
import type { ColumnMetric } from "../../virtualization/columnSnapshot"
import { computeFillHandleStyle } from "../fillHandle"
import { computeSelectionOverlayRects } from "../selectionOverlay"
import type { GridSelectionRange } from "../selectionState"

function createColumns(scale = 1): UiTableColumn[] {
  return [
    { key: "id", label: "ID", pin: "left", width: 40 * scale },
    { key: "name", label: "Name", width: 60 * scale },
    { key: "status", label: "Status", width: 70 * scale },
    { key: "owner", label: "Owner", pin: "right", width: 80 * scale },
  ]
}

function toMetric(column: UiTableColumn, index: number, pin: "left" | "none" | "right", width: number): ColumnMetric<UiTableColumn> {
  return {
    column,
    index,
    width,
    pin,
  }
}

function createRange(rowIndex: number, colIndex: number): GridSelectionRange<number> {
  const point = { rowIndex, colIndex, rowId: rowIndex }
  return {
    startRow: rowIndex,
    endRow: rowIndex,
    startCol: colIndex,
    endCol: colIndex,
    anchor: point,
    focus: point,
    startRowId: rowIndex,
    endRowId: rowIndex,
  }
}

describe("selection overlay geometry contract", () => {
  it("keeps world-space column coordinates stable across horizontal scroll", () => {
    const columns = createColumns(2)
    const widthMap = new Map<string, number>([
      ["id", 80],
      ["name", 120],
      ["status", 140],
      ["owner", 160],
    ])

    const pinnedLeft = [toMetric(columns[0]!, 0, "left", 80)]
    const pinnedRight = [toMetric(columns[3]!, 3, "right", 160)]
    const ranges = [createRange(2, 0), createRange(2, 1), createRange(2, 2), createRange(2, 3)]

    const baseContext = {
      ranges,
      activeRangeIndex: 1,
      activeCell: ranges[1].focus,
      fillPreview: null,
      cutPreview: [],
      cutPreviewActiveIndex: -1,
      columns,
      columnWidthMap: widthMap,
      pinnedLeft,
      pinnedRight,
      rowHeight: 48,
      getColumnKey: (column: UiTableColumn) => column.key,
    }

    const noScroll = computeSelectionOverlayRects({
      ...baseContext,
      viewport: {
        width: 640,
        height: 320,
        scrollLeft: 0,
        scrollTop: 0,
        startRow: 0,
        endRow: 100,
        visibleStartCol: 0,
        visibleEndCol: 4,
        virtualizationEnabled: true,
      },
    })

    const withScroll = computeSelectionOverlayRects({
      ...baseContext,
      viewport: {
        width: 640,
        height: 320,
        scrollLeft: 120,
        scrollTop: 0,
        startRow: 0,
        endRow: 100,
        visibleStartCol: 0,
        visibleEndCol: 4,
        virtualizationEnabled: true,
      },
    })

    expect(noScroll.ranges.length).toBe(4)
    expect(withScroll.ranges.length).toBe(4)

    const byIdNoScroll = new Map(noScroll.ranges.map(rect => [rect.id, rect]))
    const byIdWithScroll = new Map(withScroll.ranges.map(rect => [rect.id, rect]))

    const expected = {
      "range-0-0": { left: 0, width: 80, pin: "left" },
      "range-1-0": { left: 80, width: 120, pin: "none" },
      "range-2-0": { left: 200, width: 140, pin: "none" },
      "range-3-0": { left: 340, width: 160, pin: "right" },
    } as const

    for (const [id, expectation] of Object.entries(expected)) {
      const first = byIdNoScroll.get(id)
      const second = byIdWithScroll.get(id)
      expect(first).toBeDefined()
      expect(second).toBeDefined()
      expect(first?.left).toBe(expectation.left)
      expect(first?.width).toBe(expectation.width)
      expect(first?.pin).toBe(expectation.pin)
      // World-space overlay coordinates must stay stable regardless of scroll position.
      expect(second?.left).toBe(first?.left)
      expect(second?.width).toBe(first?.width)
      expect(second?.pin).toBe(first?.pin)
    }

    for (const rect of noScroll.ranges) {
      expect(rect.top).toBe(96)
      expect(rect.height).toBe(48)
    }
  })
})

describe("fill handle geometry contract", () => {
  it("computes accurate viewport-space handle positions for pinned and scrollable columns", () => {
    const columns = createColumns(1)
    const widthMap = new Map<string, number>([
      ["id", 40],
      ["name", 60],
      ["status", 70],
      ["owner", 80],
    ])
    const pinnedLeft = [toMetric(columns[0]!, 0, "left", 40)]
    const pinnedRight = [toMetric(columns[3]!, 3, "right", 80)]

    const base = {
      columns,
      columnWidthMap: widthMap,
      pinnedLeft,
      pinnedRight,
      rowHeight: 25,
      fillHandleSize: 8,
      viewport: {
        width: 320,
        height: 200,
        scrollLeft: 30,
        scrollTop: 10,
        startRow: 0,
        endRow: 100,
        visibleStartCol: 0,
        visibleEndCol: 4,
        virtualizationEnabled: true,
      },
      getColumnKey: (column: UiTableColumn) => column.key,
      isSystemColumn: () => false,
      rowIndexColumnKey: "__rowIndex__",
    }

    const leftPinned = computeFillHandleStyle({
      ...base,
      activeRange: createRange(2, 0),
    })
    const scrollable = computeFillHandleStyle({
      ...base,
      activeRange: createRange(2, 1),
    })
    const rightPinned = computeFillHandleStyle({
      ...base,
      activeRange: createRange(2, 3),
    })

    expect(leftPinned).toEqual({ kind: "style", left: 32, top: 57, size: 8 })
    expect(scrollable).toEqual({ kind: "style", left: 62, top: 57, size: 8 })
    expect(rightPinned).toEqual({ kind: "style", left: 312, top: 57, size: 8 })
  })

  it("preserves coordinate math under zoom-scaled metrics", () => {
    const columns = createColumns(1.5)
    const widthMap = new Map<string, number>([
      ["id", 60],
      ["name", 90],
      ["status", 105],
      ["owner", 120],
    ])
    const pinnedLeft = [toMetric(columns[0]!, 0, "left", 60)]
    const pinnedRight = [toMetric(columns[3]!, 3, "right", 120)]

    const result = computeFillHandleStyle({
      activeRange: createRange(3, 2),
      columns,
      columnWidthMap: widthMap,
      pinnedLeft,
      pinnedRight,
      rowHeight: 37.5,
      fillHandleSize: 10,
      viewport: {
        width: 640,
        height: 360,
        scrollLeft: 75,
        scrollTop: 22.5,
        startRow: 0,
        endRow: 200,
        visibleStartCol: 0,
        visibleEndCol: 4,
        virtualizationEnabled: true,
      },
      getColumnKey: (column: UiTableColumn) => column.key,
      isSystemColumn: () => false,
    })

    // status column in table space starts at 60 + 90 = 150, width 105.
    // viewport right edge = 150 + 105 - 75 = 180, handle left = 170.
    // row 3 visual bottom = (4 * 37.5) - 22.5 = 127.5, handle top = 117.5.
    expect(result).toEqual({ kind: "style", left: 170, top: 117.5, size: 10 })
  })
})
