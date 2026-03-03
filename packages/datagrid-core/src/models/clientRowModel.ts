import {
  buildPaginationSnapshot,
  cloneGroupBySpec,
  clonePivotSpec,
  normalizeRowNode,
  normalizeGroupBySpec,
  normalizePaginationInput,
  normalizePivotSpec,
  normalizeTreeDataSpec,
  normalizeViewportRange,
  withResolvedRowIdentity,
  type DataGridGroupExpansionSnapshot,
  type DataGridPaginationInput,
  type DataGridPivotCellDrilldownInput,
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
  expandClientProjectionStages,
} from "./clientRowProjectionEngine.js"
import { createClientRowProjectionOrchestrator } from "./clientRowProjectionOrchestrator.js"
import { DATAGRID_CLIENT_ALL_PROJECTION_STAGES } from "./projectionStages.js"
import {
  createClientRowComputeRuntime,
  type DataGridClientComputeDiagnostics,
  type DataGridClientComputeMode,
  type DataGridClientComputeTransport,
} from "./clientRowComputeRuntime.js"
import {
  createDataGridAggregationEngine,
} from "./aggregationEngine.js"
import {
  cloneDataGridFilterSnapshot as cloneFilterSnapshot,
} from "./advancedFilter.js"
import {
  type DataGridPatchChangeSet,
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
  normalizeText,
  readRowField,
} from "./clientRowProjectionPrimitives.js"
import {
  applyRowDataPatch,
  buildRowIdIndex,
  createRowVersionIndex,
  pruneSortCacheRows,
  rebuildRowVersionIndex,
  reindexSourceRows,
} from "./clientRowRuntimeUtils.js"
import type { SortValueCacheEntry } from "./clientRowProjectionBasicStages.js"
import type { DataGridFieldDependency } from "./dependencyGraph.js"
import { resolveClientRowPivotCellDrilldown } from "./clientRowPivotDrilldownRuntime.js"
import {
  applyClientRowGroupExpansion,
  resolveClientRowExpansionSnapshot,
  resolveClientRowExpansionSpec,
  resolveClientRowExpansionStateStore,
} from "./clientRowExpansionRuntime.js"
import { createClientRowRowsMutationsRuntime } from "./clientRowRowsMutationsRuntime.js"
import { createClientRowPatchCoordinatorRuntime } from "./clientRowPatchCoordinatorRuntime.js"
import { createClientRowStateMutationsRuntime } from "./clientRowStateMutationsRuntime.js"
import { createClientRowSnapshotRuntime } from "./clientRowSnapshotRuntime.js"
import { createClientRowProjectionHandlersRuntime } from "./clientRowProjectionHandlersRuntime.js"

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
  computeMode?: DataGridClientComputeMode
  computeTransport?: DataGridClientComputeTransport | null
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
  getComputeDiagnostics(): DataGridClientComputeDiagnostics
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
    changeSet: DataGridPatchChangeSet,
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

  function getActiveExpansionStateStore(): {
    expandedByDefault: boolean
    toggledKeys: Set<string>
    setExpandedByDefault: (value: boolean) => void
  } {
    return resolveClientRowExpansionStateStore({
      pivotModel,
      treeDataEnabled: Boolean(treeData),
      expansionExpandedByDefault,
      pivotExpansionExpandedByDefault,
      toggledGroupKeys,
      toggledPivotGroupKeys,
      setExpansionExpandedByDefault: (value: boolean) => {
        expansionExpandedByDefault = value
      },
      setPivotExpansionExpandedByDefault: (value: boolean) => {
        pivotExpansionExpandedByDefault = value
      },
    })
  }

  function getCurrentExpansionSnapshot(): DataGridGroupExpansionSnapshot {
    const expansionSpec = getExpansionSpec()
    const expansionState = getActiveExpansionStateStore()
    return resolveClientRowExpansionSnapshot({
      expansionSpec,
      expansionState,
    })
  }

  const projectionHandlersRuntime = createClientRowProjectionHandlersRuntime<T>({
    runtimeState,
    commitProjectionCycle: (hadActualRecompute) => {
      runtimeStateStore.commitProjectionCycle(hadActualRecompute)
    },
    getSourceRows: () => sourceRows,
    buildSourceById: () => buildRowIdIndex(sourceRows),
    readRowField,
    normalizeText,
    resolveFilterPredicate,
    getTreeData: () => treeData,
    getFilterModel: () => filterModel,
    getSortModel: () => sortModel,
    getGroupBy: () => groupBy,
    getPivotModel: () => pivotModel,
    getAggregationModel: () => aggregationModel,
    getProjectionPolicy: () => projectionPolicy,
    getRowVersionById: () => rowVersionById,
    getTreeCacheRevision: () => treeCacheRevision,
    getPaginationInput: () => paginationInput,
    setPaginationInput: (nextPaginationInput) => {
      paginationInput = nextPaginationInput
    },
    getPagination: () => pagination,
    setPagination: (nextPagination) => {
      pagination = nextPagination
    },
    getViewportRange: () => viewportRange,
    setViewportRange: (range) => {
      viewportRange = range
    },
    normalizeViewportRange,
    getSortValueCacheKey: () => sortValueCacheKey,
    setSortValueCacheKey: (key) => {
      sortValueCacheKey = key
    },
    sortValueCache,
    getGroupValueCacheKey: () => groupValueCacheKey,
    setGroupValueCacheKey: (key) => {
      groupValueCacheKey = key
    },
    groupValueCache,
    getGroupedProjectionGroupIndexByRowId: () => groupedProjectionGroupIndexByRowId,
    setGroupedProjectionGroupIndexByRowId: (index) => {
      groupedProjectionGroupIndexByRowId = index
    },
    getTreePathProjectionCacheState: () => treePathProjectionCacheState,
    setTreePathProjectionCacheState: (state) => {
      treePathProjectionCacheState = state
    },
    getTreeParentProjectionCacheState: () => treeParentProjectionCacheState,
    setTreeParentProjectionCacheState: (state) => {
      treeParentProjectionCacheState = state
    },
    getLastTreeProjectionCacheKey: () => lastTreeProjectionCacheKey,
    setLastTreeProjectionCacheKey: (key) => {
      lastTreeProjectionCacheKey = key
    },
    getLastTreeExpansionSnapshot: () => lastTreeExpansionSnapshot,
    setLastTreeExpansionSnapshot: (snapshot) => {
      lastTreeExpansionSnapshot = snapshot
    },
    getTreeDataDiagnostics: () => treeDataDiagnostics,
    setTreeDataDiagnostics: (diagnostics) => {
      treeDataDiagnostics = diagnostics
    },
    getPivotColumns: () => pivotColumns,
    setPivotColumns: (columns) => {
      pivotColumns = columns
    },
    getPendingPivotValuePatch: () => pendingPivotValuePatch,
    setPendingPivotValuePatch: (rows) => {
      pendingPivotValuePatch = rows
    },
    getCurrentExpansionSnapshot: () => getCurrentExpansionSnapshot(),
    getExpansionToggledKeys: () => getActiveExpansionStateStore().toggledKeys,
    derivedCacheDiagnostics,
    treeProjectionRuntime,
    pivotRuntime,
    aggregationEngine,
    groupByIncrementalAggregationState,
    resetGroupByIncrementalAggregationState,
  })

  const projectionOrchestrator = createClientRowProjectionOrchestrator(
    projectionEngine,
    projectionHandlersRuntime.projectionStageHandlers,
  )
  const computeRuntime = createClientRowComputeRuntime({
    mode: options.computeMode,
    transport: options.computeTransport ?? null,
    orchestrator: projectionOrchestrator,
  })

  const snapshotRuntime = createClientRowSnapshotRuntime<T>({
    runtimeState,
    runtimeStateStore,
    getStaleStages: () => computeRuntime.getStaleStages(),
    getViewportRange: () => viewportRange,
    setViewportRange: (range) => {
      viewportRange = range
    },
    normalizeViewportRange,
    getPagination: () => pagination,
    getSortModel: () => sortModel,
    cloneSortModel,
    getFilterModel: () => filterModel,
    cloneFilterModel,
    isTreeDataEnabled: () => Boolean(treeData),
    getTreeDataDiagnostics: () => treeDataDiagnostics,
    cloneTreeDataDiagnostics: (diagnostics) => createEmptyTreeDataDiagnostics(diagnostics ?? undefined),
    getGroupBy: () => groupBy,
    cloneGroupBySpec,
    getPivotModel: () => pivotModel,
    clonePivotSpec,
    getPivotColumns: () => pivotColumns,
    normalizePivotColumns: (columns) => pivotRuntime.normalizeColumns(columns),
    getExpansionSnapshot: () => getCurrentExpansionSnapshot(),
  })

  const getSnapshot = (): DataGridRowModelSnapshot<T> => snapshotRuntime.getSnapshot()

  function emit() {
    lifecycle.emit(getSnapshot)
  }

  function getExpansionSpec(): DataGridGroupBySpec | null {
    return resolveClientRowExpansionSpec({
      treeDataEnabled: Boolean(treeData),
      pivotModel,
      groupBy,
      expansionExpandedByDefault,
      pivotExpansionExpandedByDefault,
    })
  }

  function applyGroupExpansion(nextExpansion: DataGridGroupExpansionSnapshot | null): boolean {
    const expansionSpec = getExpansionSpec()
    if (!expansionSpec) {
      return false
    }
    return applyClientRowGroupExpansion({
      nextExpansion,
      expansionSpec,
      expansionState: getActiveExpansionStateStore(),
    })
  }

  const stateMutationsRuntime = createClientRowStateMutationsRuntime<T>({
    ensureActive,
    emit,
    recomputeFromStage: (stage) => {
      computeRuntime.recomputeFromStage(stage)
    },
    bumpSortRevision: () => {
      runtimeStateStore.bumpSortRevision()
    },
    bumpFilterRevision: () => {
      runtimeStateStore.bumpFilterRevision()
    },
    bumpGroupRevision: () => {
      runtimeStateStore.bumpGroupRevision()
    },
    getRuntimeRowCount: () => runtimeState.rows.length,
    getViewportRange: () => viewportRange,
    setViewportRange: (range) => {
      viewportRange = range
    },
    getPaginationInput: () => paginationInput,
    setPaginationInput: (nextPaginationInput) => {
      paginationInput = nextPaginationInput
    },
    getSortModel: () => sortModel,
    setSortModel: (nextSortModel) => {
      sortModel = nextSortModel
    },
    cloneSortModel,
    getFilterModel: () => filterModel,
    setFilterModel: (nextFilterModel) => {
      filterModel = nextFilterModel
    },
    cloneFilterModel,
    isTreeDataEnabled: () => Boolean(treeData),
    getGroupBy: () => groupBy,
    setGroupBy: (nextGroupBy) => {
      groupBy = nextGroupBy
    },
    setExpansionExpandedByDefault: (value) => {
      expansionExpandedByDefault = value
    },
    clearToggledGroupKeys: () => {
      toggledGroupKeys.clear()
    },
    getPivotModel: () => pivotModel,
    setPivotModel: (nextPivotModel) => {
      pivotModel = nextPivotModel
    },
    resetPivotColumns: () => {
      pivotColumns = []
    },
    setPivotExpansionExpandedByDefault: (value) => {
      pivotExpansionExpandedByDefault = value
    },
    clearToggledPivotGroupKeys: () => {
      toggledPivotGroupKeys.clear()
    },
    getAggregationModel: () => aggregationModel,
    setAggregationModel: (nextAggregationModel) => {
      aggregationModel = nextAggregationModel
    },
    invalidateTreeProjectionCaches,
    applyGroupExpansion,
    getExpansionSpec,
    getActiveExpansionStateStore,
  })

  const rowsMutationsRuntime = createClientRowRowsMutationsRuntime<T>({
    ensureActive,
    emit,
    recomputeFromFilterStage: () => {
      computeRuntime.recomputeFromStage("filter")
    },
    bumpRowRevision: () => {
      runtimeStateStore.bumpRowRevision()
    },
    resetGroupByIncrementalAggregationState,
    invalidateTreeProjectionCaches,
    getSourceRows: () => sourceRows,
    setSourceRows: (rows) => {
      sourceRows = rows
    },
    normalizeSourceRows,
    reindexSourceRows,
    getRowVersionById: () => rowVersionById,
    setRowVersionById: (index) => {
      rowVersionById = index
    },
    rebuildRowVersionIndex,
    pruneSortCacheRows: (rows) => {
      pruneSortCacheRows(sortValueCache, rows)
    },
  })

  const patchCoordinatorRuntime = createClientRowPatchCoordinatorRuntime<T>({
    ensureActive,
    emit,
    setPendingPivotValuePatch: (patch) => {
      pendingPivotValuePatch = patch
    },
    isDataGridRowId,
    applyRowDataPatch,
    getSourceRows: () => sourceRows,
    setSourceRows: (rows) => {
      sourceRows = [...rows]
    },
    getRowVersionById: () => rowVersionById,
    bumpRowRevision: () => {
      runtimeStateStore.bumpRowRevision()
    },
    getStaleStages: () => computeRuntime.getStaleStages(),
    recomputeWithExecutionPlan: (executionPlan) => {
      computeRuntime.recomputeWithExecutionPlan(executionPlan)
    },
    getFilterModel: () => filterModel,
    getSortModel: () => sortModel,
    getTreeData: () => treeData,
    getGroupBy: () => groupBy,
    getPivotModel: () => pivotModel,
    getAggregationModel: () => aggregationModel,
    getProjectionPolicy: () => projectionPolicy,
    getAllStages: () => DATAGRID_CLIENT_ALL_PROJECTION_STAGES,
    expandStages: expandClientProjectionStages,
    applyIncrementalAggregationPatch,
    clearSortValueCache: () => {
      sortValueCache.clear()
    },
    evictSortValueCacheRows: (rowIds) => {
      for (const rowId of rowIds) {
        sortValueCache.delete(rowId)
      }
    },
    invalidateTreeProjectionCaches,
    patchTreeProjectionCacheRowsByIdentity,
  })

  computeRuntime.recomputeFromStage("filter")

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
      rowsMutationsRuntime.setRows(nextRows)
    },
    patchRows(
      updates: readonly DataGridClientRowPatch<T>[],
      options: DataGridClientRowPatchOptions = {},
    ) {
      patchCoordinatorRuntime.patchRows(updates, options)
    },
    reorderRows(input: DataGridClientRowReorderInput) {
      return rowsMutationsRuntime.reorderRows(input)
    },
    setViewportRange(range: DataGridViewportRange) {
      stateMutationsRuntime.setViewportRange(range)
    },
    setPagination(nextPagination: DataGridPaginationInput | null) {
      stateMutationsRuntime.setPagination(nextPagination)
    },
    setPageSize(pageSize: number | null) {
      stateMutationsRuntime.setPageSize(pageSize)
    },
    setCurrentPage(page: number) {
      stateMutationsRuntime.setCurrentPage(page)
    },
    setSortModel(nextSortModel: readonly DataGridSortState[]) {
      stateMutationsRuntime.setSortModel(nextSortModel)
    },
    setFilterModel(nextFilterModel: DataGridFilterSnapshot | null) {
      stateMutationsRuntime.setFilterModel(nextFilterModel)
    },
    setSortAndFilterModel(input: DataGridSortAndFilterModelInput) {
      stateMutationsRuntime.setSortAndFilterModel(input)
    },
    setGroupBy(nextGroupBy: DataGridGroupBySpec | null) {
      stateMutationsRuntime.setGroupBy(nextGroupBy)
    },
    setPivotModel(nextPivotModel: DataGridPivotSpec | null) {
      stateMutationsRuntime.setPivotModel(nextPivotModel)
    },
    getPivotModel() {
      return clonePivotSpec(pivotModel)
    },
    getPivotCellDrilldown(input: DataGridPivotCellDrilldownInput) {
      ensureActive()
      return resolveClientRowPivotCellDrilldown({
        input,
        pivotModel,
        pivotColumns,
        aggregatedRowsProjection: runtimeState.aggregatedRowsProjection,
        pivotedRowsProjection: runtimeState.pivotedRowsProjection,
        groupedRowsProjection: runtimeState.groupedRowsProjection,
        sourceRows,
        isDataGridRowId,
        normalizePivotAxisValue,
        readRowField: (row, key) => readRowField(row, key),
      })
    },
    setAggregationModel(nextAggregationModel: DataGridAggregationModel<T> | null) {
      stateMutationsRuntime.setAggregationModel(nextAggregationModel)
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
      stateMutationsRuntime.setGroupExpansion(expansion)
    },
    toggleGroup(groupKey: string) {
      stateMutationsRuntime.toggleGroup(groupKey)
    },
    expandGroup(groupKey: string) {
      stateMutationsRuntime.expandGroup(groupKey)
    },
    collapseGroup(groupKey: string) {
      stateMutationsRuntime.collapseGroup(groupKey)
    },
    expandAllGroups() {
      stateMutationsRuntime.expandAllGroups()
    },
    collapseAllGroups() {
      stateMutationsRuntime.collapseAllGroups()
    },
    refresh(_reason?: DataGridRowModelRefreshReason) {
      ensureActive()
      computeRuntime.refresh()
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
    getComputeDiagnostics() {
      return computeRuntime.getDiagnostics()
    },
    dispose() {
      if (!lifecycle.dispose()) {
        return
      }
      computeRuntime.dispose()
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
