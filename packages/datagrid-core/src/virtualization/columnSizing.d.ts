export declare const DEFAULT_COLUMN_WIDTH = 160;
export declare const COLUMN_VIRTUALIZATION_BUFFER = 2;
export interface ColumnSizeLike {
    width?: number | null;
    minWidth?: number | null;
    maxWidth?: number | null;
}
export interface ColumnWidthMetrics {
    widths: number[];
    offsets: number[];
    totalWidth: number;
}
export interface VisibleColumnRange {
    startIndex: number;
    endIndex: number;
    leftPadding: number;
    rightPadding: number;
}
export interface CalculateVisibleColumnsFromMetricsOptions {
    pinnedLeftWidth?: number;
    pinnedRightWidth?: number;
}
export declare function resolveColumnWidth<T extends ColumnSizeLike>(column: T, zoom?: number): number;
export declare function accumulateColumnWidths<T extends ColumnSizeLike>(columns: readonly T[], zoom?: number): ColumnWidthMetrics;
export declare function calculateVisibleColumns<T extends ColumnSizeLike>(scrollLeft: number, containerWidth: number, columns: readonly T[], options?: {
    zoom?: number;
    pinnedLeftWidth?: number;
    pinnedRightWidth?: number;
    metrics?: ColumnWidthMetrics;
}): VisibleColumnRange & ColumnWidthMetrics;
export declare function calculateVisibleColumnsFromMetrics(scrollLeft: number, containerWidth: number, metrics: ColumnWidthMetrics, options?: CalculateVisibleColumnsFromMetricsOptions): VisibleColumnRange & ColumnWidthMetrics;
//# sourceMappingURL=columnSizing.d.ts.map