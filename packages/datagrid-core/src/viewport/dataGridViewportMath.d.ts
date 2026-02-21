import type { HorizontalClampContext } from "./dataGridViewportHorizontalClamp";
import type { DataGridViewportHorizontalMeta } from "./dataGridViewportHorizontalMeta";
import type { LayoutMeasurementSnapshot, ViewportMetricsSnapshot } from "./dataGridViewportTypes";
export interface ResolveViewportDimensionsInput {
    viewportMetrics: ViewportMetricsSnapshot | null;
    layoutMeasurement: LayoutMeasurementSnapshot | null;
    cachedContainerHeight: number;
    cachedContainerWidth: number;
    cachedHeaderHeight: number;
    resolvedRowHeight: number;
    fallbackColumnWidth: number;
}
export interface ViewportDimensionsResolution {
    containerHeight: number;
    containerWidth: number;
    headerHeight: number;
    viewportHeight: number;
    viewportWidth: number;
}
export interface ResolvePendingScrollInput {
    pendingScrollTopRequest: number | null;
    pendingScrollLeftRequest: number | null;
    measuredScrollTop: number | null | undefined;
    measuredScrollLeft: number | null | undefined;
    lastScrollTopSample: number;
    lastScrollLeftSample: number;
}
export interface PendingScrollResolution {
    fallbackScrollTop: number;
    fallbackScrollLeft: number;
    pendingTop: number;
    pendingLeft: number;
    measuredScrollTopFromPending: boolean;
    measuredScrollLeftFromPending: boolean;
    hadPendingScrollTop: boolean;
    hadPendingScrollLeft: boolean;
}
export interface ShouldUseFastPathInput {
    force: boolean;
    pendingHorizontalSettle: boolean;
    measuredScrollTopFromPending: boolean;
    measuredScrollLeftFromPending: boolean;
    hadPendingScrollTop: boolean;
    hadPendingScrollLeft: boolean;
    scrollTopDelta: number;
    scrollLeftDelta: number;
    verticalScrollEpsilon: number;
    horizontalScrollEpsilon: number;
}
export interface HorizontalSizingInput {
    columnMeta: DataGridViewportHorizontalMeta;
    viewportWidth: number;
}
export interface HorizontalSizingResolution {
    averageColumnWidth: number;
    contentWidthEstimate: number;
    horizontalClampContext: HorizontalClampContext;
}
export interface NearBottomCheckInput {
    nextScrollTop: number;
    totalContentHeight: number;
    viewportHeight: number;
    totalRowCount: number;
    loading: boolean;
}
export declare function resolveViewportDimensions(input: ResolveViewportDimensionsInput): ViewportDimensionsResolution;
export declare function resolvePendingScroll(input: ResolvePendingScrollInput): PendingScrollResolution;
export declare function shouldUseFastPath(input: ShouldUseFastPathInput): boolean;
export declare function resolveHorizontalSizing(input: HorizontalSizingInput): HorizontalSizingResolution;
export declare function computePinnedWidth(entries: readonly {
    width: number;
}[]): number;
export declare function shouldNotifyNearBottom(input: NearBottomCheckInput): boolean;
//# sourceMappingURL=dataGridViewportMath.d.ts.map