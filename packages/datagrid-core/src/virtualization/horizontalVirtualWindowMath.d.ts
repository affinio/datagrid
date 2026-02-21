import { type ColumnWidthMetrics } from "./columnSizing";
export interface HorizontalVirtualWindowMathMeta {
    metrics: ColumnWidthMetrics;
    pinnedLeftWidth: number;
    pinnedRightWidth: number;
    containerWidthForColumns: number;
    nativeScrollLimit: number;
    zoom: number;
    buffer: number;
    isRTL?: boolean;
}
export interface HorizontalVirtualWindowPayload {
    visibleStart: number;
    visibleEnd: number;
    leftPadding: number;
    rightPadding: number;
    totalScrollableWidth: number;
    visibleScrollableWidth: number;
    averageWidth: number;
    scrollSpeed: number;
    effectiveViewport: number;
}
export interface ComputeHorizontalVirtualWindowRangeInput {
    offset: number;
    totalCount: number;
    virtualizationEnabled: boolean;
    overscanLeading: number;
    overscanTrailing: number;
    scrollVelocity: number;
    meta: HorizontalVirtualWindowMathMeta;
}
export interface HorizontalVirtualWindowRangeResult {
    start: number;
    end: number;
    payload: HorizontalVirtualWindowPayload;
}
export interface ComputeHorizontalScrollClampInput {
    value: number;
    virtualizationEnabled: boolean;
    overscanLeading: number;
    overscanTrailing: number;
    meta: HorizontalVirtualWindowMathMeta;
}
export declare function resolveHorizontalEffectiveViewport(containerWidth: number, pinnedLeftWidth: number, pinnedRightWidth: number): number;
export declare function computeHorizontalScrollClamp(input: ComputeHorizontalScrollClampInput): number;
export declare function computeHorizontalVirtualWindowRange(input: ComputeHorizontalVirtualWindowRangeInput): HorizontalVirtualWindowRangeResult;
//# sourceMappingURL=horizontalVirtualWindowMath.d.ts.map