import type { DataGridColumn } from "../types/column";
import type { ColumnMetric } from "../virtualization/columnSnapshot";
import type { ColumnPinMode } from "../virtualization/types";
import { COLUMN_VIRTUALIZATION_BUFFER, DEFAULT_COLUMN_WIDTH, type ColumnWidthMetrics, type VisibleColumnRange } from "../virtualization/columnSizing";
export { COLUMN_VIRTUALIZATION_BUFFER, DEFAULT_COLUMN_WIDTH };
export type { ColumnWidthMetrics, VisibleColumnRange };
export declare const supportsCssZoom: boolean;
export declare const resolveColumnWidth: (column: DataGridColumn, zoom?: number) => number;
export declare const accumulateColumnWidths: (columns: DataGridColumn[], zoom?: number) => ColumnWidthMetrics;
export declare function calculateVisibleColumns(scrollLeft: number, containerWidth: number, columns: DataGridColumn[], options?: {
    zoom?: number;
    pinnedLeftWidth?: number;
    pinnedRightWidth?: number;
    metrics?: ColumnWidthMetrics;
}): VisibleColumnRange & ColumnWidthMetrics;
export declare function getCellElement(container: HTMLElement | null, rowIndex: number, columnKey: string): HTMLElement | null;
export interface FocusHandle<T = HTMLElement> {
    value: T | null;
}
export declare function focusElement(elementRef: FocusHandle<HTMLElement>): void;
interface ScrollIntoViewInput {
    container: HTMLElement | null;
    targetRowIndex: number;
    rowHeight: number;
    viewportHeight: number;
    currentScrollTop: number;
    clampScrollTop: (value: number) => number;
}
export declare function scrollCellIntoView({ container, targetRowIndex, rowHeight, viewportHeight, currentScrollTop, clampScrollTop, }: ScrollIntoViewInput): number;
export declare function elementFromPoint(clientX: number, clientY: number): Element | null;
export interface TableSpaceColumnInfo<TColumn> {
    column: TColumn;
    key: string;
    pin: ColumnPinMode;
    left: number;
    width: number;
}
export interface TableSpaceColumnLayout<TColumn> {
    ordered: TableSpaceColumnInfo<TColumn>[];
    byKey: Map<string, TableSpaceColumnInfo<TColumn>>;
    pinnedLeftWidth: number;
    scrollableWidth: number;
    pinnedRightWidth: number;
}
export interface BuildTableSpaceLayoutInput<TColumn> {
    columns: readonly TColumn[];
    getColumnKey: (column: TColumn) => string;
    columnWidthMap: ReadonlyMap<string, number>;
    pinnedLeft: readonly ColumnMetric<TColumn>[];
    pinnedRight: readonly ColumnMetric<TColumn>[];
    resolveColumnWidth?: (column: TColumn) => number;
}
export declare function buildTableSpaceColumnLayout<TColumn>(input: BuildTableSpaceLayoutInput<TColumn>): TableSpaceColumnLayout<TColumn>;
//# sourceMappingURL=gridUtils.d.ts.map