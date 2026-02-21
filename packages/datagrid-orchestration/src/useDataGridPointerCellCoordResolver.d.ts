export interface DataGridPointerCellCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridPointerColumnMetric {
    columnIndex: number;
    start: number;
    end: number;
    width: number;
}
import type { DataGridColumnPin } from "@affino/datagrid-core";
export interface DataGridPointerColumnSnapshot {
    pin?: DataGridColumnPin | null;
}
export interface DataGridPointerVirtualWindowSnapshot {
    rowStart?: number;
    rowEnd?: number;
    rowTotal: number;
    colStart?: number;
    colEnd?: number;
    colTotal: number;
    overscan?: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
    };
}
export interface UseDataGridPointerCellCoordResolverOptions<TCoord extends DataGridPointerCellCoord> {
    resolveViewportElement: () => HTMLElement | null;
    resolveColumnMetrics: () => readonly DataGridPointerColumnMetric[];
    resolveColumns: () => readonly DataGridPointerColumnSnapshot[];
    resolveVirtualWindow: () => DataGridPointerVirtualWindowSnapshot | null | undefined;
    resolveHeaderHeight: () => number;
    resolveRowHeight: () => number;
    resolveRowIndexAtOffset?: (offset: number) => number;
    resolveNearestNavigableColumnIndex: (columnIndex: number) => number;
    normalizeCellCoord: (coord: TCoord) => TCoord | null;
}
export interface UseDataGridPointerCellCoordResolverResult<TCoord extends DataGridPointerCellCoord> {
    resolveColumnIndexByAbsoluteX: (absoluteX: number) => number;
    resolveCellCoordFromPointer: (clientX: number, clientY: number) => TCoord | null;
}
export declare function useDataGridPointerCellCoordResolver<TCoord extends DataGridPointerCellCoord>(options: UseDataGridPointerCellCoordResolverOptions<TCoord>): UseDataGridPointerCellCoordResolverResult<TCoord>;
//# sourceMappingURL=useDataGridPointerCellCoordResolver.d.ts.map