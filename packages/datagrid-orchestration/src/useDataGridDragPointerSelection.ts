export interface DataGridDragPointerSelectionCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridDragPointerSelectionCoordinates {
  clientX: number
  clientY: number
}

export interface UseDataGridDragPointerSelectionOptions<TCoord extends DataGridDragPointerSelectionCoord> {
  isDragSelecting: () => boolean
  resolveDragPointer: () => DataGridDragPointerSelectionCoordinates | null
  resolveCellCoordFromPointer: (clientX: number, clientY: number) => TCoord | null
  resolveLastDragCoord: () => TCoord | null
  setLastDragCoord: (coord: TCoord) => void
  cellCoordsEqual: (a: TCoord | null, b: TCoord | null) => boolean
  applyCellSelection: (coord: TCoord, extend: boolean, fallbackAnchor?: TCoord, ensureVisible?: boolean) => void
}

export interface UseDataGridDragPointerSelectionResult {
  applyDragSelectionFromPointer: () => void
}

export function useDataGridDragPointerSelection<TCoord extends DataGridDragPointerSelectionCoord>(
  options: UseDataGridDragPointerSelectionOptions<TCoord>,
): UseDataGridDragPointerSelectionResult {
  function applyDragSelectionFromPointer() {
    if (!options.isDragSelecting()) {
      return
    }
    const pointer = options.resolveDragPointer()
    if (!pointer) {
      return
    }
    const coord = options.resolveCellCoordFromPointer(pointer.clientX, pointer.clientY)
    if (!coord) {
      return
    }
    if (options.cellCoordsEqual(options.resolveLastDragCoord(), coord)) {
      return
    }
    options.setLastDragCoord(coord)
    options.applyCellSelection(coord, true, undefined, false)
  }

  return {
    applyDragSelectionFromPointer,
  }
}
