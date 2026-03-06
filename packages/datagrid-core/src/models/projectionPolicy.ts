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

export type DataGridProjectionCacheStage =
  | "compute"
  | "filter"
  | "sort"
  | "group"
  | "pivot"
  | "aggregate"

export interface DataGridProjectionModeCachePolicy {
  sortValues: DataGridProjectionCacheBucketPolicy
  groupValues: DataGridProjectionCacheBucketPolicy
  stages?: Partial<Record<DataGridProjectionCacheStage, DataGridProjectionCacheBucketPolicy>>
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
  stages: Record<DataGridProjectionCacheStage, {
    enabled: boolean
    maxSize: number
  }>
}

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
    stages: {
      compute: {
        enabled: true,
        multiplier: 1.25,
        floor: 256,
      },
      filter: {
        enabled: true,
        multiplier: 1.25,
        floor: 256,
      },
      sort: {
        enabled: true,
        multiplier: 1.25,
        floor: 256,
      },
      group: {
        enabled: true,
        multiplier: 1,
        floor: 256,
      },
      pivot: {
        enabled: true,
        multiplier: 1,
        floor: 256,
      },
      aggregate: {
        enabled: true,
        multiplier: 1,
        floor: 256,
      },
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
    stages: {
      compute: {
        enabled: true,
        multiplier: 2,
        floor: 1_024,
      },
      filter: {
        enabled: true,
        multiplier: 2,
        floor: 1_024,
      },
      sort: {
        enabled: true,
        multiplier: 3,
        floor: 1_024,
      },
      group: {
        enabled: true,
        multiplier: 4,
        floor: 1_024,
      },
      pivot: {
        enabled: true,
        multiplier: 3,
        floor: 1_024,
      },
      aggregate: {
        enabled: true,
        multiplier: 3,
        floor: 1_024,
      },
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
    stages: {
      compute: {
        enabled: true,
        multiplier: 4,
        floor: 2_048,
      },
      filter: {
        enabled: true,
        multiplier: 4,
        floor: 2_048,
      },
      sort: {
        enabled: true,
        multiplier: 6,
        floor: 2_048,
      },
      group: {
        enabled: true,
        multiplier: 8,
        floor: 2_048,
      },
      pivot: {
        enabled: true,
        multiplier: 6,
        floor: 2_048,
      },
      aggregate: {
        enabled: true,
        multiplier: 6,
        floor: 2_048,
      },
    },
  },
}

const DATAGRID_PROJECTION_CACHE_STAGES: readonly DataGridProjectionCacheStage[] = [
  "compute",
  "filter",
  "sort",
  "group",
  "pivot",
  "aggregate",
]

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

function resolveStageBucketPolicy(
  modePolicy: DataGridProjectionModeCachePolicy,
  stage: DataGridProjectionCacheStage,
): DataGridProjectionCacheBucketPolicy {
  const stagePolicy = modePolicy.stages?.[stage]
  if (stagePolicy) {
    return stagePolicy
  }
  if (stage === "compute" || stage === "sort" || stage === "filter") {
    return modePolicy.sortValues
  }
  return modePolicy.groupValues
}

export function resolveDataGridProjectionCachePolicy(
  mode: DataGridClientPerformanceMode,
  sourceRowCount: number,
  matrix: DataGridProjectionCachePolicyMatrix = DATAGRID_PROJECTION_CACHE_POLICY_MATRIX,
): DataGridResolvedProjectionCachePolicy {
  const modePolicy = matrix[mode] ?? matrix.balanced
  const stages = Object.create(null) as Record<DataGridProjectionCacheStage, { enabled: boolean; maxSize: number }>
  for (const stage of DATAGRID_PROJECTION_CACHE_STAGES) {
    const policy = resolveStageBucketPolicy(modePolicy, stage)
    stages[stage] = {
      enabled: policy.enabled,
      maxSize: resolveCacheMaxSize(sourceRowCount, policy),
    }
  }
  return {
    sortValues: {
      enabled: modePolicy.sortValues.enabled,
      maxSize: resolveCacheMaxSize(sourceRowCount, modePolicy.sortValues),
    },
    groupValues: {
      enabled: modePolicy.groupValues.enabled,
      maxSize: resolveCacheMaxSize(sourceRowCount, modePolicy.groupValues),
    },
    stages,
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
