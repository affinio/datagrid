export interface HorizontalClampContext {
    totalScrollableWidth: number;
    containerWidthForColumns: number;
    pinnedLeftWidth: number;
    pinnedRightWidth: number;
    averageColumnWidth: number;
    nativeScrollLimit: number | null;
    virtualizationEnabled: boolean;
    bufferColumns?: number;
}
export interface HorizontalClampResult {
    normalized: number;
    maxScroll: number;
    effectiveViewport: number;
    trailingGap: number;
    nativeLimit: number;
    bufferPx: number;
}
export declare function clampHorizontalOffset(requestedOffset: number, context: HorizontalClampContext): HorizontalClampResult;
//# sourceMappingURL=tableViewportHorizontalClamp.d.ts.map