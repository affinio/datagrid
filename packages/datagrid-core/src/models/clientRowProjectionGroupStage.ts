import {
  type DataGridAggregationModel,
  type DataGridFilterSnapshot,
  type DataGridGroupBySpec,
  type DataGridGroupExpansionSnapshot,
  type DataGridRowId,
  type DataGridRowNode,
  type DataGridTreeDataDiagnostics,
  type DataGridTreeDataResolvedSpec,
} from "./rowModel.js"
import type { DataGridProjectionPolicy } from "./projectionPolicy.js"
import { buildGroupedRowsProjection } from "./groupProjectionController.js"
import type {
  DataGridIncrementalAggregationGroupState,
  DataGridIncrementalAggregationLeafContribution,
} from "./aggregationEngine.js"
import type {
  TreeParentProjectionCacheState,
  TreePathProjectionCacheState,
  TreeProjectionResult,
} from "./treeProjectionRuntime.js"
import { createEmptyTreeDataDiagnostics } from "./clientRowModelHelpers.js"
import { alwaysMatchesFilter, normalizeLeafRow, normalizeText, readRowField, shouldUseFilteredRowsForTreeSort } from "./clientRowProjectionPrimitives.js"
import { buildGroupRowIndexByRowId, enforceCacheCap, patchProjectedRowsByIdentity, remapRowsByIdentity } from "./clientRowRuntimeUtils.js"

export interface GroupProjectionAggregationEngine<T> {
  setModel: (model: DataGridAggregationModel<T> | null) => void
  isIncrementalAggregationSupported: () => boolean
  createLeafContribution: (row: DataGridRowNode<T>) => DataGridIncrementalAggregationLeafContribution | null
  createEmptyGroupState: () => DataGridIncrementalAggregationGroupState | null
  applyContributionDelta: (
    groupState: DataGridIncrementalAggregationGroupState,
    previous: DataGridIncrementalAggregationLeafContribution | null,
    next: DataGridIncrementalAggregationLeafContribution | null,
  ) => void
  finalizeGroupState: (groupState: DataGridIncrementalAggregationGroupState) => Record<string, unknown>
  computeAggregatesForLeaves: (rows: readonly DataGridRowNode<T>[]) => Record<string, unknown>
}

export interface RunGroupProjectionStageParams<T> {
  shouldRecompute: boolean
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  rowMatchesFilter: (row: DataGridRowNode<T>) => boolean
  treeData: DataGridTreeDataResolvedSpec<T> | null
  pivotModelEnabled: boolean
  groupBy: DataGridGroupBySpec | null
  filterModel: DataGridFilterSnapshot | null
  sourceRows: readonly DataGridRowNode<T>[]
  sortedRowsProjection: readonly DataGridRowNode<T>[]
  filteredRowsProjection: readonly DataGridRowNode<T>[]
  previousGroupedRowsProjection: readonly DataGridRowNode<T>[]
  expansionSnapshot: DataGridGroupExpansionSnapshot
  expansionToggledKeys: ReadonlySet<string>
  treeCacheRevision: number
  rowRevision: number
  groupRevision: number
  filterRevision: number
  sortRevision: number
  projectionPolicy: DataGridProjectionPolicy
  groupValueCache: Map<string, string>
  groupValueCacheKey: string
  groupValueCounters: { hits: number; misses: number }
  treeProjectionRuntime: ReturnType<typeof import("./treeProjectionRuntime.js").createTreeProjectionRuntime<T>>
  treePathProjectionCacheState: TreePathProjectionCacheState<T> | null
  treeParentProjectionCacheState: TreeParentProjectionCacheState<T> | null
  lastTreeProjectionCacheKey: string | null
  lastTreeExpansionSnapshot: DataGridGroupExpansionSnapshot | null
  groupedProjectionGroupIndexByRowId: ReadonlyMap<DataGridRowId, number>
  aggregationModel: DataGridAggregationModel<T> | null
  aggregationEngine: GroupProjectionAggregationEngine<T>
  treeDataDiagnostics: DataGridTreeDataDiagnostics | null
}

export interface RunGroupProjectionStageResult<T> {
  groupedRowsProjection: DataGridRowNode<T>[]
  recomputed: boolean
  groupValueCacheKey: string
  groupValueCounters: { hits: number; misses: number }
  groupedProjectionGroupIndexByRowId: Map<DataGridRowId, number>
  treePathProjectionCacheState: TreePathProjectionCacheState<T> | null
  treeParentProjectionCacheState: TreeParentProjectionCacheState<T> | null
  lastTreeProjectionCacheKey: string | null
  lastTreeExpansionSnapshot: DataGridGroupExpansionSnapshot | null
  treeDataDiagnostics: DataGridTreeDataDiagnostics | null
}

