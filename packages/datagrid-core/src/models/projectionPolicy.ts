import {
  createDataGridDependencyGraph,
  type DataGridDependencyGraph,
  type DataGridFieldDependency,
} from "./dependencyGraph.js"

export type DataGridClientPerformanceMode = "balanced" | "memory" | "speed"

export interface DataGridProjectionCacheBucketPolicy {
  enabled: boolean
  multiplier: number
  floor: number
}

export interface DataGridProjectionModeCachePolicy {
  sortValues: DataGridProjectionCacheBucketPolicy
  groupValues: DataGridProjectionCacheBucketPolicy
}

export type DataGridProjectionCachePolicyMatrix = Record<
  DataGridClientPerformanceMode,
  DataGridProjectionModeCachePolicy
>

export interface DataGridResolvedProjectionCachePolicy {
  sortValues: {
    enabled: boolean
    maxSize: number
  }
  groupValues: {
    enabled: boolean
    maxSize: number
  }
}

export interface DataGridProjectionPolicy {
  dependencyGraph: DataGridDependencyGraph
  resolveCachePolicy?: (sourceRowCount: number) => DataGridResolvedProjectionCachePolicy
  shouldCacheSortValues: () => boolean
  shouldCacheGroupValues: () => boolean
  maxSortValueCacheSize: (sourceRowCount: number) => number
  maxGroupValueCacheSize: (sourceRowCount: number) => number
}

export interface CreateDataGridProjectionPolicyOptions {
  performanceMode?: DataGridClientPerformanceMode
  dependencyGraph?: DataGridDependencyGraph
  dependencies?: readonly DataGridFieldDependency[]
}

export const DATAGRID_PROJECTION_CACHE_POLICY_MATRIX: DataGridProjectionCachePolicyMatrix = {
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
      floor: 1_024,
    },
    groupValues: {
      enabled: true,
      multiplier: 4,
      floor: 1_024,
    },
  },
  speed: {
    sortValues: {
      enabled: true,
      multiplier: 6,
      floor: 2_048,
    },
    groupValues: {
      enabled: true,
      multiplier: 8,
      floor: 2_048,
    },
  },
}

function normalizeRowCount(sourceRowCount: number): number {
  return Number.isFinite(sourceRowCount) ? Math.max(0, Math.trunc(sourceRowCount)) : 0
}

function resolveCacheMaxSize(sourceRowCount: number, policy: DataGridProjectionCacheBucketPolicy): number {
  if (!policy.enabled) {
    return 0
  }
  const boundedCount = normalizeRowCount(sourceRowCount)
  return Math.max(policy.floor, Math.trunc(boundedCount * policy.multiplier))
}

export function resolveDataGridProjectionCachePolicy(
  mode: DataGridClientPerformanceMode,
  sourceRowCount: number,
  matrix: DataGridProjectionCachePolicyMatrix = DATAGRID_PROJECTION_CACHE_POLICY_MATRIX,
): DataGridResolvedProjectionCachePolicy {
  const modePolicy = matrix[mode] ?? matrix.balanced
  return {
    sortValues: {
      enabled: modePolicy.sortValues.enabled,
      maxSize: resolveCacheMaxSize(sourceRowCount, modePolicy.sortValues),
    },
    groupValues: {
      enabled: modePolicy.groupValues.enabled,
      maxSize: resolveCacheMaxSize(sourceRowCount, modePolicy.groupValues),
    },
  }
}

export function createDataGridProjectionPolicy(
  options: CreateDataGridProjectionPolicyOptions = {},
): DataGridProjectionPolicy {
  const performanceMode = options.performanceMode ?? "balanced"
  const dependencyGraph = options.dependencyGraph ?? createDataGridDependencyGraph(options.dependencies)
  const modePolicy = DATAGRID_PROJECTION_CACHE_POLICY_MATRIX[performanceMode]
  const resolveCachePolicy = (sourceRowCount: number): DataGridResolvedProjectionCachePolicy =>
    resolveDataGridProjectionCachePolicy(performanceMode, sourceRowCount)

  return {
    dependencyGraph,
    resolveCachePolicy,
    shouldCacheSortValues: () => modePolicy.sortValues.enabled,
    shouldCacheGroupValues: () => modePolicy.groupValues.enabled,
    maxSortValueCacheSize: (sourceRowCount: number) => resolveCachePolicy(sourceRowCount).sortValues.maxSize,
    maxGroupValueCacheSize: (sourceRowCount: number) => resolveCachePolicy(sourceRowCount).groupValues.maxSize,
  }
}
