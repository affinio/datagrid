export interface VerticalScrollLimitInput {
    estimatedItemSize: number;
    totalCount: number;
    viewportSize: number;
    overscanTrailing: number;
    visibleCount: number;
    nativeScrollLimit?: number | null;
    trailingPadding?: number;
    edgePadding?: number;
}
export declare function computeVerticalScrollLimit(input: VerticalScrollLimitInput): number;
export interface HorizontalScrollLimitInput {
    totalScrollableWidth: number;
    viewportWidth: number;
    pinnedLeftWidth: number;
    pinnedRightWidth: number;
    bufferPx: number;
    trailingGap?: number;
    nativeScrollLimit?: number | null;
    tolerancePx?: number;
}
export declare function computeHorizontalScrollLimit(input: HorizontalScrollLimitInput): number;
export interface ClampScrollInput {
    offset: number;
    limit: number;
}
export declare function clampScrollOffset({ offset, limit }: ClampScrollInput): number;
//# sourceMappingURL=scrollLimits.d.ts.map