export function runGroupProjectionStage<T>(
  params: RunGroupProjectionStageParams<T>,
): RunGroupProjectionStageResult<T> {
  const nextGroupValueCacheKey = params.groupBy
    ? `${params.rowRevision}:${params.groupRevision}:${params.groupBy.fields.join("|")}`
    : "__none__"
  let groupValueCacheKey = params.groupValueCacheKey
  const groupValueCounters = {
    hits: params.groupValueCounters.hits,
    misses: params.groupValueCounters.misses,
  }
  let groupedRowsProjection = params.previousGroupedRowsProjection as DataGridRowNode<T>[]
  let groupedResult: TreeProjectionResult<T> | null = null
  let recomputedGroupStage = false
  let treePathProjectionCacheState = params.treePathProjectionCacheState
  let treeParentProjectionCacheState = params.treeParentProjectionCacheState
  let lastTreeProjectionCacheKey = params.lastTreeProjectionCacheKey
  let lastTreeExpansionSnapshot = params.lastTreeExpansionSnapshot
  let treeDataDiagnostics = params.treeDataDiagnostics

  if (params.treeData) {
    const treeCacheKey = params.treeProjectionRuntime.buildCacheKey({
      treeCacheRevision: params.treeCacheRevision,
      filterRevision: params.filterRevision,
      sortRevision: params.sortRevision,
      treeData: params.treeData,
    })
    const shouldRecomputeGroup = params.shouldRecompute || params.previousGroupedRowsProjection.length === 0
    if (shouldRecomputeGroup) {
      const aggregationBasis: "filtered" | "source" = params.aggregationModel?.basis === "source"
        ? "source"
        : "filtered"
      let treeRowsForProjection = params.sortedRowsProjection
      let treeRowMatchesFilter = params.rowMatchesFilter
      if (
        params.treeData.mode === "path" &&
        shouldUseFilteredRowsForTreeSort(params.treeData, params.filterModel) &&
        aggregationBasis !== "source"
      ) {
        if (params.sortedRowsProjection.length === params.filteredRowsProjection.length) {
          treeRowMatchesFilter = alwaysMatchesFilter
        } else {
          const filteredSortedRows: DataGridRowNode<T>[] = []
          for (const row of params.sortedRowsProjection) {
            if (!params.rowMatchesFilter(row)) {
              continue
            }
            filteredSortedRows.push(row)
          }
          treeRowsForProjection = filteredSortedRows
          treeRowMatchesFilter = alwaysMatchesFilter
        }
      }
      const hasTreeAggregationModel = Boolean(params.aggregationModel && params.aggregationModel.columns.length > 0)
      if (hasTreeAggregationModel) {
        params.aggregationEngine.setModel(params.aggregationModel)
      }
      const computeTreeAggregates = hasTreeAggregationModel
        ? ((rows: readonly DataGridRowNode<T>[]) => params.aggregationEngine.computeAggregatesForLeaves(rows))
        : undefined
      const supportsIncrementalTreeAggregation = hasTreeAggregationModel
        && params.aggregationEngine.isIncrementalAggregationSupported()
      const createTreeLeafContribution = supportsIncrementalTreeAggregation
        ? ((row: DataGridRowNode<T>) => params.aggregationEngine.createLeafContribution(row))
        : undefined
      const createTreeGroupState = supportsIncrementalTreeAggregation
        ? (() => params.aggregationEngine.createEmptyGroupState())
        : undefined
      const applyTreeContributionDelta = supportsIncrementalTreeAggregation
        ? ((
          groupState: DataGridIncrementalAggregationGroupState,
          previous: DataGridIncrementalAggregationLeafContribution | null,
          next: DataGridIncrementalAggregationLeafContribution | null,
        ) => {
          params.aggregationEngine.applyContributionDelta(groupState, previous, next)
        })
        : undefined
      const finalizeTreeGroupState = supportsIncrementalTreeAggregation
        ? ((groupState: DataGridIncrementalAggregationGroupState) => params.aggregationEngine.finalizeGroupState(groupState))
        : undefined
      if (
        params.shouldRecompute &&
        params.previousGroupedRowsProjection.length > 0 &&
        lastTreeProjectionCacheKey === treeCacheKey &&
        lastTreeExpansionSnapshot
      ) {
        if (params.treeData.mode === "path" && treePathProjectionCacheState?.key === treeCacheKey) {
          groupedResult = params.treeProjectionRuntime.tryProjectPathSubtreeToggle({
            rows: params.previousGroupedRowsProjection,
            cacheState: treePathProjectionCacheState,
            treeData: params.treeData,
            previousExpansionSnapshot: lastTreeExpansionSnapshot,
            nextExpansionSnapshot: params.expansionSnapshot,
            groupIndexByRowId: params.groupedProjectionGroupIndexByRowId,
          })
        } else if (params.treeData.mode === "parent" && treeParentProjectionCacheState?.key === treeCacheKey) {
          groupedResult = params.treeProjectionRuntime.tryProjectParentSubtreeToggle({
            rows: params.previousGroupedRowsProjection,
            cacheState: treeParentProjectionCacheState,
            previousExpansionSnapshot: lastTreeExpansionSnapshot,
            nextExpansionSnapshot: params.expansionSnapshot,
            groupIndexByRowId: params.groupedProjectionGroupIndexByRowId,
          })
        }
      }
      if (!groupedResult) {
        try {
          const projected = params.treeProjectionRuntime.projectRowsFromCache({
            inputRows: treeRowsForProjection,
            treeData: params.treeData,
            expansionSnapshot: params.expansionSnapshot,
            expansionToggledKeys: params.expansionToggledKeys,
            rowMatchesFilter: treeRowMatchesFilter,
            pathCacheState: treePathProjectionCacheState,
            parentCacheState: treeParentProjectionCacheState,
            cacheKey: treeCacheKey,
            computeAggregates: computeTreeAggregates,
            aggregationBasis,
            createLeafContribution: createTreeLeafContribution,
            createEmptyGroupState: createTreeGroupState,
            applyContributionDelta: applyTreeContributionDelta,
            finalizeGroupState: finalizeTreeGroupState,
          })
          groupedResult = projected.result
          treePathProjectionCacheState = projected.pathCache
          treeParentProjectionCacheState = projected.parentCache
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          treeDataDiagnostics = createEmptyTreeDataDiagnostics({
            duplicates: treeDataDiagnostics?.duplicates ?? 0,
            lastError: message,
          })
          throw error
        }
      }
      groupedRowsProjection = groupedResult.rows
      lastTreeProjectionCacheKey = treeCacheKey
      lastTreeExpansionSnapshot = params.expansionSnapshot
      recomputedGroupStage = true
    } else {
      groupedRowsProjection = patchProjectedRowsByIdentity(params.previousGroupedRowsProjection, params.sourceById)
    }
    if (shouldRecomputeGroup || groupedResult) {
      treeDataDiagnostics = createEmptyTreeDataDiagnostics({
        duplicates: 0,
        lastError: null,
        orphans: groupedResult?.diagnostics.orphans ?? 0,
        cycles: groupedResult?.diagnostics.cycles ?? 0,
      })
    }
  } else if (params.pivotModelEnabled) {
    const shouldRecomputeGroup = params.shouldRecompute || params.previousGroupedRowsProjection.length === 0
    if (shouldRecomputeGroup) {
      groupedRowsProjection = params.filteredRowsProjection as DataGridRowNode<T>[]
      recomputedGroupStage = true
    } else {
      groupedRowsProjection = remapRowsByIdentity(params.previousGroupedRowsProjection, params.sourceById)
    }
  } else if (params.groupBy) {
    const shouldRecomputeGroup = params.shouldRecompute || params.previousGroupedRowsProjection.length === 0
    if (shouldRecomputeGroup) {
      const shouldCacheGroupValues = params.projectionPolicy.shouldCacheGroupValues()
      const maxGroupValueCacheSize = params.projectionPolicy.maxGroupValueCacheSize(params.sourceRows.length)
      if (nextGroupValueCacheKey !== groupValueCacheKey) {
        params.groupValueCache.clear()
        groupValueCacheKey = nextGroupValueCacheKey
      }
      if (!shouldCacheGroupValues || maxGroupValueCacheSize <= 0) {
        params.groupValueCache.clear()
      }
      groupedRowsProjection = buildGroupedRowsProjection({
        inputRows: params.sortedRowsProjection,
        groupBy: params.groupBy,
        expansionSnapshot: params.expansionSnapshot,
        readRowField: (row, key, field) => readRowField(row, key, field),
        normalizeText,
        normalizeLeafRow,
        groupValueCache: shouldCacheGroupValues && maxGroupValueCacheSize > 0
          ? params.groupValueCache
          : undefined,
        groupValueCounters: shouldCacheGroupValues && maxGroupValueCacheSize > 0
          ? groupValueCounters
          : undefined,
        maxGroupValueCacheSize: shouldCacheGroupValues && maxGroupValueCacheSize > 0
          ? maxGroupValueCacheSize
          : undefined,
      })
      if (shouldCacheGroupValues) {
        enforceCacheCap(params.groupValueCache, maxGroupValueCacheSize)
      }
      recomputedGroupStage = true
    } else {
      groupedRowsProjection = patchProjectedRowsByIdentity(params.previousGroupedRowsProjection, params.sourceById)
    }
  } else {
    groupedRowsProjection = params.sortedRowsProjection as DataGridRowNode<T>[]
    recomputedGroupStage = params.shouldRecompute
  }

  return {
    groupedRowsProjection,
    recomputed: recomputedGroupStage,
    groupValueCacheKey,
    groupValueCounters,
    groupedProjectionGroupIndexByRowId: recomputedGroupStage
      ? buildGroupRowIndexByRowId(groupedRowsProjection)
      : new Map(params.groupedProjectionGroupIndexByRowId),
    treePathProjectionCacheState,
    treeParentProjectionCacheState,
    lastTreeProjectionCacheKey,
    lastTreeExpansionSnapshot,
    treeDataDiagnostics,
  }
}
