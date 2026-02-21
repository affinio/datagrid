export interface DataGridCellPointerCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridCellPointerRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface UseDataGridCellPointerDownRouterOptions<TRow, TCoord extends DataGridCellPointerCoord = DataGridCellPointerCoord, TRange extends DataGridCellPointerRange = DataGridCellPointerRange> {
    isSelectionColumn: (columnKey: string) => boolean;
    isRangeMoveModifierActive: (event: MouseEvent) => boolean;
    isEditorInteractionTarget: (target: HTMLElement | null) => boolean;
    hasInlineEditor: () => boolean;
    commitInlineEdit: () => boolean;
    resolveCellCoord: (row: TRow, columnKey: string) => TCoord | null;
    resolveSelectionRange: () => TRange | null;
    isCoordInsideRange: (coord: TCoord, range: TRange) => boolean;
    startRangeMove: (coord: TCoord, pointer: {
        clientX: number;
        clientY: number;
    }) => void;
    closeContextMenu: () => void;
    focusViewport: () => void;
    isFillDragging: () => boolean;
    stopFillSelection: (commit: boolean) => void;
    setDragSelecting: (value: boolean) => void;
    setLastDragCoord: (coord: TCoord) => void;
    setDragPointer: (pointer: {
        clientX: number;
        clientY: number;
    }) => void;
    applyCellSelection: (coord: TCoord, extend: boolean, fallbackAnchor?: TCoord) => void;
    startInteractionAutoScroll: () => void;
    setLastAction: (message: string) => void;
}
export interface UseDataGridCellPointerDownRouterResult<TRow> {
    dispatchCellPointerDown: (row: TRow, columnKey: string, event: MouseEvent) => boolean;
}
export declare function useDataGridCellPointerDownRouter<TRow, TCoord extends DataGridCellPointerCoord = DataGridCellPointerCoord, TRange extends DataGridCellPointerRange = DataGridCellPointerRange>(options: UseDataGridCellPointerDownRouterOptions<TRow, TCoord, TRange>): UseDataGridCellPointerDownRouterResult<TRow>;
//# sourceMappingURL=useDataGridCellPointerDownRouter.d.ts.map