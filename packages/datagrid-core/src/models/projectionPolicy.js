import { createDataGridDependencyGraph, } from "./dependencyGraph.js";
export const DATAGRID_PROJECTION_CACHE_POLICY_MATRIX = {
    memory: {
        sortValues: {
            enabled: true,
            multiplier: 1.25,
            floor: 256,
        },
        groupValues: {
            enabled: true,
            multiplier: 1,
            floor: 256,
        },
    },
    balanced: {
        sortValues: {
            enabled: true,
            multiplier: 3,
            floor: 1024,
        },
        groupValues: {
            enabled: true,
            multiplier: 4,
            floor: 1024,
        },
    },
    speed: {
        sortValues: {
            enabled: true,
            multiplier: 6,
            floor: 2048,
        },
        groupValues: {
            enabled: true,
            multiplier: 8,
            floor: 2048,
        },
    },
};
function normalizeRowCount(sourceRowCount) {
    return Number.isFinite(sourceRowCount) ? Math.max(0, Math.trunc(sourceRowCount)) : 0;
}
function resolveCacheMaxSize(sourceRowCount, policy) {
    if (!policy.enabled) {
        return 0;
    }
    const boundedCount = normalizeRowCount(sourceRowCount);
    return Math.max(policy.floor, Math.trunc(boundedCount * policy.multiplier));
}
export function resolveDataGridProjectionCachePolicy(mode, sourceRowCount, matrix = DATAGRID_PROJECTION_CACHE_POLICY_MATRIX) {
    const modePolicy = matrix[mode] ?? matrix.balanced;
    return {
        sortValues: {
            enabled: modePolicy.sortValues.enabled,
            maxSize: resolveCacheMaxSize(sourceRowCount, modePolicy.sortValues),
        },
        groupValues: {
            enabled: modePolicy.groupValues.enabled,
            maxSize: resolveCacheMaxSize(sourceRowCount, modePolicy.groupValues),
        },
    };
}
export function createDataGridProjectionPolicy(options = {}) {
    const performanceMode = options.performanceMode ?? "balanced";
    const dependencyGraph = options.dependencyGraph ?? createDataGridDependencyGraph(options.dependencies);
    const modePolicy = DATAGRID_PROJECTION_CACHE_POLICY_MATRIX[performanceMode];
    const resolveCachePolicy = (sourceRowCount) => resolveDataGridProjectionCachePolicy(performanceMode, sourceRowCount);
    return {
        dependencyGraph,
        resolveCachePolicy,
        shouldCacheSortValues: () => modePolicy.sortValues.enabled,
        shouldCacheGroupValues: () => modePolicy.groupValues.enabled,
        maxSortValueCacheSize: (sourceRowCount) => resolveCachePolicy(sourceRowCount).sortValues.maxSize,
        maxGroupValueCacheSize: (sourceRowCount) => resolveCachePolicy(sourceRowCount).groupValues.maxSize,
    };
}
