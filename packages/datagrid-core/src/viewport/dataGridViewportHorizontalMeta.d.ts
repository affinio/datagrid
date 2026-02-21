import type { DataGridColumn } from "../types";
import { type ColumnLayoutMetric, type ColumnLayoutOutput } from "../virtualization/horizontalLayout";
import type { HorizontalVirtualizerMeta } from "../virtualization/horizontalVirtualizer";
import type { DataGridViewportControllerOptions } from "./dataGridViewportTypes";
type LayoutOutput = ColumnLayoutOutput<DataGridColumn>;
export interface DataGridViewportHorizontalMeta extends HorizontalVirtualizerMeta<DataGridColumn> {
    scrollableColumns: DataGridColumn[];
    scrollableIndices: LayoutOutput["scrollableIndices"];
    metrics: LayoutOutput["scrollableMetrics"];
    pinnedLeft: ColumnLayoutMetric<DataGridColumn>[];
    pinnedRight: ColumnLayoutMetric<DataGridColumn>[];
    indexColumnWidth: number;
    effectiveViewport: number;
    version: number;
    scrollVelocity: number;
}
export interface BuildHorizontalMetaInput {
    columns: DataGridColumn[];
    layoutScale: number;
    resolvePinMode: DataGridViewportControllerOptions["resolvePinMode"];
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
    meta: DataGridViewportHorizontalMeta;
    version: number;
    signature: string;
}
export declare function buildHorizontalMeta({ columns, layoutScale, resolvePinMode, viewportWidth, cachedNativeScrollWidth, cachedContainerWidth, lastScrollDirection, smoothedHorizontalVelocity, lastSignature, version, scrollWidth, }: BuildHorizontalMetaInput): BuildHorizontalMetaResult;
export {};
//# sourceMappingURL=dataGridViewportHorizontalMeta.d.ts.map