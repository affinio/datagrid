import { describe, expect, it, vi } from "vitest"
import { useDataGridCellPointerHoverRouter } from "../useDataGridCellPointerHoverRouter"

function createEvent(init: MouseEventInit = {}): MouseEvent {
  return new MouseEvent("mouseenter", { bubbles: true, cancelable: true, ...init })
}

describe("useDataGridCellPointerHoverRouter contract", () => {
  it("updates drag selection when hover moves to a new coord", () => {
    let lastCoord: { rowIndex: number; columnIndex: number } | null = { rowIndex: 1, columnIndex: 1 }
    const setDragPointer = vi.fn()
    const applyCellSelection = vi.fn()

    const router = useDataGridCellPointerHoverRouter({
      hasInlineEditor: () => false,
      isDragSelecting: () => true,
      isSelectionColumn: () => false,
      resolveCellCoord: () => ({ rowIndex: 2, columnIndex: 3 }),
      resolveLastDragCoord: () => lastCoord,
      setLastDragCoord(coord) {
        lastCoord = coord
      },
      cellCoordsEqual: (a, b) => !!a && !!b && a.rowIndex === b.rowIndex && a.columnIndex === b.columnIndex,
      setDragPointer,
      applyCellSelection,
    })

    const event = createEvent({ clientX: 55, clientY: 66 })
    expect(router.dispatchCellPointerEnter({ rowId: "R3" }, "owner", event)).toBe(true)
    expect(lastCoord).toEqual({ rowIndex: 2, columnIndex: 3 })
    expect(setDragPointer).toHaveBeenCalledWith({ clientX: 55, clientY: 66 })
    expect(applyCellSelection).toHaveBeenCalledWith({ rowIndex: 2, columnIndex: 3 }, true, undefined, false)
  })

  it("ignores hover when not in drag mode / selection column / inline edit", () => {
    const applyCellSelection = vi.fn()
    const baseOptions = {
      resolveCellCoord: () => ({ rowIndex: 0, columnIndex: 0 }),
      resolveLastDragCoord: () => null,
      setLastDragCoord: vi.fn(),
      cellCoordsEqual: vi.fn(() => false),
      setDragPointer: vi.fn(),
      applyCellSelection,
    }

    const noDragRouter = useDataGridCellPointerHoverRouter({
      ...baseOptions,
      hasInlineEditor: () => false,
      isDragSelecting: () => false,
      isSelectionColumn: () => false,
    })
    expect(noDragRouter.dispatchCellPointerEnter({ rowId: "R1" }, "owner", createEvent())).toBe(false)

    const selectionColumnRouter = useDataGridCellPointerHoverRouter({
      ...baseOptions,
      hasInlineEditor: () => false,
      isDragSelecting: () => true,
      isSelectionColumn: (key: string) => key === "select",
    })
    expect(selectionColumnRouter.dispatchCellPointerEnter({ rowId: "R1" }, "select", createEvent())).toBe(false)

    const inlineRouter = useDataGridCellPointerHoverRouter({
      ...baseOptions,
      hasInlineEditor: () => true,
      isDragSelecting: () => true,
      isSelectionColumn: () => false,
    })
    expect(inlineRouter.dispatchCellPointerEnter({ rowId: "R1" }, "owner", createEvent())).toBe(false)

    expect(applyCellSelection).not.toHaveBeenCalled()
  })

  it("ignores hover when coord does not change", () => {
    const coord = { rowIndex: 4, columnIndex: 2 }
    const applyCellSelection = vi.fn()
    const router = useDataGridCellPointerHoverRouter({
      hasInlineEditor: () => false,
      isDragSelecting: () => true,
      isSelectionColumn: () => false,
      resolveCellCoord: () => coord,
      resolveLastDragCoord: () => coord,
      setLastDragCoord: vi.fn(),
      cellCoordsEqual: (a, b) => !!a && !!b && a.rowIndex === b.rowIndex && a.columnIndex === b.columnIndex,
      setDragPointer: vi.fn(),
      applyCellSelection,
    })

    expect(router.dispatchCellPointerEnter({ rowId: "R5" }, "service", createEvent())).toBe(false)
    expect(applyCellSelection).not.toHaveBeenCalled()
  })
})
