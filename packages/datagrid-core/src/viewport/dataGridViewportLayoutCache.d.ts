import type { DataGridViewportContainerMetrics, DataGridViewportHeaderMetrics } from "./viewportHostEnvironment";
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
    updateContainer(metrics: DataGridViewportContainerMetrics | null, rect: DOMRect | null): void;
    updateHeader(metrics: DataGridViewportHeaderMetrics | null): void;
    updateContentDimensions(width: number, height: number): void;
    reset(): void;
}
export declare function createLayoutMeasurementCache(): LayoutMeasurementCache;
//# sourceMappingURL=dataGridViewportLayoutCache.d.ts.map