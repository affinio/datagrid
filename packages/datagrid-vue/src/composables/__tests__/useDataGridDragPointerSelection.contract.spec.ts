import { describe, expect, it, vi } from "vitest"
import { useDataGridDragPointerSelection } from "../useDataGridDragPointerSelection"

interface Coord {
  rowIndex: number
  columnIndex: number
}

describe("useDataGridDragPointerSelection contract", () => {
  it("is a no-op when drag-selection is inactive", () => {
    const applyCellSelection = vi.fn()
    const selection = useDataGridDragPointerSelection<Coord>({
      isDragSelecting: () => false,
      resolveDragPointer: () => ({ clientX: 10, clientY: 20 }),
      resolveCellCoordFromPointer: () => ({ rowIndex: 1, columnIndex: 1 }),
      resolveLastDragCoord: () => null,
      setLastDragCoord: vi.fn(),
      cellCoordsEqual: () => false,
      applyCellSelection,
    })

    selection.applyDragSelectionFromPointer()
    expect(applyCellSelection).not.toHaveBeenCalled()
  })

  it("is a no-op when pointer or coord cannot be resolved", () => {
    const applyCellSelection = vi.fn()
    const setLastDragCoord = vi.fn()
    const selection = useDataGridDragPointerSelection<Coord>({
      isDragSelecting: () => true,
      resolveDragPointer: () => null,
      resolveCellCoordFromPointer: () => ({ rowIndex: 1, columnIndex: 1 }),
      resolveLastDragCoord: () => null,
      setLastDragCoord,
      cellCoordsEqual: () => false,
      applyCellSelection,
    })

    selection.applyDragSelectionFromPointer()
    expect(setLastDragCoord).not.toHaveBeenCalled()
    expect(applyCellSelection).not.toHaveBeenCalled()
  })

  it("is a no-op when pointer-resolved coord equals last coord", () => {
    const applyCellSelection = vi.fn()
    const setLastDragCoord = vi.fn()
    const last = { rowIndex: 2, columnIndex: 4 }
    const selection = useDataGridDragPointerSelection<Coord>({
      isDragSelecting: () => true,
      resolveDragPointer: () => ({ clientX: 10, clientY: 20 }),
      resolveCellCoordFromPointer: () => ({ rowIndex: 2, columnIndex: 4 }),
      resolveLastDragCoord: () => last,
      setLastDragCoord,
      cellCoordsEqual: (a, b) => a?.rowIndex === b?.rowIndex && a?.columnIndex === b?.columnIndex,
      applyCellSelection,
    })

    selection.applyDragSelectionFromPointer()
    expect(setLastDragCoord).not.toHaveBeenCalled()
    expect(applyCellSelection).not.toHaveBeenCalled()
  })

  it("updates last coord and extends selection for a new pointer coord", () => {
    const applyCellSelection = vi.fn()
    const setLastDragCoord = vi.fn()
    const coord = { rowIndex: 6, columnIndex: 3 }
    const selection = useDataGridDragPointerSelection<Coord>({
      isDragSelecting: () => true,
      resolveDragPointer: () => ({ clientX: 110, clientY: 220 }),
      resolveCellCoordFromPointer: () => coord,
      resolveLastDragCoord: () => ({ rowIndex: 4, columnIndex: 2 }),
      setLastDragCoord,
      cellCoordsEqual: (a, b) => a?.rowIndex === b?.rowIndex && a?.columnIndex === b?.columnIndex,
      applyCellSelection,
    })

    selection.applyDragSelectionFromPointer()
    expect(setLastDragCoord).toHaveBeenCalledWith(coord)
    expect(applyCellSelection).toHaveBeenCalledWith(coord, true, undefined, false)
  })
})
