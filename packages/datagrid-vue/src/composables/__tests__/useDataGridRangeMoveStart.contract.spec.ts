import { describe, expect, it, vi } from "vitest"
import { useDataGridRangeMoveStart } from "../useDataGridRangeMoveStart"

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

describe("useDataGridRangeMoveStart contract", () => {
  it("returns false when there is no current selection range", () => {
    const start = useDataGridRangeMoveStart<Coord, Range>({
      resolveSelectionRange: () => null,
      isCoordInsideRange: () => true,
      closeContextMenu: vi.fn(),
      focusViewport: vi.fn(),
      stopDragSelection: vi.fn(),
      stopFillSelection: vi.fn(),
      setRangeMoving: vi.fn(),
      setRangeMovePointer: vi.fn(),
      setRangeMoveBaseRange: vi.fn(),
      setRangeMoveOrigin: vi.fn(),
      setRangeMovePreviewRange: vi.fn(),
      startInteractionAutoScroll: vi.fn(),
      setLastAction: vi.fn(),
    })

    expect(start.startRangeMove({ rowIndex: 1, columnIndex: 1 }, { clientX: 10, clientY: 20 })).toBe(false)
  })

  it("returns false when coord is outside current selection range", () => {
    const start = useDataGridRangeMoveStart<Coord, Range>({
      resolveSelectionRange: () => ({ startRow: 2, endRow: 4, startColumn: 2, endColumn: 4 }),
      isCoordInsideRange: () => false,
      closeContextMenu: vi.fn(),
      focusViewport: vi.fn(),
      stopDragSelection: vi.fn(),
      stopFillSelection: vi.fn(),
      setRangeMoving: vi.fn(),
      setRangeMovePointer: vi.fn(),
      setRangeMoveBaseRange: vi.fn(),
      setRangeMoveOrigin: vi.fn(),
      setRangeMovePreviewRange: vi.fn(),
      startInteractionAutoScroll: vi.fn(),
      setLastAction: vi.fn(),
    })

    expect(start.startRangeMove({ rowIndex: 1, columnIndex: 1 }, { clientX: 10, clientY: 20 })).toBe(false)
  })

  it("initializes range-move state and returns true when coord is inside range", () => {
    const closeContextMenu = vi.fn()
    const focusViewport = vi.fn()
    const stopDragSelection = vi.fn()
    const stopFillSelection = vi.fn()
    const setRangeMoving = vi.fn()
    const setRangeMovePointer = vi.fn()
    const setRangeMoveBaseRange = vi.fn()
    const setRangeMoveOrigin = vi.fn()
    const setRangeMovePreviewRange = vi.fn()
    const startInteractionAutoScroll = vi.fn()
    const setLastAction = vi.fn()

    const range = { startRow: 2, endRow: 4, startColumn: 2, endColumn: 4 }
    const coord = { rowIndex: 3, columnIndex: 3 }
    const pointer = { clientX: 110, clientY: 220 }

    const start = useDataGridRangeMoveStart<Coord, Range>({
      resolveSelectionRange: () => range,
      isCoordInsideRange: () => true,
      closeContextMenu,
      focusViewport,
      stopDragSelection,
      stopFillSelection,
      setRangeMoving,
      setRangeMovePointer,
      setRangeMoveBaseRange,
      setRangeMoveOrigin,
      setRangeMovePreviewRange,
      startInteractionAutoScroll,
      setLastAction,
    })

    expect(start.startRangeMove(coord, pointer)).toBe(true)
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
    expect(focusViewport).toHaveBeenCalledTimes(1)
    expect(stopDragSelection).toHaveBeenCalledTimes(1)
    expect(stopFillSelection).toHaveBeenCalledWith(false)
    expect(setRangeMoving).toHaveBeenCalledWith(true)
    expect(setRangeMovePointer).toHaveBeenCalledWith(pointer)
    expect(setRangeMoveBaseRange).toHaveBeenCalledWith(range)
    expect(setRangeMoveOrigin).toHaveBeenCalledWith(coord)
    expect(setRangeMovePreviewRange).toHaveBeenCalledWith(range)
    expect(startInteractionAutoScroll).toHaveBeenCalledTimes(1)
    expect(setLastAction).toHaveBeenCalledWith("Move preview active")
  })
})
