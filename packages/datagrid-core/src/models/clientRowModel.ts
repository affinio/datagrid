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
  type DataGridPivotCellDrilldown,
  type DataGridPivotCellDrilldownInput,
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
import {
  createDataGridAggregationEngine,
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
import {
  createPivotRuntime,
  type DataGridPivotIncrementalPatchRow,
} from "./pivotRuntime.js"
import {
  areSameAggregateRecords,
  cloneAggregationModel,
  createEmptyTreeDataDiagnostics,
  findDuplicateRowIds,
  isSameAggregationModel,
  patchGroupRowsAggregatesByGroupKey,
} from "./clientRowModelHelpers.js"
import {
  createTreeProjectionRuntime,
  type TreeParentProjectionCacheState,
  type TreePathProjectionCacheState,
} from "./treeProjectionRuntime.js"
import {
  applyIncrementalAggregationPatch as applyIncrementalAggregationPatchRuntime,
  createGroupByIncrementalAggregationState,
  resetGroupByIncrementalAggregationState as resetGroupByIncrementalAggregationStateRuntime,
} from "./incrementalAggregationRuntime.js"
import {
  buildColumnHistogram,
  createFilterPredicate,
  hasActiveFilterModel,
  isSameFilterModel,
  isSameSortModel,
  normalizeText,
  readRowField,
} from "./clientRowProjectionPrimitives.js"
import {
  applyRowDataPatch,
  buildRowIdIndex,
  bumpRowVersions,
  createRowVersionIndex,
  mergeRowPatch,
  pruneSortCacheRows,
  rebuildRowVersionIndex,
  reindexSourceRows,
} from "./clientRowRuntimeUtils.js"
import {
  runFilterProjectionStage,
  runPaginateProjectionStage,
  runSortProjectionStage,
  runVisibleProjectionStage,
  type SortValueCacheEntry,
} from "./clientRowProjectionBasicStages.js"
import { runPivotProjectionStage } from "./clientRowProjectionPivotStage.js"
import { runAggregateProjectionStage } from "./clientRowProjectionAggregateStage.js"
import { runGroupProjectionStage } from "./clientRowProjectionGroupStage.js"
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

function isDataGridRowId(value: unknown): value is DataGridRowId {
  return typeof value === "string" || typeof value === "number"
}

function normalizePivotAxisValue(value: unknown): string {
  if (value == null) {
    return ""
  }
  return normalizeText(value)
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
  let pivotExpansionExpandedByDefault = true
  let paginationInput = normalizePaginationInput(options.initialPagination ?? null)
  let pagination = buildPaginationSnapshot(0, paginationInput)
  const toggledGroupKeys = new Set<string>()
  const toggledPivotGroupKeys = new Set<string>()
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
  let pendingPivotValuePatch: readonly DataGridPivotIncrementalPatchRow<T>[] | null = null
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

  function isPivotExpansionActive(): boolean {
    return Boolean(pivotModel) && !treeData
  }

  function getActiveExpansionStateStore(): {
    expandedByDefault: boolean
    toggledKeys: Set<string>
    setExpandedByDefault: (value: boolean) => void
  } {
    if (isPivotExpansionActive()) {
      return {
        expandedByDefault: pivotExpansionExpandedByDefault,
        toggledKeys: toggledPivotGroupKeys,
        setExpandedByDefault: (value: boolean) => {
          pivotExpansionExpandedByDefault = value
        },
      }
    }
    return {
      expandedByDefault: expansionExpandedByDefault,
      toggledKeys: toggledGroupKeys,
      setExpandedByDefault: (value: boolean) => {
        expansionExpandedByDefault = value
      },
    }
  }

  function getCurrentExpansionSnapshot(): DataGridGroupExpansionSnapshot {
    const expansionSpec = getExpansionSpec()
    const expansionState = getActiveExpansionStateStore()
    return buildGroupExpansionSnapshot(expansionSpec, expansionState.toggledKeys)
  }

  function resolvePivotDrilldownRowConstraints(
    row: DataGridRowNode<T>,
    rowFields: readonly string[],
  ): Array<{ field: string; value: string }> {
    if (String(row.rowId) === "pivot:grand-total") {
      return []
    }
    const constraints: Array<{ field: string; value: string }> = []
    if (row.kind === "group") {
      const depth = Math.max(1, Math.min(rowFields.length, Math.trunc((row.groupMeta?.level ?? 0) + 1)))
      for (let index = 0; index < depth; index += 1) {
        const field = rowFields[index]
        if (!field) {
          continue
        }
        constraints.push({
          field,
          value: normalizePivotAxisValue(readRowField(row, field)),
        })
      }
      return constraints
    }

    for (const field of rowFields) {
      const normalizedValue = normalizePivotAxisValue(readRowField(row, field))
      if (normalizedValue === "Subtotal" || normalizedValue === "Grand Total") {
        break
      }
      constraints.push({
        field,
        value: normalizedValue,
      })
    }
    return constraints
  }

  function resolvePivotCellDrilldown(
    input: DataGridPivotCellDrilldownInput,
  ): DataGridPivotCellDrilldown<T> | null {
    ensureActive()
    if (!pivotModel || !Array.isArray(pivotColumns) || pivotColumns.length === 0) {
      return null
    }
    if (!isDataGridRowId(input?.rowId)) {
      return null
    }
    const columnId = typeof input.columnId === "string" ? input.columnId.trim() : ""
    if (columnId.length === 0) {
      return null
    }
    const pivotColumn = pivotColumns.find(column => column.id === columnId)
    if (!pivotColumn) {
      return null
    }
    const pivotRow = runtimeState.aggregatedRowsProjection.find(row => row.rowId === input.rowId)
      ?? runtimeState.pivotedRowsProjection.find(row => row.rowId === input.rowId)
      ?? runtimeState.groupedRowsProjection.find(row => row.rowId === input.rowId)
    if (!pivotRow) {
      return null
    }
    const normalizedLimit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(5000, Math.trunc(input.limit as number)))
      : 200
    const rowConstraints = resolvePivotDrilldownRowConstraints(pivotRow, pivotModel.rows)
    const columnConstraints = pivotColumn.columnPath.map(segment => ({
      field: segment.field,
      value: segment.value,
    }))
    const matches: DataGridRowNode<T>[] = []
    let matchCount = 0
    for (const sourceRow of sourceRows) {
      if (sourceRow.kind !== "leaf") {
        continue
      }
      let rowMatches = true
      for (const constraint of rowConstraints) {
        if (normalizePivotAxisValue(readRowField(sourceRow, constraint.field)) !== constraint.value) {
          rowMatches = false
          break
        }
      }
      if (!rowMatches) {
        continue
      }
      let columnMatches = true
      for (const constraint of columnConstraints) {
        if (normalizePivotAxisValue(readRowField(sourceRow, constraint.field)) !== constraint.value) {
          columnMatches = false
          break
        }
      }
      if (!columnMatches) {
        continue
      }
      matchCount += 1
      if (matches.length < normalizedLimit) {
        matches.push(sourceRow)
      }
    }
    return {
      rowId: input.rowId,
      columnId,
      valueField: pivotColumn.valueField,
      agg: pivotColumn.agg,
      cellValue: readRowField(pivotRow, columnId),
      matchCount,
      truncated: matchCount > matches.length,
      rows: matches,
    }
  }

  function runFilterStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runFilterStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runFilterStage"]> {
    const result = runFilterProjectionStage({
      sourceRows,
      previousFilteredRowsProjection: runtimeState.filteredRowsProjection,
      sourceById: context.sourceById,
      shouldRecompute: context.shouldRecompute,
      filterPredicate: context.filterPredicate,
      resolveFilterPredicate,
    })
    runtimeState.filteredRowsProjection = result.filteredRowsProjection
    return {
      filteredRowIds: result.filteredRowIds,
      recomputed: result.recomputed,
    }
  }

  function runSortStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runSortStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runSortStage"]> {
    const counters = {
      hits: derivedCacheDiagnostics.sortValueHits,
      misses: derivedCacheDiagnostics.sortValueMisses,
    }
    const result = runSortProjectionStage({
      treeData,
      filterModel,
      sourceRows,
      filteredRowsProjection: runtimeState.filteredRowsProjection,
      previousSortedRowsProjection: runtimeState.sortedRowsProjection,
      shouldRecompute: context.shouldRecompute,
      sortModel,
      projectionPolicy,
      sortValueCache,
      sortValueCacheKey,
      rowVersionById,
      counters,
      readRowField,
    })
    runtimeState.sortedRowsProjection = result.sortedRowsProjection
    sortValueCacheKey = result.sortValueCacheKey
    derivedCacheDiagnostics.sortValueHits = counters.hits
    derivedCacheDiagnostics.sortValueMisses = counters.misses
    return result.recomputed
  }

  function runGroupStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runGroupStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runGroupStage"]> {
    const expansionSnapshot = getCurrentExpansionSnapshot()
    const expansionState = getActiveExpansionStateStore()
    const result = runGroupProjectionStage({
      shouldRecompute: context.shouldRecompute,
      sourceById: context.sourceById,
      rowMatchesFilter: context.rowMatchesFilter,
      treeData,
      pivotModelEnabled: Boolean(pivotModel),
      groupBy,
      filterModel,
      sourceRows,
      sortedRowsProjection: runtimeState.sortedRowsProjection,
      filteredRowsProjection: runtimeState.filteredRowsProjection,
      previousGroupedRowsProjection: runtimeState.groupedRowsProjection,
      expansionSnapshot,
      expansionToggledKeys: expansionState.toggledKeys,
      treeCacheRevision,
      rowRevision: runtimeState.rowRevision,
      groupRevision: runtimeState.groupRevision,
      filterRevision: runtimeState.filterRevision,
      sortRevision: runtimeState.sortRevision,
      projectionPolicy,
      groupValueCache,
      groupValueCacheKey,
      groupValueCounters: {
        hits: derivedCacheDiagnostics.groupValueHits,
        misses: derivedCacheDiagnostics.groupValueMisses,
      },
      treeProjectionRuntime,
      treePathProjectionCacheState,
      treeParentProjectionCacheState,
      lastTreeProjectionCacheKey,
      lastTreeExpansionSnapshot,
      groupedProjectionGroupIndexByRowId,
      aggregationModel,
      aggregationEngine,
      treeDataDiagnostics,
    })
    runtimeState.groupedRowsProjection = result.groupedRowsProjection
    groupValueCacheKey = result.groupValueCacheKey
    derivedCacheDiagnostics.groupValueHits = result.groupValueCounters.hits
    derivedCacheDiagnostics.groupValueMisses = result.groupValueCounters.misses
    groupedProjectionGroupIndexByRowId = result.groupedProjectionGroupIndexByRowId
    treePathProjectionCacheState = result.treePathProjectionCacheState
    treeParentProjectionCacheState = result.treeParentProjectionCacheState
    lastTreeProjectionCacheKey = result.lastTreeProjectionCacheKey
    lastTreeExpansionSnapshot = result.lastTreeExpansionSnapshot
    treeDataDiagnostics = result.treeDataDiagnostics
    return result.recomputed
  }

  function runPivotStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runPivotStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runPivotStage"]> {
    const result = runPivotProjectionStage({
      pivotModel,
      shouldRecompute: context.shouldRecompute,
      previousPivotedRowsProjection: runtimeState.pivotedRowsProjection,
      previousPivotColumns: pivotColumns,
      groupedRowsProjection: runtimeState.groupedRowsProjection,
      pendingValuePatchRows: pendingPivotValuePatch,
      pivotRuntime,
      normalizeFieldValue: normalizeText,
      expansionSnapshot: getCurrentExpansionSnapshot(),
    })
    runtimeState.pivotedRowsProjection = result.pivotedRowsProjection
    pivotColumns = result.pivotColumns
    return result.recomputed
  }

  function runPaginateStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runPaginateStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runPaginateStage"]> {
    const result = runPaginateProjectionStage({
      aggregatedRowsProjection: runtimeState.aggregatedRowsProjection,
      previousPaginatedRowsProjection: runtimeState.paginatedRowsProjection,
      sourceById: context.sourceById,
      shouldRecompute: context.shouldRecompute,
      paginationInput,
      currentPagination: pagination,
    })
    runtimeState.paginatedRowsProjection = result.paginatedRowsProjection
    pagination = result.pagination
    return result.recomputed
  }

  function runAggregateStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runAggregateStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runAggregateStage"]> {
    const result = runAggregateProjectionStage({
      shouldRecompute: context.shouldRecompute,
      sourceById: context.sourceById,
      previousAggregatedRowsProjection: runtimeState.aggregatedRowsProjection,
      groupedRowsProjection: runtimeState.groupedRowsProjection,
      pivotedRowsProjection: runtimeState.pivotedRowsProjection,
      sortedRowsProjection: runtimeState.sortedRowsProjection,
      sourceRows,
      sortModel,
      groupBy,
      pivotModelEnabled: Boolean(pivotModel),
      treeData,
      aggregationModel,
      aggregationEngine,
      groupByIncrementalAggregationState,
      resetGroupByIncrementalAggregationState,
      readRowField,
      normalizeText,
    })
    runtimeState.aggregatedRowsProjection = result.aggregatedRowsProjection
    return result.recomputed
  }

  function runVisibleStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runVisibleStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runVisibleStage"]> {
    const result = runVisibleProjectionStage({
      paginatedRowsProjection: runtimeState.paginatedRowsProjection,
      previousRows: runtimeState.rows,
      sourceById: context.sourceById,
      shouldRecompute: context.shouldRecompute,
      pivotEnabled: Boolean(pivotModel),
    })
    runtimeState.rows = result.rows
    return result.recomputed
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
    pendingPivotValuePatch = null
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

  function collectPivotAxisFields(activePivotModel: DataGridPivotSpec | null): Set<string> {
    const fields = new Set<string>()
    if (!activePivotModel) {
      return fields
    }
    for (const field of [...activePivotModel.rows, ...activePivotModel.columns]) {
      const normalized = field.trim()
      if (normalized.length > 0) {
        fields.add(normalized)
      }
    }
    return fields
  }

  function collectPivotValueFields(activePivotModel: DataGridPivotSpec | null): Set<string> {
    const fields = new Set<string>()
    if (!activePivotModel) {
      return fields
    }
    for (const valueSpec of activePivotModel.values) {
      const normalized = valueSpec.field.trim()
      if (normalized.length > 0) {
        fields.add(normalized)
      }
    }
    return fields
  }

  function getSnapshot(): DataGridRowModelSnapshot<T> {
    viewportRange = normalizeViewportRange(viewportRange, runtimeState.rows.length)
    const expansionSnapshot = getCurrentExpansionSnapshot()
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
      groupExpansion: expansionSnapshot,
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
      return {
        fields: pivotModel.rows.length > 0 ? pivotModel.rows : ["__pivot__"],
        expandedByDefault: pivotExpansionExpandedByDefault,
      }
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
    const expansionState = getActiveExpansionStateStore()
    const normalizedSnapshot = buildGroupExpansionSnapshot(
      {
        fields: expansionSpec.fields,
        expandedByDefault: nextExpansion?.expandedByDefault ?? expansionSpec.expandedByDefault,
      },
      nextExpansion?.toggledGroupKeys ?? [],
    )
    const currentSnapshot = buildGroupExpansionSnapshot(expansionSpec, expansionState.toggledKeys)
    if (isSameGroupExpansionSnapshot(currentSnapshot, normalizedSnapshot)) {
      return false
    }
    expansionState.setExpandedByDefault(normalizedSnapshot.expandedByDefault)
    expansionState.toggledKeys.clear()
    for (const groupKey of normalizedSnapshot.toggledGroupKeys) {
      expansionState.toggledKeys.add(groupKey)
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
      pendingPivotValuePatch = null
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
      const nextRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()
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
        const nextRow = {
          ...row,
          data: nextData,
          row: nextData,
        }
        nextRowsById.set(row.rowId, nextRow)
        return nextRow
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
      if (pivotModel && allowGroupRecompute) {
        const pivotAxisFields = collectPivotAxisFields(pivotModel)
        const pivotValueFields = collectPivotValueFields(pivotModel)
        const affectsPivotAxis = pivotAxisFields.size > 0
          && projectionPolicy.dependencyGraph.affectsAny(effectiveChangeSet.affectedFields, pivotAxisFields)
        const affectsPivotValues = pivotValueFields.size === 0
          ? false
          : projectionPolicy.dependencyGraph.affectsAny(effectiveChangeSet.affectedFields, pivotValueFields)
        const canApplyPivotValuePatch =
          affectsPivotValues &&
          !affectsPivotAxis &&
          !effectiveChangeSet.stageImpact.affectsFilter &&
          !effectiveChangeSet.stageImpact.affectsSort &&
          !staleStagesBeforeRequest.has("group") &&
          !staleStagesBeforeRequest.has("pivot")
        if (canApplyPivotValuePatch) {
          const changedRows: DataGridPivotIncrementalPatchRow<T>[] = []
          for (const changedRowId of changedRowIds) {
            const previousRow = previousRowsById.get(changedRowId)
            const nextRow = nextRowsById.get(changedRowId)
            if (!previousRow || !nextRow || previousRow.kind !== "leaf" || nextRow.kind !== "leaf") {
              continue
            }
            changedRows.push({
              previousRow,
              nextRow,
            })
          }
          if (changedRows.length > 0) {
            pendingPivotValuePatch = changedRows
          }
        }
      }
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
      pivotExpansionExpandedByDefault = true
      toggledPivotGroupKeys.clear()
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("pivot")
      emit()
    },
    getPivotModel() {
      return clonePivotSpec(pivotModel)
    },
    getPivotCellDrilldown(input: DataGridPivotCellDrilldownInput) {
      return resolvePivotCellDrilldown(input)
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
      const expansionState = getActiveExpansionStateStore()
      if (!toggleGroupExpansionKey(expansionState.toggledKeys, groupKey)) {
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
      const expansionState = getActiveExpansionStateStore()
      if (!setGroupExpansionKey(expansionState.toggledKeys, groupKey, expansionState.expandedByDefault, true)) {
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
      const expansionState = getActiveExpansionStateStore()
      if (!setGroupExpansionKey(expansionState.toggledKeys, groupKey, expansionState.expandedByDefault, false)) {
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
      const expansionState = getActiveExpansionStateStore()
      if (expansionState.expandedByDefault && expansionState.toggledKeys.size === 0) {
        return
      }
      expansionState.setExpandedByDefault(true)
      expansionState.toggledKeys.clear()
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
      const expansionState = getActiveExpansionStateStore()
      if (!expansionState.expandedByDefault && expansionState.toggledKeys.size === 0) {
        return
      }
      expansionState.setExpandedByDefault(false)
      expansionState.toggledKeys.clear()
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
      toggledPivotGroupKeys.clear()
      sortValueCache.clear()
      groupValueCache.clear()
      invalidateTreeProjectionCaches()
      cachedFilterPredicate = null
      cachedFilterPredicateKey = "__none__"
    },
  }
}
