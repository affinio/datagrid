import type { ColumnPinMode } from "./types";
export interface LayoutColumnLike {
    key: string;
    width?: number | null;
    minWidth?: number | null;
    maxWidth?: number | null;
}
export interface ColumnLayoutMetric<TColumn> {
    column: TColumn;
    index: number;
    width: number;
    pin: ColumnPinMode;
    offset: number;
}
export interface ColumnLayoutInput<TColumn extends LayoutColumnLike> {
    columns: readonly TColumn[];
    zoom: number;
    resolvePinMode: (column: TColumn) => ColumnPinMode;
}
export interface ColumnLayoutOutput<TColumn extends LayoutColumnLike> {
    zoom: number;
    pinnedLeft: ColumnLayoutMetric<TColumn>[];
    pinnedRight: ColumnLayoutMetric<TColumn>[];
    pinnedLeftWidth: number;
    pinnedRightWidth: number;
    scrollableColumns: TColumn[];
    scrollableIndices: number[];
    scrollableMetrics: {
        widths: number[];
        offsets: number[];
        totalWidth: number;
    };
}
export declare function computeColumnLayout<TColumn extends LayoutColumnLike>(input: ColumnLayoutInput<TColumn>): ColumnLayoutOutput<TColumn>;
//# sourceMappingURL=horizontalLayout.d.ts.map