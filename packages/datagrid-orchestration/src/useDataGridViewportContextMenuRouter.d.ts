import type { OpenDataGridContextMenuInput } from "./dataGridContextMenuContracts";
export interface DataGridViewportContextMenuCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridViewportContextMenuRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface UseDataGridViewportContextMenuRouterOptions<TCoord extends DataGridViewportContextMenuCoord = DataGridViewportContextMenuCoord, TRange extends DataGridViewportContextMenuRange = DataGridViewportContextMenuRange> {
    isInteractionBlocked: () => boolean;
    isRangeMoveModifierActive: (event: MouseEvent) => boolean;
    resolveSelectionRange: () => TRange | null;
    resolveCellCoordFromDataset: (rowId: string, columnKey: string) => TCoord | null;
    applyCellSelection: (coord: TCoord, extend: boolean, fallbackAnchor?: TCoord, ensureVisible?: boolean) => void;
    resolveActiveCellCoord: () => TCoord | null;
    setActiveCellCoord: (coord: TCoord) => void;
    cellCoordsEqual: (a: TCoord | null, b: TCoord | null) => boolean;
    isMultiCellSelection: (range: TRange | null) => boolean;
    isCoordInsideRange: (coord: TCoord, range: TRange) => boolean;
    openContextMenu: (clientX: number, clientY: number, context: OpenDataGridContextMenuInput) => void;
    closeContextMenu: () => void;
    isColumnContextEnabled?: (columnKey: string) => boolean;
}
export interface UseDataGridViewportContextMenuRouterResult {
    dispatchViewportContextMenu: (event: MouseEvent) => boolean;
}
export declare function useDataGridViewportContextMenuRouter<TCoord extends DataGridViewportContextMenuCoord = DataGridViewportContextMenuCoord, TRange extends DataGridViewportContextMenuRange = DataGridViewportContextMenuRange>(options: UseDataGridViewportContextMenuRouterOptions<TCoord, TRange>): UseDataGridViewportContextMenuRouterResult;
//# sourceMappingURL=useDataGridViewportContextMenuRouter.d.ts.map