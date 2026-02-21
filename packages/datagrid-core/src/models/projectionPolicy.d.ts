import { type DataGridDependencyGraph, type DataGridFieldDependency } from "./dependencyGraph.js";
export type DataGridClientPerformanceMode = "balanced" | "memory" | "speed";
export interface DataGridProjectionCacheBucketPolicy {
    enabled: boolean;
    multiplier: number;
    floor: number;
}
export interface DataGridProjectionModeCachePolicy {
    sortValues: DataGridProjectionCacheBucketPolicy;
    groupValues: DataGridProjectionCacheBucketPolicy;
}
export type DataGridProjectionCachePolicyMatrix = Record<DataGridClientPerformanceMode, DataGridProjectionModeCachePolicy>;
export interface DataGridResolvedProjectionCachePolicy {
    sortValues: {
        enabled: boolean;
        maxSize: number;
    };
    groupValues: {
        enabled: boolean;
        maxSize: number;
    };
}
export interface DataGridProjectionPolicy {
    dependencyGraph: DataGridDependencyGraph;
    resolveCachePolicy?: (sourceRowCount: number) => DataGridResolvedProjectionCachePolicy;
    shouldCacheSortValues: () => boolean;
    shouldCacheGroupValues: () => boolean;
    maxSortValueCacheSize: (sourceRowCount: number) => number;
    maxGroupValueCacheSize: (sourceRowCount: number) => number;
}
export interface CreateDataGridProjectionPolicyOptions {
    performanceMode?: DataGridClientPerformanceMode;
    dependencyGraph?: DataGridDependencyGraph;
    dependencies?: readonly DataGridFieldDependency[];
}
export declare const DATAGRID_PROJECTION_CACHE_POLICY_MATRIX: DataGridProjectionCachePolicyMatrix;
export declare function resolveDataGridProjectionCachePolicy(mode: DataGridClientPerformanceMode, sourceRowCount: number, matrix?: DataGridProjectionCachePolicyMatrix): DataGridResolvedProjectionCachePolicy;
export declare function createDataGridProjectionPolicy(options?: CreateDataGridProjectionPolicyOptions): DataGridProjectionPolicy;
//# sourceMappingURL=projectionPolicy.d.ts.map