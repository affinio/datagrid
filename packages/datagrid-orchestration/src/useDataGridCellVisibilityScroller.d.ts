export interface DataGridCellVisibilityCoord {
    rowIndex: number;
    columnIndex: number;
}
export interface DataGridCellVisibilityColumnMetric {
    start: number;
    end: number;
}
export interface DataGridCellVisibilityScrollPosition {
    top: number;
    left: number;
}
export interface DataGridCellVisibilityVirtualWindow {
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
export interface UseDataGridCellVisibilityScrollerOptions<TCoord extends DataGridCellVisibilityCoord, TMetric extends DataGridCellVisibilityColumnMetric = DataGridCellVisibilityColumnMetric> {
    resolveViewportElement: () => HTMLElement | null;
    resolveColumnMetric: (columnIndex: number) => TMetric | null | undefined;
    resolveVirtualWindow: () => DataGridCellVisibilityVirtualWindow | null | undefined;
    resolveHeaderHeight: () => number;
    resolveRowHeight: () => number;
    resolveRowOffset?: (rowIndex: number) => number;
    resolveRowHeightAtIndex?: (rowIndex: number) => number;
    setScrollPosition: (position: DataGridCellVisibilityScrollPosition) => void;
}
export interface UseDataGridCellVisibilityScrollerResult<TCoord extends DataGridCellVisibilityCoord> {
    ensureCellVisible: (coord: TCoord) => void;
}
export declare function useDataGridCellVisibilityScroller<TCoord extends DataGridCellVisibilityCoord, TMetric extends DataGridCellVisibilityColumnMetric = DataGridCellVisibilityColumnMetric>(options: UseDataGridCellVisibilityScrollerOptions<TCoord, TMetric>): UseDataGridCellVisibilityScrollerResult<TCoord>;
//# sourceMappingURL=useDataGridCellVisibilityScroller.d.ts.map