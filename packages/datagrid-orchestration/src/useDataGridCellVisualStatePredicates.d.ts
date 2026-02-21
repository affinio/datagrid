import type { DataGridRowNode } from "@affino/datagrid-core";
export interface DataGridCellVisualStateCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridCellVisualStateRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface UseDataGridCellVisualStatePredicatesOptions<TRow, TCoord extends DataGridCellVisualStateCoord = DataGridCellVisualStateCoord, TRange extends DataGridCellVisualStateRange = DataGridCellVisualStateRange> {
    resolveRowIndex: (row: DataGridRowNode<TRow>) => number;
    resolveColumnIndex: (columnKey: string) => number;
    isCellWithinRange: (rowIndex: number, columnIndex: number, range: TRange) => boolean;
    resolveSelectionRange: () => TRange | null;
    resolveCopiedRange: () => TRange | null;
    resolveAnchorCoord: () => TCoord | null;
    resolveActiveCoord: () => TCoord | null;
    isFillDragging: () => boolean;
    isRangeMoving: () => boolean;
    resolveFillPreviewRange: () => TRange | null;
    resolveFillBaseRange: () => TRange | null;
    resolveMovePreviewRange: () => TRange | null;
    resolveMoveBaseRange: () => TRange | null;
    isInlineEditorOpen?: () => boolean;
    selectColumnKey?: string;
}
export interface UseDataGridCellVisualStatePredicatesResult<TRow> {
    isCellInSelection: (row: DataGridRowNode<TRow>, columnKey: string) => boolean;
    isCellInCopiedRange: (row: DataGridRowNode<TRow>, columnKey: string) => boolean;
    isAnchorCell: (row: DataGridRowNode<TRow>, columnKey: string) => boolean;
    isActiveCell: (row: DataGridRowNode<TRow>, columnKey: string) => boolean;
    isRangeEndCell: (row: DataGridRowNode<TRow>, columnKey: string) => boolean;
    isCellInFillPreview: (row: DataGridRowNode<TRow>, columnKey: string) => boolean;
    isCellInMovePreview: (row: DataGridRowNode<TRow>, columnKey: string) => boolean;
    shouldShowFillHandle: (row: DataGridRowNode<TRow>, columnKey: string) => boolean;
}
export declare function useDataGridCellVisualStatePredicates<TRow, TCoord extends DataGridCellVisualStateCoord = DataGridCellVisualStateCoord, TRange extends DataGridCellVisualStateRange = DataGridCellVisualStateRange>(options: UseDataGridCellVisualStatePredicatesOptions<TRow, TCoord, TRange>): UseDataGridCellVisualStatePredicatesResult<TRow>;
//# sourceMappingURL=useDataGridCellVisualStatePredicates.d.ts.map