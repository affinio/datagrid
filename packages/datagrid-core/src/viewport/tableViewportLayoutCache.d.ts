import type { TableViewportContainerMetrics, TableViewportHeaderMetrics } from "./viewportHostEnvironment";
export interface LayoutViewportRect {
    top: number;
    left: number;
    width: number;
    height: number;
}
export interface LayoutMeasurementSnapshot {
    version: number;
    containerWidth: number;
    containerHeight: number;
    headerHeight: number;
    scrollWidth: number;
    scrollHeight: number;
    scrollTop: number;
    scrollLeft: number;
    contentWidth: number;
    contentHeight: number;
    viewportRect: LayoutViewportRect;
}
export interface LayoutMeasurementCache {
    snapshot(): LayoutMeasurementSnapshot;
    updateContainer(metrics: TableViewportContainerMetrics | null, rect: DOMRect | null): void;
    updateHeader(metrics: TableViewportHeaderMetrics | null): void;
    updateContentDimensions(width: number, height: number): void;
    reset(): void;
}
export declare function createLayoutMeasurementCache(): LayoutMeasurementCache;
//# sourceMappingURL=tableViewportLayoutCache.d.ts.map