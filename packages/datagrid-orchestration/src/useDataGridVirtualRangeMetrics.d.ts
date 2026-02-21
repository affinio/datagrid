export interface DataGridVirtualRange {
    start: number;
    end: number;
}
export interface DataGridVirtualWindowRowSnapshot {
    colStart?: number;
    colEnd?: number;
    colTotal?: number;
    rowStart: number;
    rowEnd: number;
    rowTotal: number;
    overscan?: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
    };
}
export interface UseDataGridVirtualRangeMetricsWindowOptions {
    virtualWindow: DataGridVirtualWindowRowSnapshot;
    rowHeight: number;
}
export type UseDataGridVirtualRangeMetricsOptions = UseDataGridVirtualRangeMetricsWindowOptions;
export interface DataGridVirtualRangeMetricsSnapshot {
    virtualRange: DataGridVirtualRange;
    spacerTopHeight: number;
    spacerBottomHeight: number;
    rangeLabel: string;
}
export declare function computeDataGridVirtualRange(options: UseDataGridVirtualRangeMetricsOptions): DataGridVirtualRange;
export declare function useDataGridVirtualRangeMetrics(options: UseDataGridVirtualRangeMetricsOptions): DataGridVirtualRangeMetricsSnapshot;
//# sourceMappingURL=useDataGridVirtualRangeMetrics.d.ts.map