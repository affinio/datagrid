import {
  buildGroupExpansionSnapshot,
  buildPaginationSnapshot,
  cloneGroupBySpec,
  clonePivotSpec,
  isSameGroupExpansionSnapshot,
  isSameGroupBySpec,
  isSamePivotSpec,
  normalizeRowNode,
  normalizeGroupBySpec,
  normalizePivotSpec,
  normalizePaginationInput,
  normalizeTreeDataSpec,
  normalizeViewportRange,
  setGroupExpansionKey,
  toggleGroupExpansionKey,
  withResolvedRowIdentity,
  type DataGridGroupExpansionSnapshot,
  type DataGridPaginationInput,
  type DataGridProjectionDiagnostics,
  type DataGridColumnHistogram,
  type DataGridColumnHistogramOptions,
  type DataGridFilterSnapshot,
  type DataGridSortAndFilterModelInput,
  type DataGridAggregationModel,
  type DataGridGroupBySpec,
  type DataGridPivotColumn,
  type DataGridPivotSpec,
  type DataGridRowId,
  type DataGridRowIdResolver,
  type DataGridRowNode,
  type DataGridRowNodeInput,
  type DataGridRowModel,
  type DataGridRowModelListener,
  type DataGridRowModelRefreshReason,
  type DataGridRowModelSnapshot,
  type DataGridSortState,
  type DataGridTreeDataDiagnostics,
  type DataGridTreeDataResolvedSpec,
  type DataGridTreeDataSpec,
  type DataGridViewportRange,
} from "./rowModel.js"
import {
  createClientRowProjectionEngine,
  type DataGridClientProjectionFinalizeMeta,
  type DataGridClientProjectionStage,
  type DataGridClientProjectionStageHandlers,
  expandClientProjectionStages,
} from "./clientRowProjectionEngine.js"
import { createClientRowProjectionOrchestrator } from "./clientRowProjectionOrchestrator.js"
import { DATAGRID_CLIENT_ALL_PROJECTION_STAGES } from "./projectionStages.js"
import { buildGroupedRowsProjection } from "./groupProjectionController.js"
import {
  createDataGridAggregationEngine,
  type DataGridIncrementalAggregationGroupState,
  type DataGridIncrementalAggregationLeafContribution,
} from "./aggregationEngine.js"
import {
  cloneDataGridFilterSnapshot as cloneFilterSnapshot,
} from "./advancedFilter.js"
import {
  analyzeRowPatchChangeSet,
  collectAggregationModelFields,
  buildPatchProjectionExecutionPlan,
  collectFilterModelFields,
  collectGroupByFields,
  collectPivotModelFields,
  collectSortModelFields,
  collectTreeDataDependencyFields,
} from "./rowPatchAnalyzer.js"
import {
  createDataGridProjectionPolicy,
  type DataGridClientPerformanceMode,
  type DataGridProjectionPolicy,
} from "./projectionPolicy.js"
import { createClientRowRuntimeStateStore } from "./clientRowRuntimeStateStore.js"
import { createClientRowLifecycle } from "./clientRowLifecycle.js"
import { createPivotRuntime } from "./pivotRuntime.js"
import {
  areSameAggregateRecords,
  cloneAggregationModel,
  computeGroupByAggregatesMap,
  createEmptyTreeDataDiagnostics,
  findDuplicateRowIds,
  isSameAggregationModel,
  patchGroupRowsAggregatesByGroupKey,
} from "./clientRowModelHelpers.js"
import {
  createTreeProjectionRuntime,
  type TreeParentProjectionCacheState,
  type TreePathProjectionCacheState,
  type TreeProjectionResult,
} from "./treeProjectionRuntime.js"
import {
  applyIncrementalAggregationPatch as applyIncrementalAggregationPatchRuntime,
  computeGroupByIncrementalAggregation,
  createGroupByIncrementalAggregationState,
  resetGroupByIncrementalAggregationState as resetGroupByIncrementalAggregationStateRuntime,
} from "./incrementalAggregationRuntime.js"
import {
  alwaysMatchesFilter,
  buildColumnHistogram,
  createFilterPredicate,
  hasActiveFilterModel,
  isSameFilterModel,
  isSameSortModel,
  normalizeLeafRow,
  normalizeText,
  readRowField,
  serializeSortValueModelForCache,
  shouldUseFilteredRowsForTreeSort,
  sortLeafRows,
} from "./clientRowProjectionPrimitives.js"
import {
  applyRowDataPatch,
  assignDisplayIndexes,
  buildGroupRowIndexByRowId,
  buildRowIdIndex,
  bumpRowVersions,
  createRowVersionIndex,
  enforceCacheCap,
  mergeRowPatch,
  patchProjectedRowsByIdentity,
  preserveRowOrder,
  pruneSortCacheRows,
  rebuildRowVersionIndex,
  reindexSourceRows,
  remapRowsByIdentity,
} from "./clientRowRuntimeUtils.js"
import type { DataGridFieldDependency } from "./dependencyGraph.js"

export interface CreateClientRowModelOptions<T> {
  rows?: readonly DataGridRowNodeInput<T>[]
  resolveRowId?: DataGridRowIdResolver<T>
  initialTreeData?: DataGridTreeDataSpec<T> | null
  initialSortModel?: readonly DataGridSortState[]
  initialFilterModel?: DataGridFilterSnapshot | null
  initialGroupBy?: DataGridGroupBySpec | null
  initialPivotModel?: DataGridPivotSpec | null
  initialAggregationModel?: DataGridAggregationModel<T> | null
  initialPagination?: DataGridPaginationInput | null
  performanceMode?: DataGridClientPerformanceMode
  projectionPolicy?: DataGridProjectionPolicy
  fieldDependencies?: readonly DataGridFieldDependency[]
}

export interface DataGridClientRowReorderInput {
  fromIndex: number
  toIndex: number
  count?: number
}

export interface DataGridClientRowPatch<T = unknown> {
  rowId: DataGridRowId
  data: Partial<T>
}

export interface DataGridClientRowPatchOptions {
  /**
   * `false` by default for Excel-like edit flow: keep current projection order
   * until explicit reapply (`refresh`) or recompute-enabled patch.
   */
  recomputeSort?: boolean
  /**
   * `false` by default for Excel-like edit flow: keep current filter membership
   * until explicit reapply (`refresh`) or recompute-enabled patch.
   */
  recomputeFilter?: boolean
  /**
   * `false` by default for Excel-like edit flow: keep current grouping/aggregation
   * and pivot layout until explicit reapply (`refresh`) or recompute-enabled patch.
   */
  recomputeGroup?: boolean
  emit?: boolean
}

