import type { DataGridRowNode } from "@affino/datagrid-core";
export interface DataGridNavigationPrimitiveCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridNavigationPrimitiveRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
export interface DataGridNavigationPrimitiveColumn {
    key: string;
}
export interface UseDataGridNavigationPrimitivesOptions<TCoord extends DataGridNavigationPrimitiveCoord = DataGridNavigationPrimitiveCoord, TRange extends DataGridNavigationPrimitiveRange = DataGridNavigationPrimitiveRange, TColumn extends DataGridNavigationPrimitiveColumn = DataGridNavigationPrimitiveColumn> {
    resolveColumns: () => readonly TColumn[];
    resolveRowsLength: () => number;
    resolveNavigableColumnIndexes: () => readonly number[];
    normalizeCellCoord: (coord: TCoord) => TCoord | null;
    resolveCellAnchor: () => TCoord | null;
    resolveCellFocus: () => TCoord | null;
    resolveActiveCell: () => TCoord | null;
    setCellAnchor: (coord: TCoord) => void;
    setCellFocus: (coord: TCoord) => void;
    setActiveCell: (coord: TCoord) => void;
    ensureCellVisible: (coord: TCoord) => void;
    coordsEqual: (left: TCoord | null, right: TCoord | null) => boolean;
}
export interface UseDataGridNavigationPrimitivesResult<TCoord extends DataGridNavigationPrimitiveCoord = DataGridNavigationPrimitiveCoord, TRange extends DataGridNavigationPrimitiveRange = DataGridNavigationPrimitiveRange> {
    resolveRowIndex: (row: DataGridRowNode<unknown>) => number;
    resolveColumnIndex: (columnKey: string) => number;
    clampRowIndex: (rowIndex: number) => number;
    getFirstNavigableColumnIndex: () => number;
    getLastNavigableColumnIndex: () => number;
    resolveNearestNavigableColumnIndex: (columnIndex: number, direction?: 1 | -1) => number;
    getAdjacentNavigableColumnIndex: (columnIndex: number, direction: 1 | -1) => number;
    positiveModulo: (value: number, divisor: number) => number;
    applyCellSelection: (nextCoord: TCoord, extend: boolean, fallbackAnchor?: TCoord, ensureVisible?: boolean) => void;
    isCoordInsideRange: (coord: TCoord, range: TRange) => boolean;
}
export declare function useDataGridNavigationPrimitives<TCoord extends DataGridNavigationPrimitiveCoord = DataGridNavigationPrimitiveCoord, TRange extends DataGridNavigationPrimitiveRange = DataGridNavigationPrimitiveRange, TColumn extends DataGridNavigationPrimitiveColumn = DataGridNavigationPrimitiveColumn>(options: UseDataGridNavigationPrimitivesOptions<TCoord, TRange, TColumn>): UseDataGridNavigationPrimitivesResult<TCoord, TRange>;
//# sourceMappingURL=useDataGridNavigationPrimitives.d.ts.map