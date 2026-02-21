export interface DataGridCellPointerHoverCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface UseDataGridCellPointerHoverRouterOptions<TRow, TCoord extends DataGridCellPointerHoverCoord = DataGridCellPointerHoverCoord> {
    isPrimaryPointerPressed?: (event: MouseEvent) => boolean;
    hasInlineEditor: () => boolean;
    isDragSelecting: () => boolean;
    isSelectionColumn: (columnKey: string) => boolean;
    resolveCellCoord: (row: TRow, columnKey: string) => TCoord | null;
    resolveLastDragCoord: () => TCoord | null;
    setLastDragCoord: (coord: TCoord) => void;
    cellCoordsEqual: (a: TCoord | null, b: TCoord | null) => boolean;
    setDragPointer: (pointer: {
        clientX: number;
        clientY: number;
    }) => void;
    applyCellSelection: (coord: TCoord, extend: boolean, fallbackAnchor?: TCoord, ensureVisible?: boolean) => void;
}
export interface UseDataGridCellPointerHoverRouterResult<TRow> {
    dispatchCellPointerEnter: (row: TRow, columnKey: string, event: MouseEvent) => boolean;
}
export declare function useDataGridCellPointerHoverRouter<TRow, TCoord extends DataGridCellPointerHoverCoord = DataGridCellPointerHoverCoord>(options: UseDataGridCellPointerHoverRouterOptions<TRow, TCoord>): UseDataGridCellPointerHoverRouterResult<TRow>;
//# sourceMappingURL=useDataGridCellPointerHoverRouter.d.ts.map