import type { DataGridViewportRange } from "../models/rowModel";
export interface DataGridViewportRowHeightMeasurement {
    index: number;
    height: number;
}
export interface DataGridViewportRowHeightCacheSnapshot {
    size: number;
    limit: number;
    average: number;
    min: number;
    max: number;
}
export interface DataGridViewportRowHeightCache {
    readonly limit: number;
    clear(): void;
    deleteRange(range: DataGridViewportRange | null | undefined): void;
    ingest(measurements: readonly DataGridViewportRowHeightMeasurement[]): boolean;
    resolveEstimatedHeight(fallback: number): number;
    getSnapshot(): DataGridViewportRowHeightCacheSnapshot;
}
export interface CreateDataGridViewportRowHeightCacheOptions {
    limit?: number;
}
export declare function createDataGridViewportRowHeightCache(options?: CreateDataGridViewportRowHeightCacheOptions): DataGridViewportRowHeightCache;
//# sourceMappingURL=dataGridViewportRowHeightCache.d.ts.map