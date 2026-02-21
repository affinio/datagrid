import { type ColumnSizeLike } from "./columnSizing";
import { type AxisVirtualizerStrategy } from "./axisVirtualizer";
export interface HorizontalVirtualizerMeta<TColumn extends ColumnSizeLike> {
    scrollableColumns: readonly TColumn[];
    scrollableIndices: readonly number[];
    metrics: {
        widths: number[];
        offsets: number[];
        totalWidth: number;
    };
    pinnedLeftWidth: number;
    pinnedRightWidth: number;
    containerWidthForColumns: number;
    nativeScrollLimit: number;
    zoom: number;
    buffer: number;
    scrollDirection: number;
    scrollVelocity?: number;
    isRTL?: boolean;
    version?: number;
}
export interface HorizontalVirtualizerPayload {
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
export declare function createHorizontalAxisStrategy<TColumn extends ColumnSizeLike>(): AxisVirtualizerStrategy<HorizontalVirtualizerMeta<TColumn>, HorizontalVirtualizerPayload>;
export declare function createHorizontalAxisVirtualizer<TColumn extends ColumnSizeLike>(): import("./axisVirtualizer").AxisVirtualizer<HorizontalVirtualizerMeta<TColumn>, HorizontalVirtualizerPayload>;
//# sourceMappingURL=horizontalVirtualizer.d.ts.map