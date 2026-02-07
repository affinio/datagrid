import { type AxisVirtualizerStrategy } from "./axisVirtualizer";
export interface VerticalVirtualizerMeta {
    zoom: number;
    scrollDirection?: number;
    nativeScrollLimit?: number | null;
    debug?: boolean;
    debugNativeScrollLimit?: number | null;
}
export type VerticalVirtualizerPayload = undefined;
export declare function createVerticalAxisStrategy(): AxisVirtualizerStrategy<VerticalVirtualizerMeta, VerticalVirtualizerPayload>;
export declare function createVerticalAxisVirtualizer(): import("./axisVirtualizer").AxisVirtualizer<VerticalVirtualizerMeta, undefined>;
//# sourceMappingURL=verticalVirtualizer.d.ts.map