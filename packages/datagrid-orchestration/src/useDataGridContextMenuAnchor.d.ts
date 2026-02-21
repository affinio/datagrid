import type { OpenDataGridContextMenuInput } from "./dataGridContextMenuContracts";
export interface DataGridContextMenuAnchorCellCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridContextMenuAnchorRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface DataGridContextMenuAnchorRowIdentity {
    rowId: string | number;
}
export interface DataGridContextMenuAnchorColumnIdentity {
    key: string;
}
export interface UseDataGridContextMenuAnchorOptions<TRow extends DataGridContextMenuAnchorRowIdentity = DataGridContextMenuAnchorRowIdentity, TColumn extends DataGridContextMenuAnchorColumnIdentity = DataGridContextMenuAnchorColumnIdentity, TCoord extends DataGridContextMenuAnchorCellCoord = DataGridContextMenuAnchorCellCoord, TRange extends DataGridContextMenuAnchorRange = DataGridContextMenuAnchorRange> {
    resolveCurrentCellCoord: () => TCoord | null;
    resolveViewportElement: () => HTMLElement | null;
    resolveRowAtIndex: (rowIndex: number) => TRow | undefined;
    resolveColumnAtIndex: (columnIndex: number) => TColumn | undefined;
    resolveSelectionRange: () => TRange | null;
    isMultiCellSelection: (range: TRange) => boolean;
    isCoordInsideRange: (coord: TCoord, range: TRange) => boolean;
    openContextMenu: (clientX: number, clientY: number, context: OpenDataGridContextMenuInput) => void;
    isColumnContextEnabled?: (column: TColumn) => boolean;
}
export interface UseDataGridContextMenuAnchorResult {
    openContextMenuFromCurrentCell: () => boolean;
}
export declare function useDataGridContextMenuAnchor<TRow extends DataGridContextMenuAnchorRowIdentity = DataGridContextMenuAnchorRowIdentity, TColumn extends DataGridContextMenuAnchorColumnIdentity = DataGridContextMenuAnchorColumnIdentity, TCoord extends DataGridContextMenuAnchorCellCoord = DataGridContextMenuAnchorCellCoord, TRange extends DataGridContextMenuAnchorRange = DataGridContextMenuAnchorRange>(options: UseDataGridContextMenuAnchorOptions<TRow, TColumn, TCoord, TRange>): UseDataGridContextMenuAnchorResult;
//# sourceMappingURL=useDataGridContextMenuAnchor.d.ts.map