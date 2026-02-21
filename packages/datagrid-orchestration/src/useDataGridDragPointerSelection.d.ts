export interface DataGridDragPointerSelectionCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridDragPointerSelectionCoordinates {
    clientX: number;
    clientY: number;
}
export interface UseDataGridDragPointerSelectionOptions<TCoord extends DataGridDragPointerSelectionCoord> {
    isDragSelecting: () => boolean;
    resolveDragPointer: () => DataGridDragPointerSelectionCoordinates | null;
    resolveCellCoordFromPointer: (clientX: number, clientY: number) => TCoord | null;
    resolveLastDragCoord: () => TCoord | null;
    setLastDragCoord: (coord: TCoord) => void;
    cellCoordsEqual: (a: TCoord | null, b: TCoord | null) => boolean;
    applyCellSelection: (coord: TCoord, extend: boolean, fallbackAnchor?: TCoord, ensureVisible?: boolean) => void;
}
export interface UseDataGridDragPointerSelectionResult {
    applyDragSelectionFromPointer: () => void;
}
export declare function useDataGridDragPointerSelection<TCoord extends DataGridDragPointerSelectionCoord>(options: UseDataGridDragPointerSelectionOptions<TCoord>): UseDataGridDragPointerSelectionResult;
//# sourceMappingURL=useDataGridDragPointerSelection.d.ts.map