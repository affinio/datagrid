import {
  createDataGridDependencyGraph,
  type DataGridDependencyGraph,
  type DataGridFieldDependency,
} from "../dependency/dependencyGraph.js"
import {
  DATAGRID_PROJECTION_CACHE_POLICY_MATRIX,
  resolveCacheMaxSize,
  resolveStageBucketPolicy,
  resolveDataGridProjectionCachePolicy,
  type DataGridClientPerformanceMode,
  type DataGridProjectionCacheStage,
  type DataGridResolvedProjectionCachePolicy,
} from "./projectionCachePolicy.js"

export {
  DATAGRID_PROJECTION_CACHE_POLICY_MATRIX,
  createDataGridSortValueCachePolicy,
  resolveDataGridProjectionCachePolicy,
} from "./projectionCachePolicy.js"
export type {
  DataGridClientPerformanceMode,
  DataGridProjectionCacheBucketPolicy,
  DataGridProjectionCachePolicyMatrix,
  DataGridProjectionCacheStage,
  DataGridProjectionModeCachePolicy,
  DataGridResolvedProjectionCachePolicy,
  DataGridSortValueCachePolicy,
} from "./projectionCachePolicy.js"

export interface DataGridProjectionPolicy {
  dependencyGraph: DataGridDependencyGraph
  resolveCachePolicy?: (sourceRowCount: number) => DataGridResolvedProjectionCachePolicy
  shouldCacheStage: (stage: DataGridProjectionCacheStage) => boolean
  maxStageCacheSize: (stage: DataGridProjectionCacheStage, sourceRowCount: number) => number
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

export function createDataGridProjectionPolicy(
  options: CreateDataGridProjectionPolicyOptions = {},
): DataGridProjectionPolicy {
  const performanceMode = options.performanceMode ?? "balanced"
  const dependencyGraph = options.dependencyGraph ?? createDataGridDependencyGraph(options.dependencies)
  const modePolicy = DATAGRID_PROJECTION_CACHE_POLICY_MATRIX[performanceMode]
  const resolveCachePolicy = (sourceRowCount: number): DataGridResolvedProjectionCachePolicy =>
    resolveDataGridProjectionCachePolicy(performanceMode, sourceRowCount)
  const shouldCacheStage = (stage: DataGridProjectionCacheStage): boolean =>
    resolveStageBucketPolicy(modePolicy, stage).enabled
  const maxStageCacheSize = (
    stage: DataGridProjectionCacheStage,
    sourceRowCount: number,
  ): number => resolveCacheMaxSize(sourceRowCount, resolveStageBucketPolicy(modePolicy, stage))

  return {
    dependencyGraph,
    resolveCachePolicy,
    shouldCacheStage,
    maxStageCacheSize,
    shouldCacheSortValues: () => shouldCacheStage("sort"),
    shouldCacheGroupValues: () => shouldCacheStage("group"),
    maxSortValueCacheSize: (sourceRowCount: number) => maxStageCacheSize("sort", sourceRowCount),
    maxGroupValueCacheSize: (sourceRowCount: number) => maxStageCacheSize("group", sourceRowCount),
  }
}