export interface ClientRowModel<T> extends DataGridRowModel<T> {
  setRows(rows: readonly DataGridRowNodeInput<T>[]): void
  setSortAndFilterModel(input: DataGridSortAndFilterModelInput): void
  getColumnHistogram(columnId: string, options?: DataGridColumnHistogramOptions): DataGridColumnHistogram
  patchRows(
    updates: readonly DataGridClientRowPatch<T>[],
    options?: DataGridClientRowPatchOptions,
  ): void
  reorderRows(input: DataGridClientRowReorderInput): boolean
  getDerivedCacheDiagnostics(): DataGridClientRowModelDerivedCacheDiagnostics
}

export interface DataGridClientRowModelDerivedCacheDiagnostics {
  revisions: {
    row: number
    sort: number
    filter: number
    group: number
  }
  filterPredicateHits: number
  filterPredicateMisses: number
  sortValueHits: number
  sortValueMisses: number
  groupValueHits: number
  groupValueMisses: number
}

interface SortValueCacheEntry {
  rowVersion: number
  values: readonly unknown[]
}

function isDataGridRowId(value: unknown): value is DataGridRowId {
  return typeof value === "string" || typeof value === "number"
}

export function createClientRowModel<T>(
  options: CreateClientRowModelOptions<T> = {},
): ClientRowModel<T> {
  const structuredCloneRef = (globalThis as typeof globalThis & {
    structuredClone?: <U>(value: U) => U
  }).structuredClone

  const cloneSortModel = (input: readonly DataGridSortState[]): readonly DataGridSortState[] =>
    input.map(item => ({ ...item }))

  const cloneFilterModel = (input: DataGridFilterSnapshot | null): DataGridFilterSnapshot | null => {
    if (!input) {
      return null
    }
    if (typeof structuredCloneRef === "function") {
      try {
        return structuredCloneRef(input)
      } catch {
        // Fall through to deterministic JS clone for non-cloneable payloads.
      }
    }
    return cloneFilterSnapshot(input)
  }

  const resolveRowId = options.resolveRowId
  const treeData = normalizeTreeDataSpec(options.initialTreeData ?? null)
  const projectionPolicy = options.projectionPolicy ?? createDataGridProjectionPolicy({
    performanceMode: options.performanceMode,
    dependencies: options.fieldDependencies,
  })
  if (options.projectionPolicy && Array.isArray(options.fieldDependencies)) {
    for (const dependency of options.fieldDependencies) {
      projectionPolicy.dependencyGraph.registerDependency(
        dependency.sourceField,
        dependency.dependentField,
      )
    }
  }
  let treeDataDiagnostics: DataGridTreeDataDiagnostics | null = treeData ? createEmptyTreeDataDiagnostics() : null

  const normalizeSourceRows = (inputRows: readonly DataGridRowNodeInput<T>[] | null | undefined): DataGridRowNode<T>[] => {
    const normalized = Array.isArray(inputRows)
      ? reindexSourceRows(inputRows.map((row, index) => normalizeRowNode(withResolvedRowIdentity(row, index, resolveRowId), index)))
      : []
    if (!treeData) {
      return normalized
    }
    const duplicates = findDuplicateRowIds(normalized)
    if (duplicates.length === 0) {
      return normalized
    }
    const message = `[DataGridTreeData] Duplicate rowId detected (${duplicates.map(value => String(value)).join(", ")}).`
    treeDataDiagnostics = createEmptyTreeDataDiagnostics({
      duplicates: duplicates.length,
      lastError: message,
      orphans: treeDataDiagnostics?.orphans ?? 0,
      cycles: treeDataDiagnostics?.cycles ?? 0,
    })
    throw new Error(message)
  }

  let sourceRows: DataGridRowNode<T>[] = normalizeSourceRows(options.rows ?? [])
  const runtimeStateStore = createClientRowRuntimeStateStore<T>()
  const runtimeState = runtimeStateStore.state
  let sortModel: readonly DataGridSortState[] = options.initialSortModel ? cloneSortModel(options.initialSortModel) : []
  let filterModel: DataGridFilterSnapshot | null = cloneFilterModel(options.initialFilterModel ?? null)
  let groupBy: DataGridGroupBySpec | null = treeData
    ? null
    : normalizeGroupBySpec(options.initialGroupBy ?? null)
  let pivotModel: DataGridPivotSpec | null = normalizePivotSpec(options.initialPivotModel ?? null)
  let pivotColumns: DataGridPivotColumn[] = []
  let aggregationModel: DataGridAggregationModel<T> | null = cloneAggregationModel(options.initialAggregationModel ?? null)
  const pivotRuntime = createPivotRuntime<T>()
  const treeProjectionRuntime = createTreeProjectionRuntime<T>()
  const aggregationEngine = createDataGridAggregationEngine<T>(aggregationModel)
  let expansionExpandedByDefault = Boolean(treeData?.expandedByDefault ?? groupBy?.expandedByDefault)
  let paginationInput = normalizePaginationInput(options.initialPagination ?? null)
  let pagination = buildPaginationSnapshot(0, paginationInput)
  const toggledGroupKeys = new Set<string>()
  let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, runtimeState.rows.length)
  const lifecycle = createClientRowLifecycle<T>()
  let cachedFilterPredicateKey = "__none__"
  let cachedFilterPredicate: ((rowNode: DataGridRowNode<T>) => boolean) | null = null
  let rowVersionById = createRowVersionIndex(sourceRows)
  const sortValueCache = new Map<DataGridRowId, SortValueCacheEntry>()
  let sortValueCacheKey = "__none__"
  const groupValueCache = new Map<string, string>()
  let groupValueCacheKey = "__none__"
  const derivedCacheDiagnostics: DataGridClientRowModelDerivedCacheDiagnostics = {
    revisions: {
      row: runtimeState.rowRevision,
      sort: runtimeState.sortRevision,
      filter: runtimeState.filterRevision,
      group: runtimeState.groupRevision,
    },
    filterPredicateHits: 0,
    filterPredicateMisses: 0,
    sortValueHits: 0,
    sortValueMisses: 0,
    groupValueHits: 0,
    groupValueMisses: 0,
  }
  let treeCacheRevision = 0
  let treePathProjectionCacheState: TreePathProjectionCacheState<T> | null = null
  let treeParentProjectionCacheState: TreeParentProjectionCacheState<T> | null = null
  const groupByIncrementalAggregationState = createGroupByIncrementalAggregationState()
  let groupedProjectionGroupIndexByRowId = new Map<DataGridRowId, number>()
  let lastTreeProjectionCacheKey: string | null = null
  let lastTreeExpansionSnapshot: DataGridGroupExpansionSnapshot | null = null
  const projectionEngine = createClientRowProjectionEngine<T>()

  function ensureActive() {
    lifecycle.ensureActive()
  }

  function invalidateTreeProjectionCaches(): void {
    treeCacheRevision += 1
    treePathProjectionCacheState = null
    treeParentProjectionCacheState = null
    lastTreeProjectionCacheKey = null
    lastTreeExpansionSnapshot = null
  }

  function patchTreeProjectionCacheRowsByIdentity(changedRowIds: readonly DataGridRowId[] = []): void {
    if (!treeData || (!treePathProjectionCacheState && !treeParentProjectionCacheState)) {
      return
    }
    const sourceById = buildRowIdIndex(sourceRows)
    if (treePathProjectionCacheState) {
      treePathProjectionCacheState = {
        key: treePathProjectionCacheState.key,
        cache: treeProjectionRuntime.patchPathCacheRowsByIdentity(
          treePathProjectionCacheState.cache,
          sourceById,
          changedRowIds,
        ),
      }
    }
    if (treeParentProjectionCacheState) {
      treeParentProjectionCacheState = {
        key: treeParentProjectionCacheState.key,
        cache: treeProjectionRuntime.patchParentCacheRowsByIdentity(
          treeParentProjectionCacheState.cache,
          sourceById,
          changedRowIds,
        ),
      }
    }
  }

  function resetGroupByIncrementalAggregationState(): void {
    resetGroupByIncrementalAggregationStateRuntime(groupByIncrementalAggregationState)
  }

  function patchRuntimeGroupAggregates(
    resolveAggregates: (groupKey: string) => Record<string, unknown> | undefined,
  ): void {
    runtimeState.groupedRowsProjection = patchGroupRowsAggregatesByGroupKey(
      runtimeState.groupedRowsProjection,
      resolveAggregates,
    )
    runtimeState.aggregatedRowsProjection = patchGroupRowsAggregatesByGroupKey(
      runtimeState.aggregatedRowsProjection,
      resolveAggregates,
    )
    runtimeState.paginatedRowsProjection = patchGroupRowsAggregatesByGroupKey(
      runtimeState.paginatedRowsProjection,
      resolveAggregates,
    )
    runtimeState.rows = patchGroupRowsAggregatesByGroupKey(runtimeState.rows, resolveAggregates)
  }

  function applyIncrementalAggregationPatch(
    changeSet: ReturnType<typeof analyzeRowPatchChangeSet<T>>,
    previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  ): boolean {
    aggregationEngine.setModel(aggregationModel)
    return applyIncrementalAggregationPatchRuntime({
      changedRowIds: changeSet.changedRowIds,
      previousRowsById,
      sourceRows,
      stageImpact: {
        affectsAggregation: changeSet.stageImpact.affectsAggregation,
        affectsFilter: changeSet.stageImpact.affectsFilter,
        affectsSort: changeSet.stageImpact.affectsSort,
        affectsGroup: changeSet.stageImpact.affectsGroup,
      },
      hasPivotModel: Boolean(pivotModel),
      hasAggregationModel: Boolean(aggregationModel && aggregationModel.columns.length > 0),
      hasTreeData: Boolean(treeData),
      hasGroupBy: Boolean(groupBy),
      groupByState: groupByIncrementalAggregationState,
      treePathCacheState: treePathProjectionCacheState,
      treeParentCacheState: treeParentProjectionCacheState,
      isIncrementalAggregationSupported: () => aggregationEngine.isIncrementalAggregationSupported(),
      createLeafContribution: row => aggregationEngine.createLeafContribution(row),
      applyContributionDelta: (groupState, previous, next) => {
        aggregationEngine.applyContributionDelta(groupState, previous, next)
      },
      finalizeGroupState: groupState => aggregationEngine.finalizeGroupState(groupState),
      patchRuntimeGroupAggregates,
    })
  }

  function resolveFilterPredicate(
    options: { ignoreColumnFilterKey?: string } = {},
  ): (rowNode: DataGridRowNode<T>) => boolean {
    const ignoredColumnKey = typeof options.ignoreColumnFilterKey === "string"
      ? options.ignoreColumnFilterKey.trim()
      : ""
    if (ignoredColumnKey) {
      derivedCacheDiagnostics.filterPredicateMisses += 1
      return createFilterPredicate(filterModel, { ignoreColumnFilterKey: ignoredColumnKey })
    }

    const filterKey = String(runtimeState.filterRevision)
    return filterKey === cachedFilterPredicateKey && cachedFilterPredicate
      ? (() => {
          derivedCacheDiagnostics.filterPredicateHits += 1
          return cachedFilterPredicate as (rowNode: DataGridRowNode<T>) => boolean
        })()
      : (() => {
          const next = createFilterPredicate(filterModel)
          cachedFilterPredicateKey = filterKey
          cachedFilterPredicate = next
          derivedCacheDiagnostics.filterPredicateMisses += 1
          return next
        })()
  }

  function runFilterStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runFilterStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runFilterStage"]> {
    const shouldRecomputeFilter = context.shouldRecompute || runtimeState.filteredRowsProjection.length === 0
    let filteredRowIds = new Set<DataGridRowId>()
    if (shouldRecomputeFilter) {
      const filterPredicate = context.filterPredicate ?? resolveFilterPredicate()
      const nextFilteredRows: DataGridRowNode<T>[] = []
      for (const row of sourceRows) {
        if (!filterPredicate(row)) {
          continue
        }
        nextFilteredRows.push(row)
        filteredRowIds.add(row.rowId)
      }
      runtimeState.filteredRowsProjection = nextFilteredRows
    } else {
      runtimeState.filteredRowsProjection = remapRowsByIdentity(runtimeState.filteredRowsProjection, context.sourceById)
      for (const row of runtimeState.filteredRowsProjection) {
        filteredRowIds.add(row.rowId)
      }
    }
    return {
      filteredRowIds,
      recomputed: shouldRecomputeFilter,
    }
  }

  function runSortStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runSortStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runSortStage"]> {
    const rowsForSort = treeData
      ? (shouldUseFilteredRowsForTreeSort(treeData, filterModel)
          ? runtimeState.filteredRowsProjection
          : sourceRows)
      : runtimeState.filteredRowsProjection
    const shouldRecomputeSort = context.shouldRecompute || runtimeState.sortedRowsProjection.length === 0
    if (shouldRecomputeSort) {
      const shouldCacheSortValues = projectionPolicy.shouldCacheSortValues()
      const maxSortValueCacheSize = projectionPolicy.maxSortValueCacheSize(sourceRows.length)
      const sortKey = serializeSortValueModelForCache(sortModel, { includeDirection: false })
      if (sortKey !== sortValueCacheKey || !shouldCacheSortValues || maxSortValueCacheSize <= 0) {
        sortValueCache.clear()
        sortValueCacheKey = sortKey
      }
      runtimeState.sortedRowsProjection = sortLeafRows(rowsForSort, sortModel, (row, descriptors) => {
        if (!shouldCacheSortValues || maxSortValueCacheSize <= 0) {
          derivedCacheDiagnostics.sortValueMisses += 1
          return descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field))
        }
        const currentRowVersion = rowVersionById.get(row.rowId) ?? 0
        const cached = sortValueCache.get(row.rowId)
        if (cached && cached.rowVersion === currentRowVersion) {
          sortValueCache.delete(row.rowId)
          sortValueCache.set(row.rowId, cached)
          derivedCacheDiagnostics.sortValueHits += 1
          return cached.values
        }
        const resolved = descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field))
        sortValueCache.set(row.rowId, {
          rowVersion: currentRowVersion,
          values: resolved,
        })
        enforceCacheCap(sortValueCache, maxSortValueCacheSize)
        derivedCacheDiagnostics.sortValueMisses += 1
        return resolved
      })
    } else {
      runtimeState.sortedRowsProjection = preserveRowOrder(runtimeState.sortedRowsProjection, rowsForSort)
    }
    return shouldRecomputeSort
  }

  function runGroupStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runGroupStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runGroupStage"]> {
    const expansionSpec = getExpansionSpec()
    const expansionSnapshot = buildGroupExpansionSnapshot(expansionSpec, toggledGroupKeys)
    const nextGroupValueCacheKey = groupBy
      ? `${runtimeState.rowRevision}:${runtimeState.groupRevision}:${groupBy.fields.join("|")}`
      : "__none__"
    const groupValueCounters = {
      hits: derivedCacheDiagnostics.groupValueHits,
      misses: derivedCacheDiagnostics.groupValueMisses,
    }
    let groupedResult: TreeProjectionResult<T> | null = null
    let recomputedGroupStage = false
    if (treeData) {
      const treeCacheKey = treeProjectionRuntime.buildCacheKey({
        treeCacheRevision,
        filterRevision: runtimeState.filterRevision,
        sortRevision: runtimeState.sortRevision,
        treeData,
      })
      const shouldRecomputeGroup = context.shouldRecompute || runtimeState.groupedRowsProjection.length === 0
      if (shouldRecomputeGroup) {
        const aggregationBasis: "filtered" | "source" = aggregationModel?.basis === "source"
          ? "source"
          : "filtered"
        let treeRowsForProjection = runtimeState.sortedRowsProjection
        let treeRowMatchesFilter = context.rowMatchesFilter
        if (
          treeData.mode === "path" &&
          shouldUseFilteredRowsForTreeSort(treeData, filterModel) &&
          aggregationBasis !== "source"
        ) {
          if (runtimeState.sortedRowsProjection.length === runtimeState.filteredRowsProjection.length) {
            treeRowMatchesFilter = alwaysMatchesFilter
          } else {
            const filteredSortedRows: DataGridRowNode<T>[] = []
            for (const row of runtimeState.sortedRowsProjection) {
              if (!context.rowMatchesFilter(row)) {
                continue
              }
              filteredSortedRows.push(row)
            }
            treeRowsForProjection = filteredSortedRows
            treeRowMatchesFilter = alwaysMatchesFilter
          }
        }
        const hasTreeAggregationModel = Boolean(aggregationModel && aggregationModel.columns.length > 0)
        if (hasTreeAggregationModel) {
          aggregationEngine.setModel(aggregationModel)
        }
        const computeTreeAggregates = hasTreeAggregationModel
          ? ((rows: readonly DataGridRowNode<T>[]) => aggregationEngine.computeAggregatesForLeaves(rows))
          : undefined
        const supportsIncrementalTreeAggregation = hasTreeAggregationModel
          && aggregationEngine.isIncrementalAggregationSupported()
        const createTreeLeafContribution = supportsIncrementalTreeAggregation
          ? ((row: DataGridRowNode<T>) => aggregationEngine.createLeafContribution(row))
          : undefined
        const createTreeGroupState = supportsIncrementalTreeAggregation
          ? (() => aggregationEngine.createEmptyGroupState())
          : undefined
        const applyTreeContributionDelta = supportsIncrementalTreeAggregation
          ? ((
            groupState: DataGridIncrementalAggregationGroupState,
            previous: DataGridIncrementalAggregationLeafContribution | null,
            next: DataGridIncrementalAggregationLeafContribution | null,
          ) => {
            aggregationEngine.applyContributionDelta(groupState, previous, next)
          })
          : undefined
        const finalizeTreeGroupState = supportsIncrementalTreeAggregation
          ? ((groupState: DataGridIncrementalAggregationGroupState) => aggregationEngine.finalizeGroupState(groupState))
          : undefined
        if (
          context.shouldRecompute &&
          runtimeState.groupedRowsProjection.length > 0 &&
          lastTreeProjectionCacheKey === treeCacheKey &&
          lastTreeExpansionSnapshot
        ) {
          if (treeData.mode === "path" && treePathProjectionCacheState?.key === treeCacheKey) {
            groupedResult = treeProjectionRuntime.tryProjectPathSubtreeToggle({
              rows: runtimeState.groupedRowsProjection,
              cacheState: treePathProjectionCacheState,
              treeData,
              previousExpansionSnapshot: lastTreeExpansionSnapshot,
              nextExpansionSnapshot: expansionSnapshot,
              groupIndexByRowId: groupedProjectionGroupIndexByRowId,
            })
          } else if (treeData.mode === "parent" && treeParentProjectionCacheState?.key === treeCacheKey) {
            groupedResult = treeProjectionRuntime.tryProjectParentSubtreeToggle({
              rows: runtimeState.groupedRowsProjection,
              cacheState: treeParentProjectionCacheState,
              previousExpansionSnapshot: lastTreeExpansionSnapshot,
              nextExpansionSnapshot: expansionSnapshot,
              groupIndexByRowId: groupedProjectionGroupIndexByRowId,
            })
          }
        }
        if (!groupedResult) {
          try {
            const projected = treeProjectionRuntime.projectRowsFromCache({
              inputRows: treeRowsForProjection,
              treeData,
              expansionSnapshot,
              expansionToggledKeys: toggledGroupKeys,
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
        runtimeState.groupedRowsProjection = groupedResult.rows
        lastTreeProjectionCacheKey = treeCacheKey
        lastTreeExpansionSnapshot = expansionSnapshot
        recomputedGroupStage = true
      } else {
        runtimeState.groupedRowsProjection = patchProjectedRowsByIdentity(runtimeState.groupedRowsProjection, context.sourceById)
      }
      if (shouldRecomputeGroup || groupedResult) {
        treeDataDiagnostics = createEmptyTreeDataDiagnostics({
          duplicates: 0,
          lastError: null,
          orphans: groupedResult?.diagnostics.orphans ?? 0,
          cycles: groupedResult?.diagnostics.cycles ?? 0,
        })
      }
    } else if (pivotModel) {
      const shouldRecomputeGroup = context.shouldRecompute || runtimeState.groupedRowsProjection.length === 0
      if (shouldRecomputeGroup) {
        runtimeState.groupedRowsProjection = runtimeState.filteredRowsProjection
        recomputedGroupStage = true
      } else {
        runtimeState.groupedRowsProjection = remapRowsByIdentity(runtimeState.groupedRowsProjection, context.sourceById)
      }
    } else if (groupBy) {
      const shouldRecomputeGroup = context.shouldRecompute || runtimeState.groupedRowsProjection.length === 0
      if (shouldRecomputeGroup) {
        const shouldCacheGroupValues = projectionPolicy.shouldCacheGroupValues()
        const maxGroupValueCacheSize = projectionPolicy.maxGroupValueCacheSize(sourceRows.length)
        if (nextGroupValueCacheKey !== groupValueCacheKey) {
          groupValueCache.clear()
          groupValueCacheKey = nextGroupValueCacheKey
        }
        if (!shouldCacheGroupValues || maxGroupValueCacheSize <= 0) {
          groupValueCache.clear()
        }
        runtimeState.groupedRowsProjection = buildGroupedRowsProjection({
          inputRows: runtimeState.sortedRowsProjection,
          groupBy,
          expansionSnapshot,
          readRowField: (row, key, field) => readRowField(row, key, field),
          normalizeText,
          normalizeLeafRow,
          groupValueCache: shouldCacheGroupValues && maxGroupValueCacheSize > 0
            ? groupValueCache
            : undefined,
          groupValueCounters: shouldCacheGroupValues && maxGroupValueCacheSize > 0
            ? groupValueCounters
            : undefined,
          maxGroupValueCacheSize: shouldCacheGroupValues && maxGroupValueCacheSize > 0
            ? maxGroupValueCacheSize
            : undefined,
        })
        if (shouldCacheGroupValues) {
          enforceCacheCap(groupValueCache, maxGroupValueCacheSize)
        }
        recomputedGroupStage = true
      } else {
        runtimeState.groupedRowsProjection = patchProjectedRowsByIdentity(runtimeState.groupedRowsProjection, context.sourceById)
      }
    } else {
      runtimeState.groupedRowsProjection = runtimeState.sortedRowsProjection
      recomputedGroupStage = context.shouldRecompute
    }
    if (recomputedGroupStage) {
      groupedProjectionGroupIndexByRowId = buildGroupRowIndexByRowId(runtimeState.groupedRowsProjection)
    }
    derivedCacheDiagnostics.groupValueHits = groupValueCounters.hits
    derivedCacheDiagnostics.groupValueMisses = groupValueCounters.misses
    return recomputedGroupStage
  }

  function runPivotStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runPivotStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runPivotStage"]> {
    if (!pivotModel) {
      pivotColumns = []
      const shouldRecomputePivot = context.shouldRecompute || runtimeState.pivotedRowsProjection.length === 0
      runtimeState.pivotedRowsProjection = runtimeState.groupedRowsProjection
      return shouldRecomputePivot
    }

    const shouldRecomputePivot = context.shouldRecompute || runtimeState.pivotedRowsProjection.length === 0
    if (!shouldRecomputePivot) {
      return false
    }
    const pivotProjection = pivotRuntime.projectRows({
      inputRows: runtimeState.groupedRowsProjection,
      pivotModel,
      normalizeFieldValue: normalizeText,
    })
    runtimeState.pivotedRowsProjection = pivotProjection.rows
    pivotColumns = pivotRuntime.normalizeColumns(pivotProjection.columns)
    return true
  }

  function runPaginateStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runPaginateStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runPaginateStage"]> {
    const shouldRecomputePaginate = context.shouldRecompute || runtimeState.paginatedRowsProjection.length === 0
    if (shouldRecomputePaginate) {
      pagination = buildPaginationSnapshot(runtimeState.aggregatedRowsProjection.length, paginationInput)
      if (pagination.enabled && pagination.startIndex >= 0 && pagination.endIndex >= pagination.startIndex) {
        runtimeState.paginatedRowsProjection = runtimeState.aggregatedRowsProjection.slice(pagination.startIndex, pagination.endIndex + 1)
      } else {
        runtimeState.paginatedRowsProjection = runtimeState.aggregatedRowsProjection
      }
    } else {
      runtimeState.paginatedRowsProjection = patchProjectedRowsByIdentity(runtimeState.paginatedRowsProjection, context.sourceById)
    }
    return shouldRecomputePaginate
  }

  function runAggregateStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runAggregateStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runAggregateStage"]> {
    const shouldRecomputeAggregate = context.shouldRecompute || runtimeState.aggregatedRowsProjection.length === 0
    if (!shouldRecomputeAggregate) {
      runtimeState.aggregatedRowsProjection = patchProjectedRowsByIdentity(runtimeState.aggregatedRowsProjection, context.sourceById)
      return false
    }

    const activeGroupBy = groupBy
    const activeAggregationModel = aggregationModel
    const hasAggregationModel = Boolean(activeAggregationModel && activeAggregationModel.columns.length > 0)
    if (pivotModel) {
      resetGroupByIncrementalAggregationState()
      runtimeState.aggregatedRowsProjection = runtimeState.pivotedRowsProjection
      return true
    }
    if (treeData || !activeGroupBy || !hasAggregationModel || !activeAggregationModel) {
      resetGroupByIncrementalAggregationState()
      runtimeState.aggregatedRowsProjection = runtimeState.groupedRowsProjection
      return true
    }

    aggregationEngine.setModel(activeAggregationModel)
    const aggregationBasis: "filtered" | "source" = activeAggregationModel.basis === "source"
      ? "source"
      : "filtered"
    const sourceRowsForAggregation = sortModel.length > 0
      ? sortLeafRows(sourceRows, sortModel, (row, descriptors) => {
          return descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field))
        })
      : sourceRows
    const rowsForAggregation = aggregationBasis === "source"
      ? sourceRowsForAggregation
      : runtimeState.sortedRowsProjection

    let aggregatesByGroupKey: ReadonlyMap<string, Record<string, unknown>>
    if (aggregationEngine.isIncrementalAggregationSupported()) {
      const incremental = computeGroupByIncrementalAggregation(
        rowsForAggregation,
        activeGroupBy.fields,
        (row, field) => normalizeText(readRowField(row, field)),
        row => aggregationEngine.createLeafContribution(row),
        () => aggregationEngine.createEmptyGroupState(),
        (groupState, previous, next) => aggregationEngine.applyContributionDelta(groupState, previous, next),
        groupState => aggregationEngine.finalizeGroupState(groupState),
      )
      groupByIncrementalAggregationState.statesByGroupKey = incremental.statesByGroupKey
      groupByIncrementalAggregationState.aggregatesByGroupKey = incremental.aggregatesByGroupKey
      groupByIncrementalAggregationState.groupPathByRowId = incremental.groupPathByRowId
      groupByIncrementalAggregationState.leafContributionByRowId = incremental.leafContributionByRowId
      aggregatesByGroupKey = groupByIncrementalAggregationState.aggregatesByGroupKey
    } else {
      resetGroupByIncrementalAggregationState()
      aggregatesByGroupKey = computeGroupByAggregatesMap(
        rowsForAggregation,
        activeGroupBy,
        (row, field) => normalizeText(readRowField(row, field)),
        rows => aggregationEngine.computeAggregatesForLeaves(rows),
      )
      groupByIncrementalAggregationState.aggregatesByGroupKey = new Map(aggregatesByGroupKey)
    }

    runtimeState.aggregatedRowsProjection = patchGroupRowsAggregatesByGroupKey(
      runtimeState.groupedRowsProjection,
      groupKey => aggregatesByGroupKey.get(groupKey),
    )
    return true
  }

  function runVisibleStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runVisibleStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runVisibleStage"]> {
    const shouldRecomputeVisible = context.shouldRecompute || runtimeState.rows.length === 0
    if (shouldRecomputeVisible) {
      runtimeState.rows = assignDisplayIndexes(runtimeState.paginatedRowsProjection)
    } else {
      runtimeState.rows = patchProjectedRowsByIdentity(runtimeState.rows, context.sourceById)
    }
    return shouldRecomputeVisible
  }

  function finalizeProjectionRecompute(meta: DataGridClientProjectionFinalizeMeta): void {
    paginationInput = {
      pageSize: pagination.pageSize,
      currentPage: pagination.currentPage,
    }
    viewportRange = normalizeViewportRange(viewportRange, runtimeState.rows.length)
    derivedCacheDiagnostics.revisions = {
      row: runtimeState.rowRevision,
      sort: runtimeState.sortRevision,
      filter: runtimeState.filterRevision,
      group: runtimeState.groupRevision,
    }
    runtimeStateStore.commitProjectionCycle(meta.hadActualRecompute)
  }

  const projectionStageHandlers: DataGridClientProjectionStageHandlers<T> = {
    buildSourceById: () => buildRowIdIndex(sourceRows),
    getCurrentFilteredRowIds: () => {
      const rowIds = new Set<DataGridRowId>()
      for (const row of runtimeState.filteredRowsProjection) {
        rowIds.add(row.rowId)
      }
      return rowIds
    },
    resolveFilterPredicate,
    runFilterStage,
    runSortStage,
    runGroupStage,
    runPivotStage,
    runAggregateStage,
    runPaginateStage,
    runVisibleStage,
    finalizeProjectionRecompute,
  }
  const projectionOrchestrator = createClientRowProjectionOrchestrator(
    projectionEngine,
    projectionStageHandlers,
  )

  function getProjectionDiagnostics(): DataGridProjectionDiagnostics {
    return runtimeStateStore.getProjectionDiagnostics(() => projectionOrchestrator.getStaleStages())
  }

  function getSnapshot(): DataGridRowModelSnapshot<T> {
    viewportRange = normalizeViewportRange(viewportRange, runtimeState.rows.length)
    const expansionSpec = getExpansionSpec()
    return {
      revision: runtimeState.revision,
      kind: "client",
      rowCount: runtimeState.rows.length,
      loading: false,
      error: null,
      ...(treeData ? { treeDataDiagnostics: createEmptyTreeDataDiagnostics(treeDataDiagnostics ?? undefined) } : {}),
      projection: getProjectionDiagnostics(),
      viewportRange,
      pagination,
      sortModel: cloneSortModel(sortModel),
      filterModel: cloneFilterModel(filterModel),
      groupBy: treeData ? null : cloneGroupBySpec(groupBy),
      ...(pivotModel
        ? {
            pivotModel: clonePivotSpec(pivotModel),
            pivotColumns: pivotRuntime.normalizeColumns(pivotColumns),
          }
        : {}),
      groupExpansion: buildGroupExpansionSnapshot(expansionSpec, toggledGroupKeys),
    }
  }

  function emit() {
    lifecycle.emit(getSnapshot)
  }

  function getExpansionSpec(): DataGridGroupBySpec | null {
    if (treeData) {
      return {
        fields: ["__tree__"],
        expandedByDefault: expansionExpandedByDefault,
      }
    }
    if (pivotModel) {
      return null
    }
    if (!groupBy) {
      return null
    }
    return {
      fields: groupBy.fields,
      expandedByDefault: expansionExpandedByDefault,
    }
  }

  function applyGroupExpansion(nextExpansion: DataGridGroupExpansionSnapshot | null): boolean {
    const expansionSpec = getExpansionSpec()
    if (!expansionSpec) {
      return false
    }
    const normalizedSnapshot = buildGroupExpansionSnapshot(
      {
        fields: expansionSpec.fields,
        expandedByDefault: nextExpansion?.expandedByDefault ?? expansionSpec.expandedByDefault,
      },
      nextExpansion?.toggledGroupKeys ?? [],
    )
    const currentSnapshot = buildGroupExpansionSnapshot(expansionSpec, toggledGroupKeys)
    if (isSameGroupExpansionSnapshot(currentSnapshot, normalizedSnapshot)) {
      return false
    }
    expansionExpandedByDefault = normalizedSnapshot.expandedByDefault
    toggledGroupKeys.clear()
    for (const groupKey of normalizedSnapshot.toggledGroupKeys) {
      toggledGroupKeys.add(groupKey)
    }
    return true
  }

  projectionOrchestrator.recomputeFromStage("filter")

  return {
    kind: "client",
    getSnapshot,
    getRowCount() {
      return runtimeState.rows.length
    },
    getRow(index: number) {
      if (!Number.isFinite(index)) {
        return undefined
      }
      return runtimeState.rows[Math.max(0, Math.trunc(index))]
    },
    getRowsInRange(range: DataGridViewportRange) {
      const normalized = normalizeViewportRange(range, runtimeState.rows.length)
      if (runtimeState.rows.length === 0) {
        return []
      }
      return runtimeState.rows.slice(normalized.start, normalized.end + 1)
    },
    setRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      ensureActive()
      const nextSourceRows = normalizeSourceRows(nextRows ?? [])
      rowVersionById = rebuildRowVersionIndex(rowVersionById, nextSourceRows)
      sourceRows = nextSourceRows
      pruneSortCacheRows(sortValueCache, sourceRows)
      runtimeStateStore.bumpRowRevision()
      resetGroupByIncrementalAggregationState()
      invalidateTreeProjectionCaches()
      projectionOrchestrator.recomputeFromStage("filter")
      emit()
    },
    patchRows(
      updates: readonly DataGridClientRowPatch<T>[],
      options: DataGridClientRowPatchOptions = {},
    ) {
      ensureActive()
      if (!Array.isArray(updates) || updates.length === 0) {
        return
      }
      const updatesById = new Map<DataGridRowId, Partial<T>>()
      for (const update of updates) {
        if (!update || !isDataGridRowId(update.rowId) || typeof update.data === "undefined" || update.data === null) {
          continue
        }
        const existing = updatesById.get(update.rowId)
        if (existing) {
          updatesById.set(update.rowId, mergeRowPatch(existing, update.data))
          continue
        }
        updatesById.set(update.rowId, update.data)
      }
      if (updatesById.size === 0) {
        return
      }
      let changed = false
      const changedRowIds: DataGridRowId[] = []
      const changedUpdatesById = new Map<DataGridRowId, Partial<T>>()
      const previousRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()
      sourceRows = sourceRows.map(row => {
        const patch = updatesById.get(row.rowId)
        if (!patch) {
          return row
        }
        const nextData = applyRowDataPatch(row.data, patch)
        if (nextData === row.data) {
          return row
        }
        changed = true
        changedRowIds.push(row.rowId)
        changedUpdatesById.set(row.rowId, patch)
        previousRowsById.set(row.rowId, row)
        return {
          ...row,
          data: nextData,
          row: nextData,
        }
      })
      if (!changed || changedUpdatesById.size === 0) {
        return
      }
      bumpRowVersions(rowVersionById, changedRowIds)
      runtimeStateStore.bumpRowRevision()
      const filterActive = hasActiveFilterModel(filterModel)
      const sortActive = sortModel.length > 0
      const groupActive = Boolean(treeData) || Boolean(groupBy) || Boolean(pivotModel)
      const aggregationActive = Boolean(aggregationModel && aggregationModel.columns.length > 0)
      const allowFilterRecompute = options.recomputeFilter === true
      const allowSortRecompute = options.recomputeSort === true
      const allowGroupRecompute = options.recomputeGroup === true
      const filterFields = filterActive ? collectFilterModelFields(filterModel) : new Set<string>()
      const sortFields = sortActive ? collectSortModelFields(sortModel) : new Set<string>()
      const groupFields = groupActive && !treeData
        ? (pivotModel ? collectPivotModelFields(pivotModel) : collectGroupByFields(groupBy))
        : new Set<string>()
      const aggregationFields = aggregationActive ? collectAggregationModelFields(aggregationModel) : new Set<string>()
      const treeDataDependencyFields = treeData ? collectTreeDataDependencyFields(treeData) : new Set<string>()
      const changeSet = analyzeRowPatchChangeSet({
        updatesById: changedUpdatesById,
        dependencyGraph: projectionPolicy.dependencyGraph,
        filterActive,
        sortActive,
        groupActive,
        aggregationActive,
        filterFields,
        sortFields,
        groupFields,
        aggregationFields,
        treeDataDependencyFields,
        hasTreeData: Boolean(treeData),
      })
      if (changeSet.cacheEvictionPlan.clearSortValueCache) {
        sortValueCache.clear()
      } else if (changeSet.cacheEvictionPlan.evictSortValueRowIds.length > 0) {
        for (const rowId of changeSet.cacheEvictionPlan.evictSortValueRowIds) {
          sortValueCache.delete(rowId)
        }
      }
      if (changeSet.cacheEvictionPlan.invalidateTreeProjectionCaches) {
        invalidateTreeProjectionCaches()
      } else if (changeSet.cacheEvictionPlan.patchTreeProjectionCacheRowsByIdentity) {
        patchTreeProjectionCacheRowsByIdentity(changedRowIds)
      }
      const appliedIncrementalAggregation = !allowGroupRecompute
        && applyIncrementalAggregationPatch(changeSet, previousRowsById)
      const effectiveChangeSet = appliedIncrementalAggregation
        ? {
            ...changeSet,
            stageImpact: {
              ...changeSet.stageImpact,
              affectsAggregation: false,
            },
          }
        : changeSet
      const staleStagesBeforeRequest = new Set<DataGridClientProjectionStage>(projectionOrchestrator.getStaleStages())
      const allStages: readonly DataGridClientProjectionStage[] = DATAGRID_CLIENT_ALL_PROJECTION_STAGES
      const projectionExecutionPlan = buildPatchProjectionExecutionPlan({
        changeSet: effectiveChangeSet,
        recomputePolicy: {
          filter: allowFilterRecompute,
          sort: allowSortRecompute,
          group: allowGroupRecompute,
        },
        staleStages: staleStagesBeforeRequest,
        allStages,
        expandStages: expandClientProjectionStages,
      })
      // Always request a projection refresh pass so every stage can patch row identity
      // even when no expensive stage recompute is needed.
      projectionOrchestrator.recomputeWithExecutionPlan(projectionExecutionPlan)
      if (options.emit !== false) {
        emit()
      }
    },
    reorderRows(input: DataGridClientRowReorderInput) {
      ensureActive()
      const length = sourceRows.length
      if (length <= 1) {
        return false
      }
      if (!Number.isFinite(input.fromIndex) || !Number.isFinite(input.toIndex)) {
        return false
      }
      const fromIndex = Math.max(0, Math.min(length - 1, Math.trunc(input.fromIndex)))
      const count = Number.isFinite(input.count) ? Math.max(1, Math.trunc(input.count as number)) : 1
      const maxCount = Math.max(1, Math.min(count, length - fromIndex))
      const toIndexRaw = Math.max(0, Math.min(length, Math.trunc(input.toIndex)))
      const rows = sourceRows.slice()
      const moved = rows.splice(fromIndex, maxCount)
      if (moved.length === 0) {
        return false
      }
      const adjustedTarget = toIndexRaw > fromIndex ? Math.max(0, toIndexRaw - moved.length) : toIndexRaw
      rows.splice(adjustedTarget, 0, ...moved)
      sourceRows = reindexSourceRows(rows)
      runtimeStateStore.bumpRowRevision()
      invalidateTreeProjectionCaches()
      projectionOrchestrator.recomputeFromStage("filter")
      emit()
      return true
    },
    setViewportRange(range: DataGridViewportRange) {
      ensureActive()
      const nextRange = normalizeViewportRange(range, runtimeState.rows.length)
      if (nextRange.start === viewportRange.start && nextRange.end === viewportRange.end) {
        return
      }
      viewportRange = nextRange
      emit()
    },
    setPagination(nextPagination: DataGridPaginationInput | null) {
      ensureActive()
      const normalized = normalizePaginationInput(nextPagination)
      if (
        normalized.pageSize === paginationInput.pageSize &&
        normalized.currentPage === paginationInput.currentPage
      ) {
        return
      }
      paginationInput = normalized
      projectionOrchestrator.recomputeFromStage("paginate")
      emit()
    },
    setPageSize(pageSize: number | null) {
      ensureActive()
      const normalizedPageSize = normalizePaginationInput({ pageSize: pageSize ?? 0, currentPage: 0 }).pageSize
      if (normalizedPageSize === paginationInput.pageSize) {
        return
      }
      paginationInput = {
        pageSize: normalizedPageSize,
        currentPage: 0,
      }
      projectionOrchestrator.recomputeFromStage("paginate")
      emit()
    },
    setCurrentPage(page: number) {
      ensureActive()
      const normalizedPage = normalizePaginationInput({ pageSize: paginationInput.pageSize, currentPage: page }).currentPage
      if (normalizedPage === paginationInput.currentPage) {
        return
      }
      paginationInput = {
        ...paginationInput,
        currentPage: normalizedPage,
      }
      projectionOrchestrator.recomputeFromStage("paginate")
      emit()
    },
    setSortModel(nextSortModel: readonly DataGridSortState[]) {
      ensureActive()
      const normalizedSortModel = Array.isArray(nextSortModel) ? cloneSortModel(nextSortModel) : []
      if (isSameSortModel(sortModel, normalizedSortModel)) {
        return
      }
      sortModel = normalizedSortModel
      runtimeStateStore.bumpSortRevision()
      projectionOrchestrator.recomputeFromStage("sort")
      emit()
    },
    setFilterModel(nextFilterModel: DataGridFilterSnapshot | null) {
      ensureActive()
      const normalizedFilterModel = cloneFilterModel(nextFilterModel ?? null)
      if (isSameFilterModel(filterModel, normalizedFilterModel)) {
        return
      }
      filterModel = normalizedFilterModel
      runtimeStateStore.bumpFilterRevision()
      projectionOrchestrator.recomputeFromStage("filter")
      emit()
    },
    setSortAndFilterModel(input: DataGridSortAndFilterModelInput) {
      ensureActive()
      const normalizedSortModel = Array.isArray(input?.sortModel) ? cloneSortModel(input.sortModel) : []
      const normalizedFilterModel = cloneFilterModel(input?.filterModel ?? null)
      const sortChanged = !isSameSortModel(sortModel, normalizedSortModel)
      const filterChanged = !isSameFilterModel(filterModel, normalizedFilterModel)
      if (!sortChanged && !filterChanged) {
        return
      }
      sortModel = normalizedSortModel
      filterModel = normalizedFilterModel
      if (filterChanged) {
        runtimeStateStore.bumpFilterRevision()
      }
      if (sortChanged) {
        runtimeStateStore.bumpSortRevision()
      }
      projectionOrchestrator.recomputeFromStage(filterChanged ? "filter" : "sort")
      emit()
    },
    setGroupBy(nextGroupBy: DataGridGroupBySpec | null) {
      ensureActive()
      if (treeData) {
        return
      }
      const normalized = normalizeGroupBySpec(nextGroupBy)
      if (isSameGroupBySpec(groupBy, normalized)) {
        return
      }
      groupBy = normalized
      expansionExpandedByDefault = Boolean(normalized?.expandedByDefault)
      toggledGroupKeys.clear()
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("group")
      emit()
    },
    setPivotModel(nextPivotModel: DataGridPivotSpec | null) {
      ensureActive()
      const normalized = normalizePivotSpec(nextPivotModel)
      if (isSamePivotSpec(pivotModel, normalized)) {
        return
      }
      pivotModel = normalized
      pivotColumns = []
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("pivot")
      emit()
    },
    getPivotModel() {
      return clonePivotSpec(pivotModel)
    },
    setAggregationModel(nextAggregationModel: DataGridAggregationModel<T> | null) {
      ensureActive()
      const normalized = cloneAggregationModel(nextAggregationModel ?? null)
      if (isSameAggregationModel(aggregationModel, normalized)) {
        return
      }
      aggregationModel = normalized
      if (treeData) {
        invalidateTreeProjectionCaches()
        projectionOrchestrator.recomputeFromStage("group")
      } else {
        projectionOrchestrator.recomputeFromStage("aggregate")
      }
      emit()
    },
    getAggregationModel() {
      return cloneAggregationModel(aggregationModel)
    },
    getColumnHistogram(columnId: string, options?: DataGridColumnHistogramOptions) {
      ensureActive()
      const normalizedColumnId = columnId.trim()
      if (normalizedColumnId.length === 0) {
        return []
      }

      const scope = options?.scope ?? "filtered"
      if (scope === "sourceAll") {
        return buildColumnHistogram(sourceRows, normalizedColumnId, options)
      }

      if (options?.ignoreSelfFilter === true) {
        const filterPredicate = resolveFilterPredicate({ ignoreColumnFilterKey: normalizedColumnId })
        const rowsForHistogram: DataGridRowNode<T>[] = []
        for (const row of sourceRows) {
          if (filterPredicate(row)) {
            rowsForHistogram.push(row)
          }
        }
        return buildColumnHistogram(rowsForHistogram, normalizedColumnId, options)
      }

      return buildColumnHistogram(runtimeState.filteredRowsProjection, normalizedColumnId, options)
    },
    setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null) {
      ensureActive()
      if (!applyGroupExpansion(expansion)) {
        return
      }
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("group")
      emit()
    },
    toggleGroup(groupKey: string) {
      ensureActive()
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      if (!toggleGroupExpansionKey(toggledGroupKeys, groupKey)) {
        return
      }
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("group")
      emit()
    },
    expandGroup(groupKey: string) {
      ensureActive()
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      if (!setGroupExpansionKey(toggledGroupKeys, groupKey, expansionExpandedByDefault, true)) {
        return
      }
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("group")
      emit()
    },
    collapseGroup(groupKey: string) {
      ensureActive()
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      if (!setGroupExpansionKey(toggledGroupKeys, groupKey, expansionExpandedByDefault, false)) {
        return
      }
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("group")
      emit()
    },
    expandAllGroups() {
      ensureActive()
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      if (expansionExpandedByDefault && toggledGroupKeys.size === 0) {
        return
      }
      expansionExpandedByDefault = true
      toggledGroupKeys.clear()
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("group")
      emit()
    },
    collapseAllGroups() {
      ensureActive()
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      if (!expansionExpandedByDefault && toggledGroupKeys.size === 0) {
        return
      }
      expansionExpandedByDefault = false
      toggledGroupKeys.clear()
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("group")
      emit()
    },
    refresh(_reason?: DataGridRowModelRefreshReason) {
      ensureActive()
      projectionOrchestrator.refresh()
      emit()
    },
    subscribe(listener: DataGridRowModelListener<T>) {
      return lifecycle.subscribe(listener)
    },
    getDerivedCacheDiagnostics() {
      return {
        revisions: { ...derivedCacheDiagnostics.revisions },
        filterPredicateHits: derivedCacheDiagnostics.filterPredicateHits,
        filterPredicateMisses: derivedCacheDiagnostics.filterPredicateMisses,
        sortValueHits: derivedCacheDiagnostics.sortValueHits,
        sortValueMisses: derivedCacheDiagnostics.sortValueMisses,
        groupValueHits: derivedCacheDiagnostics.groupValueHits,
        groupValueMisses: derivedCacheDiagnostics.groupValueMisses,
      }
    },
    dispose() {
      if (!lifecycle.dispose()) {
        return
      }
      sourceRows = []
      runtimeState.rows = []
      runtimeState.filteredRowsProjection = []
      runtimeState.sortedRowsProjection = []
      runtimeState.groupedRowsProjection = []
      runtimeState.pivotedRowsProjection = []
      runtimeState.aggregatedRowsProjection = []
      runtimeState.paginatedRowsProjection = []
      pivotColumns = []
      rowVersionById.clear()
      resetGroupByIncrementalAggregationState()
      groupedProjectionGroupIndexByRowId.clear()
      sortValueCache.clear()
      groupValueCache.clear()
      invalidateTreeProjectionCaches()
      cachedFilterPredicate = null
      cachedFilterPredicateKey = "__none__"
    },
  }
}
