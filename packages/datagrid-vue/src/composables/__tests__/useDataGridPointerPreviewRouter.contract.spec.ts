import { describe, expect, it, vi } from "vitest"
import { useDataGridPointerPreviewRouter } from "../useDataGridPointerPreviewRouter"

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

describe("useDataGridPointerPreviewRouter contract", () => {
  it("updates fill preview when pointer resolves a new range", () => {
    let fillPreview: Range | null = { startRow: 1, endRow: 1, startColumn: 1, endColumn: 1 }
    const setFillPreviewRange = vi.fn((next: Range) => {
      fillPreview = next
    })

    const router = useDataGridPointerPreviewRouter<Coord, Range>({
      isFillDragging: () => true,
      resolveFillPointer: () => ({ clientX: 10, clientY: 20 }),
      resolveFillBaseRange: () => ({ startRow: 1, endRow: 1, startColumn: 1, endColumn: 1 }),
      resolveFillPreviewRange: () => fillPreview,
      setFillPreviewRange,
      isRangeMoving: () => false,
      resolveRangeMovePointer: () => null,
      resolveRangeMoveBaseRange: () => null,
      resolveRangeMoveOrigin: () => null,
      resolveRangeMovePreviewRange: () => null,
      setRangeMovePreviewRange: vi.fn(),
      resolveCellCoordFromPointer: () => ({ rowIndex: 3, columnIndex: 4 }),
      buildExtendedRange: (base, coord) => ({
        startRow: Math.min(base.startRow, coord.rowIndex),
        endRow: Math.max(base.endRow, coord.rowIndex),
        startColumn: Math.min(base.startColumn, coord.columnIndex),
        endColumn: Math.max(base.endColumn, coord.columnIndex),
      }),
      normalizeSelectionRange: range => range,
      rangesEqual: (a, b) => !!a && !!b && a.startRow === b.startRow && a.endRow === b.endRow
        && a.startColumn === b.startColumn && a.endColumn === b.endColumn,
    })

    router.applyFillPreviewFromPointer()

    expect(setFillPreviewRange).toHaveBeenCalledWith({
      startRow: 1,
      endRow: 3,
      startColumn: 1,
      endColumn: 4,
    })
  })

  it("does not update fill preview when resolved range is unchanged", () => {
    const setFillPreviewRange = vi.fn()
    const unchanged = { startRow: 1, endRow: 3, startColumn: 1, endColumn: 4 }

    const router = useDataGridPointerPreviewRouter<Coord, Range>({
      isFillDragging: () => true,
      resolveFillPointer: () => ({ clientX: 10, clientY: 20 }),
      resolveFillBaseRange: () => ({ startRow: 1, endRow: 1, startColumn: 1, endColumn: 1 }),
      resolveFillPreviewRange: () => unchanged,
      setFillPreviewRange,
      isRangeMoving: () => false,
      resolveRangeMovePointer: () => null,
      resolveRangeMoveBaseRange: () => null,
      resolveRangeMoveOrigin: () => null,
      resolveRangeMovePreviewRange: () => null,
      setRangeMovePreviewRange: vi.fn(),
      resolveCellCoordFromPointer: () => ({ rowIndex: 3, columnIndex: 4 }),
      buildExtendedRange: () => unchanged,
      normalizeSelectionRange: range => range,
      rangesEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    })

    router.applyFillPreviewFromPointer()
    expect(setFillPreviewRange).not.toHaveBeenCalled()
  })

  it("updates range-move preview from pointer delta", () => {
    let previewRange: Range | null = { startRow: 5, endRow: 5, startColumn: 5, endColumn: 5 }
    const setRangeMovePreviewRange = vi.fn((next: Range) => {
      previewRange = next
    })

    const router = useDataGridPointerPreviewRouter<Coord, Range>({
      isFillDragging: () => false,
      resolveFillPointer: () => null,
      resolveFillBaseRange: () => null,
      resolveFillPreviewRange: () => null,
      setFillPreviewRange: vi.fn(),
      isRangeMoving: () => true,
      resolveRangeMovePointer: () => ({ clientX: 30, clientY: 40 }),
      resolveRangeMoveBaseRange: () => ({ startRow: 5, endRow: 7, startColumn: 5, endColumn: 6 }),
      resolveRangeMoveOrigin: () => ({ rowIndex: 4, columnIndex: 4 }),
      resolveRangeMovePreviewRange: () => previewRange,
      setRangeMovePreviewRange,
      resolveCellCoordFromPointer: () => ({ rowIndex: 6, columnIndex: 8 }),
      buildExtendedRange: () => null,
      normalizeSelectionRange: range => range,
      rangesEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    })

    router.applyRangeMovePreviewFromPointer()

    expect(setRangeMovePreviewRange).toHaveBeenCalledWith({
      startRow: 7,
      endRow: 9,
      startColumn: 9,
      endColumn: 10,
    })
  })

  it("skips range-move preview update when prerequisites are missing", () => {
    const setRangeMovePreviewRange = vi.fn()

    const router = useDataGridPointerPreviewRouter<Coord, Range>({
      isFillDragging: () => false,
      resolveFillPointer: () => null,
      resolveFillBaseRange: () => null,
      resolveFillPreviewRange: () => null,
      setFillPreviewRange: vi.fn(),
      isRangeMoving: () => true,
      resolveRangeMovePointer: () => null,
      resolveRangeMoveBaseRange: () => ({ startRow: 1, endRow: 1, startColumn: 1, endColumn: 1 }),
      resolveRangeMoveOrigin: () => ({ rowIndex: 1, columnIndex: 1 }),
      resolveRangeMovePreviewRange: () => null,
      setRangeMovePreviewRange,
      resolveCellCoordFromPointer: () => ({ rowIndex: 1, columnIndex: 1 }),
      buildExtendedRange: () => null,
      normalizeSelectionRange: range => range,
      rangesEqual: () => false,
    })

    router.applyRangeMovePreviewFromPointer()
    expect(setRangeMovePreviewRange).not.toHaveBeenCalled()
  })
})
