import type { ColumnPinMode } from "./types";
import type { ColumnWidthMetrics } from "./columnSizing";
export interface ColumnMetric<TColumn> {
    column: TColumn;
    index: number;
    width: number;
    pin: ColumnPinMode;
    scrollableIndex?: number;
    poolIndex?: number;
    offset?: number;
}
export interface ColumnVirtualizationSnapshot<TColumn> {
    pinnedLeft: ColumnMetric<TColumn>[];
    pinnedRight: ColumnMetric<TColumn>[];
    visibleScrollable: ColumnMetric<TColumn>[];
    visibleColumns: ColumnMetric<TColumn>[];
    columnWidthMap: Map<string, number>;
    leftPadding: number;
    rightPadding: number;
    totalScrollableWidth: number;
    visibleScrollableWidth: number;
    scrollableStart: number;
    scrollableEnd: number;
    visibleStart: number;
    visibleEnd: number;
    pinnedLeftWidth: number;
    pinnedRightWidth: number;
    metrics: ColumnWidthMetrics;
    containerWidthForColumns: number;
    indexColumnWidth: number;
    scrollDirection: number;
}
export declare function createEmptyColumnSnapshot<TColumn = unknown>(): ColumnVirtualizationSnapshot<TColumn>;
export interface ColumnSnapshotMeta<TColumn> {
    scrollableColumns: TColumn[];
    scrollableIndices: number[];
    metrics: ColumnWidthMetrics;
    pinnedLeft: ColumnMetric<TColumn>[];
    pinnedRight: ColumnMetric<TColumn>[];
    pinnedLeftWidth: number;
    pinnedRightWidth: number;
    containerWidthForColumns: number;
    indexColumnWidth: number;
    scrollDirection: number;
    zoom: number;
}
export interface ColumnSnapshotPayload {
    visibleStart: number;
    visibleEnd: number;
    leftPadding: number;
    rightPadding: number;
    totalScrollableWidth: number;
    visibleScrollableWidth: number;
}
export interface UpdateColumnSnapshotOptions<TColumn> {
    snapshot: ColumnVirtualizationSnapshot<TColumn>;
    meta: ColumnSnapshotMeta<TColumn>;
    range: {
        start: number;
        end: number;
    };
    payload: ColumnSnapshotPayload;
    getColumnKey: (column: TColumn) => string;
    resolveColumnWidth: (column: TColumn, zoom: number) => number;
}
export interface UpdateColumnSnapshotResult {
    visibleStartIndex: number;
    visibleEndIndex: number;
}
export declare function updateColumnSnapshot<TColumn>(options: UpdateColumnSnapshotOptions<TColumn>): UpdateColumnSnapshotResult;
//# sourceMappingURL=columnSnapshot.d.ts.map