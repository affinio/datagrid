import type { UiTableColumn } from "../types";
import { type ColumnLayoutMetric, type ColumnLayoutOutput } from "../virtualization/horizontalLayout";
import type { HorizontalVirtualizerMeta } from "../virtualization/horizontalVirtualizer";
import type { TableViewportControllerOptions } from "./tableViewportTypes";
type LayoutOutput = ColumnLayoutOutput<UiTableColumn>;
export interface TableViewportHorizontalMeta extends HorizontalVirtualizerMeta<UiTableColumn> {
    scrollableColumns: UiTableColumn[];
    scrollableIndices: LayoutOutput["scrollableIndices"];
    metrics: LayoutOutput["scrollableMetrics"];
    pinnedLeft: ColumnLayoutMetric<UiTableColumn>[];
    pinnedRight: ColumnLayoutMetric<UiTableColumn>[];
    indexColumnWidth: number;
    effectiveViewport: number;
    version: number;
    scrollVelocity: number;
}
export interface BuildHorizontalMetaInput {
    columns: UiTableColumn[];
    layoutScale: number;
    resolvePinMode: TableViewportControllerOptions["resolvePinMode"];
    viewportWidth: number;
    cachedNativeScrollWidth: number;
    cachedContainerWidth: number;
    lastScrollDirection: number;
    smoothedHorizontalVelocity: number;
    lastSignature: string;
    version: number;
    scrollWidth?: number;
}
export interface BuildHorizontalMetaResult {
    meta: TableViewportHorizontalMeta;
    version: number;
    signature: string;
}
export declare function buildHorizontalMeta({ columns, layoutScale, resolvePinMode, viewportWidth, cachedNativeScrollWidth, cachedContainerWidth, lastScrollDirection, smoothedHorizontalVelocity, lastSignature, version, scrollWidth, }: BuildHorizontalMetaInput): BuildHorizontalMetaResult;
export {};
//# sourceMappingURL=tableViewportHorizontalMeta.d.ts.map