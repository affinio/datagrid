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
  type DataGridComputedFieldDefinition,
  type DataGridComputedFieldSnapshot,
  type DataGridFormulaFieldDefinition,
  type DataGridFormulaFieldSnapshot,
  type DataGridFormulaComputeStageDiagnostics,
  type DataGridFormulaValue,
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
import {
  DATAGRID_NOOP_CLIENT_PROJECTION_COMPUTE_STAGE_EXECUTOR,
  type DataGridClientProjectionComputeStageExecutor,
} from "./clientRowProjectionComputeStage.js"
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
  hasActiveFilterModel,
  normalizeText,
  readRowField,
} from "./clientRowProjectionPrimitives.js"
import {
  applyRowDataPatch,
  bumpRowVersions,
  buildRowIdPositionIndex,
  buildRowIdIndex,
  createRowVersionIndex,
  mergeRowPatch,
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
import { createClientRowFormulaDiagnosticsRuntime } from "./clientRowFormulaDiagnosticsRuntime.js"
import { createClientRowSourceColumnCacheRuntime } from "./clientRowSourceColumnCacheRuntime.js"
import { createClientRowPatchComputedMergeRuntime } from "./clientRowPatchComputedMergeRuntime.js"
import {
  createClientRowComputedRegistryRuntime,
  type ClientRowComputedRegistryRuntime,
} from "./clientRowComputedRegistryRuntime.js"
import {
  createClientRowComputedExecutionRuntime,
  type ApplyComputedFieldsToSourceRowsOptions,
  type ApplyComputedFieldsToSourceRowsResult,
} from "./clientRowComputedExecutionRuntime.js"
import { createClientRowComputedBootstrapRuntime } from "./clientRowComputedBootstrap.js"
import {
  type DataGridFormulaFunctionDefinition,
  type DataGridFormulaFunctionRegistry,
} from "./formulaEngine.js"
import {
  snapshotDataGridFormulaExecutionPlan,
  type DataGridFormulaExecutionPlanSnapshot,
} from "./formulaExecutionPlan.js"

const DATAGRID_FORMULA_RUNTIME_ERRORS_PREVIEW_LIMIT = 50
const DATAGRID_COMPUTE_VECTOR_BATCH_SIZE = 1024
const DATAGRID_COLUMN_CACHE_VERIFY_FLAG = "__AFFINO_DATAGRID_VERIFY_COLUMN_CACHE__"
const DATAGRID_FORMULA_COLUMN_CACHE_NO_LIMIT = Number.POSITIVE_INFINITY

function isDataGridColumnCacheParityVerificationEnabled(): boolean {
  const globalRecord = globalThis as Record<string, unknown>
  return globalRecord[DATAGRID_COLUMN_CACHE_VERIFY_FLAG] === true
}

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
  initialComputedFields?: readonly DataGridComputedFieldDefinition<T>[]
  initialFormulaFields?: readonly DataGridFormulaFieldDefinition[]
  initialFormulaFunctionRegistry?: DataGridFormulaFunctionRegistry
  computeMode?: DataGridClientComputeMode
  computeTransport?: DataGridClientComputeTransport | null
  /**
   * Worker-mode patch routing threshold.
   * Execution-plan recomputes with `changedRowCount <= threshold` stay local;
   * larger patch plans dispatch through worker transport.
   * Default: `64`.
   */
  workerPatchDispatchThreshold?: number | null
  /**
   * Optional cap for formula source column-cache entries.
   * `null`/`undefined` keeps cache unlimited.
   */
  formulaColumnCacheMaxColumns?: number | null
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
  signal?: AbortSignal | null
}

export interface ClientRowModel<T> extends DataGridRowModel<T> {
  setRows(rows: readonly DataGridRowNodeInput<T>[]): void
  replaceRows(rows: readonly DataGridRowNodeInput<T>[]): void
  appendRows(rows: readonly DataGridRowNodeInput<T>[]): void
  prependRows(rows: readonly DataGridRowNodeInput<T>[]): void
  setSortAndFilterModel(input: DataGridSortAndFilterModelInput): void
  getColumnHistogram(columnId: string, options?: DataGridColumnHistogramOptions): DataGridColumnHistogram
  patchRows(
    updates: readonly DataGridClientRowPatch<T>[],
    options?: DataGridClientRowPatchOptions,
  ): void
  registerComputedField(definition: DataGridComputedFieldDefinition<T>): void
  getComputedFields(): readonly DataGridComputedFieldSnapshot[]
  recomputeComputedFields(rowIds?: readonly DataGridRowId[]): number
  registerFormulaField(definition: DataGridFormulaFieldDefinition): void
  getFormulaFields(): readonly DataGridFormulaFieldSnapshot[]
  registerFormulaFunction(
    name: string,
    definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[]) => unknown),
  ): void
  unregisterFormulaFunction(name: string): boolean
  getFormulaFunctionNames(): readonly string[]
  getFormulaExecutionPlan(): DataGridFormulaExecutionPlanSnapshot | null
  getFormulaComputeStageDiagnostics(): DataGridFormulaComputeStageDiagnostics | null
  reorderRows(input: DataGridClientRowReorderInput): boolean
  getComputeMode(): DataGridClientComputeMode
  switchComputeMode(mode: DataGridClientComputeMode): boolean
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
  sourceColumnCacheSize: number
  sourceColumnCacheLimit: number | null
  sourceColumnCacheEvictions: number
}

function normalizeFormulaColumnCacheMaxColumns(value: number | null | undefined): number {
  if (value === null || typeof value === "undefined") {
    return DATAGRID_FORMULA_COLUMN_CACHE_NO_LIMIT
  }
  const normalized = Math.trunc(value)
  if (!Number.isFinite(normalized) || normalized < 1) {
    throw new Error("[DataGridFormula] formulaColumnCacheMaxColumns must be >= 1 when provided.")
  }
  return normalized
}

function isDataGridRowId(value: unknown): value is DataGridRowId {
  return typeof value === "string" || typeof value === "number"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
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
  const formulaColumnCacheMaxColumns = normalizeFormulaColumnCacheMaxColumns(
    options.formulaColumnCacheMaxColumns,
  )
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
  let sourceRowIndexById = buildRowIdPositionIndex(sourceRows)
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
    sourceColumnCacheSize: 0,
    sourceColumnCacheLimit: Number.isFinite(formulaColumnCacheMaxColumns)
      ? formulaColumnCacheMaxColumns
      : null,
    sourceColumnCacheEvictions: 0,
  }
  let treeCacheRevision = 0
  let treePathProjectionCacheState: TreePathProjectionCacheState<T> | null = null
  let treeParentProjectionCacheState: TreeParentProjectionCacheState<T> | null = null
  const groupByIncrementalAggregationState = createGroupByIncrementalAggregationState()
  let groupedProjectionGroupIndexByRowId: ReadonlyMap<DataGridRowId, number> = new Map<DataGridRowId, number>()
  let lastTreeProjectionCacheKey: string | null = null
  let lastTreeExpansionSnapshot: DataGridGroupExpansionSnapshot | null = null
  let pendingPivotValuePatch: readonly DataGridPivotIncrementalPatchRow<T>[] | null = null
  const projectionEngine = createClientRowProjectionEngine<T>()
  const computedRegistryRef: { current: ClientRowComputedRegistryRuntime<T> | null } = {
    current: null,
  }
  const formulaDiagnosticsRuntime = createClientRowFormulaDiagnosticsRuntime({
    hasFormulaFields: () => computedRegistryRef.current?.hasFormulaFields() === true,
    hasComputedFields: () => computedRegistryRef.current?.hasComputedFields() === true,
    setProjectionFormulaDiagnostics: diagnostics => {
      runtimeStateStore.setProjectionFormulaDiagnostics(diagnostics)
    },
    runtimeErrorsPreviewLimit: DATAGRID_FORMULA_RUNTIME_ERRORS_PREVIEW_LIMIT,
  })
  const createEmptyFormulaDiagnostics = formulaDiagnosticsRuntime.createEmptyFormulaDiagnostics
  const createEmptyFormulaComputeStageDiagnostics = formulaDiagnosticsRuntime.createEmptyFormulaComputeStageDiagnostics
  const pushFormulaRuntimeError = formulaDiagnosticsRuntime.pushFormulaRuntimeError
  const commitFormulaDiagnostics = formulaDiagnosticsRuntime.commitFormulaDiagnostics
  const commitFormulaComputeStageDiagnostics = formulaDiagnosticsRuntime.commitFormulaComputeStageDiagnostics
  const getFormulaComputeStageDiagnosticsSnapshot = formulaDiagnosticsRuntime.getFormulaComputeStageDiagnosticsSnapshot
  const computedRegistry = createClientRowComputedRegistryRuntime<T>({
    projectionPolicy,
    initialFormulaFunctionRegistry: options.initialFormulaFunctionRegistry,
    onFormulaRuntimeError: pushFormulaRuntimeError,
    onComputedPlanChanged: () => {},
  })
  computedRegistryRef.current = computedRegistry
  const normalizeComputedName = computedRegistry.normalizeComputedName
  const normalizeComputedTargetField = computedRegistry.normalizeComputedTargetField

  const sourceColumnCacheRuntime = createClientRowSourceColumnCacheRuntime<T>({
    getSourceRows: () => sourceRows,
    getSourceRowIndexById: () => sourceRowIndexById,
    maxColumns: formulaColumnCacheMaxColumns,
    setCacheSize: (size) => {
      derivedCacheDiagnostics.sourceColumnCacheSize = size
    },
    incrementCacheEvictions: () => {
      derivedCacheDiagnostics.sourceColumnCacheEvictions += 1
    },
  })
  const clearSourceColumnValuesCache = (): void => {
    sourceColumnCacheRuntime.clear()
  }
  const getSourceColumnValues = (fieldInput: string): unknown[] => {
    return sourceColumnCacheRuntime.getFieldValues(fieldInput)
  }
  const invalidateSourceColumnValuesByRowIds = (
    rowIds: readonly DataGridRowId[],
  ): void => {
    sourceColumnCacheRuntime.invalidateByRowIds(rowIds)
  }
  const computedExecutionRuntime = createClientRowComputedExecutionRuntime<T>({
    vectorBatchSize: DATAGRID_COMPUTE_VECTOR_BATCH_SIZE,
    isRecord,
    isColumnCacheParityVerificationEnabled: isDataGridColumnCacheParityVerificationEnabled,
    getSourceRows: () => sourceRows,
    setSourceRows: (rows) => {
      sourceRows = rows
      sourceRowIndexById = buildRowIdPositionIndex(sourceRows)
    },
    resolveRowFieldReader: computedRegistry.resolveRowFieldReader,
    getComputedOrder: computedRegistry.getComputedOrder,
    getComputedEntryByIndex: computedRegistry.getComputedEntryByIndex,
    getComputedFieldReaderByIndex: computedRegistry.getComputedFieldReaderByIndex,
    getComputedLevelIndexes: computedRegistry.getComputedLevelIndexes,
    getComputedDependentsByIndex: computedRegistry.getComputedDependentsByIndex,
    getFormulaFieldsByName: computedRegistry.getFormulaFieldsByName,
    resolveComputedRootIndexes: computedRegistry.resolveComputedRootIndexes,
    resolveComputedTokenValue: computedRegistry.resolveComputedTokenValue,
    getSourceColumnValues,
    clearSourceColumnValuesCache,
    createEmptyFormulaDiagnostics,
    createEmptyFormulaComputeStageDiagnostics,
    withRuntimeErrorsCollector: formulaDiagnosticsRuntime.withRuntimeErrorsCollector,
  })
  const applyComputedFieldsToSourceRows = (
    options: ApplyComputedFieldsToSourceRowsOptions = {},
  ): ApplyComputedFieldsToSourceRowsResult<T> => {
    return computedExecutionRuntime.applyComputedFieldsToSourceRows(options)
  }
  const registerComputedFieldInternal = (
    definition: DataGridComputedFieldDefinition<T>,
  ): void => {
    computedRegistry.registerComputedFieldInternal(definition)
  }
  const registerFormulaFieldInternal = (
    definition: DataGridFormulaFieldDefinition,
    options: {
      knownComputedNames?: ReadonlySet<string>
      knownComputedNameByField?: ReadonlyMap<string, string>
    } = {},
  ): void => {
    computedRegistry.registerFormulaFieldInternal(definition, options)
  }
  const getComputedFieldSnapshots = (): readonly DataGridComputedFieldSnapshot[] => {
    return computedRegistry.getComputedFields()
  }
  const getFormulaFieldSnapshots = (): readonly DataGridFormulaFieldSnapshot[] => {
    return computedRegistry.getFormulaFields()
  }
  const formulaFieldsByName = computedRegistry.getFormulaFieldsByName()
  const computedBootstrapRuntime = createClientRowComputedBootstrapRuntime<T>({
    initialComputedFields: options.initialComputedFields,
    initialFormulaFields: options.initialFormulaFields,
    normalizeComputedName,
    normalizeComputedTargetField,
    resolveInitialComputedRegistrationOrder: computedRegistry.resolveInitialComputedRegistrationOrder,
    registerComputedFieldInternal,
    compileFormulaFieldDefinition: computedRegistry.compileFormulaFieldDefinition,
    registerFormulaFieldInternal,
    applyComputedFieldsToSourceRows: () => applyComputedFieldsToSourceRows(),
    commitFormulaDiagnostics,
    commitFormulaComputeStageDiagnostics,
    bumpRowVersions: (rowIds) => {
      bumpRowVersions(rowVersionById, rowIds)
    },
  })
  computedBootstrapRuntime.bootstrapInitialComputedAndFormulaFields()

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
      resolveNextRowById: (rowId) => {
        const rowIndex = sourceRowIndexById.get(rowId)
        if (typeof rowIndex !== "number" || rowIndex < 0 || rowIndex >= sourceRows.length) {
          return undefined
        }
        return sourceRows[rowIndex]
      },
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
    commitProjectionCycle: (meta) => {
      runtimeStateStore.commitProjectionCycle({
        hadActualRecompute: meta.hadActualRecompute,
        recomputedStages: meta.recomputedStages,
        blockedStages: meta.blockedStages,
      })
    },
    getSourceRows: () => sourceRows,
    buildSourceById: () => buildRowIdIndex(sourceRows),
    readRowField,
    normalizeText,
    computeStageExecutor: DATAGRID_NOOP_CLIENT_PROJECTION_COMPUTE_STAGE_EXECUTOR as DataGridClientProjectionComputeStageExecutor<T>,
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
  const computeTransport = options.computeTransport ?? null
  const workerPatchDispatchThreshold = options.workerPatchDispatchThreshold ?? null
  let computeMode: DataGridClientComputeMode = options.computeMode ?? "sync"
  let computeRuntime = createClientRowComputeRuntime({
    mode: computeMode,
    transport: computeTransport,
    workerPatchDispatchThreshold,
    orchestrator: projectionOrchestrator,
  })

  const snapshotRuntime = createClientRowSnapshotRuntime<T>({
    runtimeState,
    runtimeStateStore,
    getStaleStages: () => computeRuntime.getStaleStages(),
    getFormulaComputeStageDiagnostics: () => getFormulaComputeStageDiagnosticsSnapshot(),
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
    setProjectionInvalidation: (reasons) => {
      runtimeStateStore.setProjectionInvalidation(reasons)
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
    recomputeFromProjectionEntryStage: () => {
      computeRuntime.recomputeFromStage("compute")
    },
    applyComputedFields: () => {
      const computedResult = applyComputedFieldsToSourceRows()
      commitFormulaDiagnostics(computedResult.formulaDiagnostics)
      commitFormulaComputeStageDiagnostics(computedResult.computeStageDiagnostics)
      if (!computedResult.changed) {
        return
      }
      bumpRowVersions(rowVersionById, computedResult.changedRowIds)
    },
    setProjectionInvalidation: (reasons) => {
      runtimeStateStore.setProjectionInvalidation(reasons)
    },
    bumpRowRevision: () => {
      runtimeStateStore.bumpRowRevision()
    },
    resetGroupByIncrementalAggregationState,
    invalidateTreeProjectionCaches,
    getSourceRows: () => sourceRows,
    setSourceRows: (rows) => {
      sourceRows = rows
      sourceRowIndexById = buildRowIdPositionIndex(sourceRows)
      clearSourceColumnValuesCache()
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

  const patchComputedMergeRuntime = createClientRowPatchComputedMergeRuntime<T>({
    invalidateSourceColumnValuesByRowIds,
    isRecord,
    applyComputedFieldsToSourceRows,
    commitFormulaDiagnostics,
    commitFormulaComputeStageDiagnostics,
    mergeRowPatch,
    getSourceRows: () => sourceRows,
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
    getSourceRowIndexById: () => sourceRowIndexById,
    setSourceRows: (rows) => {
      sourceRows = rows as DataGridRowNode<T>[]
    },
    getRowVersionById: () => rowVersionById,
    bumpRowRevision: () => {
      runtimeStateStore.bumpRowRevision()
    },
    setProjectionInvalidation: (reasons) => {
      runtimeStateStore.setProjectionInvalidation(reasons)
    },
    applyComputedFieldsToPatchResult: patchComputedMergeRuntime.applyComputedFieldsToPatchResult,
    tryApplyFlatProjectionPatch: (changedRowIds, nextRowsById) => {
      if (
        hasActiveFilterModel(filterModel)
        || sortModel.length > 0
        || treeData !== null
        || groupBy !== null
        || pivotModel !== null
        || Boolean(aggregationModel && aggregationModel.columns.length > 0)
        || pagination.enabled
        || computeRuntime.getStaleStages().length > 0
      ) {
        return false
      }
      const sourceCount = sourceRows.length
      if (
        runtimeState.filteredRowsProjection.length !== sourceCount
        || runtimeState.sortedRowsProjection.length !== sourceCount
        || runtimeState.groupedRowsProjection.length !== sourceCount
        || runtimeState.pivotedRowsProjection.length !== sourceCount
        || runtimeState.aggregatedRowsProjection.length !== sourceCount
        || runtimeState.paginatedRowsProjection.length !== sourceCount
        || runtimeState.rows.length !== sourceCount
      ) {
        return false
      }

      const projectionRowsToPatch: DataGridRowNode<T>[][] = []
      const registerProjectionRows = (rows: readonly DataGridRowNode<T>[]) => {
        const mutableRows = rows as DataGridRowNode<T>[]
        if (!projectionRowsToPatch.includes(mutableRows)) {
          projectionRowsToPatch.push(mutableRows)
        }
      }
      registerProjectionRows(runtimeState.filteredRowsProjection)
      registerProjectionRows(runtimeState.sortedRowsProjection)
      registerProjectionRows(runtimeState.groupedRowsProjection)
      registerProjectionRows(runtimeState.pivotedRowsProjection)
      registerProjectionRows(runtimeState.aggregatedRowsProjection)
      registerProjectionRows(runtimeState.paginatedRowsProjection)
      registerProjectionRows(runtimeState.rows)

      for (const rowId of changedRowIds) {
        const position = sourceRowIndexById.get(rowId) ?? -1
        if (position < 0 || position >= sourceCount) {
          continue
        }
        const nextRow = nextRowsById.get(rowId)
        if (!nextRow) {
          continue
        }
        for (const projectionRows of projectionRowsToPatch) {
          const currentRow = projectionRows[position]
          if (!currentRow || (currentRow.data === nextRow.data && currentRow.row === nextRow.row)) {
            continue
          }
          projectionRows[position] = {
            ...currentRow,
            data: nextRow.data,
            row: nextRow.row,
          }
        }
      }

      runtimeStateStore.commitProjectionCycle(false)
      derivedCacheDiagnostics.revisions.row = runtimeState.rowRevision
      derivedCacheDiagnostics.revisions.sort = runtimeState.sortRevision
      derivedCacheDiagnostics.revisions.filter = runtimeState.filterRevision
      derivedCacheDiagnostics.revisions.group = runtimeState.groupRevision
      return true
    },
    getStaleStages: () => computeRuntime.getStaleStages(),
    recomputeWithExecutionPlan: (executionPlan, requestOptions) => {
      computeRuntime.recomputeWithExecutionPlan(executionPlan, requestOptions)
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

  const recomputeComputedFieldsAndRefresh = (
    rowIds?: ReadonlySet<DataGridRowId>,
  ): number => {
    const computedResult = applyComputedFieldsToSourceRows({
      rowIds,
    })
    commitFormulaDiagnostics(computedResult.formulaDiagnostics)
    commitFormulaComputeStageDiagnostics(computedResult.computeStageDiagnostics)
    if (!computedResult.changed) {
      return 0
    }
    bumpRowVersions(rowVersionById, computedResult.changedRowIds)
    runtimeStateStore.bumpRowRevision()
    resetGroupByIncrementalAggregationState()
    invalidateTreeProjectionCaches()
    runtimeStateStore.setProjectionInvalidation(["computedChanged"])
    computeRuntime.recomputeFromStage("compute")
    emit()
    return computedResult.changedRowIds.length
  }

  runtimeStateStore.setProjectionInvalidation(["rowsChanged"])
  computeRuntime.recomputeFromStage("compute")

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
    replaceRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      rowsMutationsRuntime.setRows(nextRows)
    },
    appendRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      if (nextRows.length === 0) {
        return
      }
      rowsMutationsRuntime.setRows([...sourceRows, ...nextRows])
    },
    prependRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      if (nextRows.length === 0) {
        return
      }
      rowsMutationsRuntime.setRows([...nextRows, ...sourceRows])
    },
    patchRows(
      updates: readonly DataGridClientRowPatch<T>[],
      options: DataGridClientRowPatchOptions = {},
    ) {
      patchCoordinatorRuntime.patchRows(updates, options)
    },
    registerComputedField(definition: DataGridComputedFieldDefinition<T>) {
      ensureActive()
      registerComputedFieldInternal(definition)
      void recomputeComputedFieldsAndRefresh()
    },
    registerFormulaField(definition: DataGridFormulaFieldDefinition) {
      ensureActive()
      registerFormulaFieldInternal(definition)
      void recomputeComputedFieldsAndRefresh()
    },
    getComputedFields() {
      return getComputedFieldSnapshots()
    },
    getFormulaFields() {
      return getFormulaFieldSnapshots()
    },
    registerFormulaFunction(
      name: string,
      definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[]) => unknown),
    ) {
      ensureActive()
      computedRegistry.registerFormulaFunction(name, definition)
      if (formulaFieldsByName.size > 0) {
        void recomputeComputedFieldsAndRefresh()
      }
    },
    unregisterFormulaFunction(name: string) {
      ensureActive()
      const unregistered = computedRegistry.unregisterFormulaFunction(name)
      if (!unregistered) {
        return false
      }
      if (formulaFieldsByName.size > 0) {
        void recomputeComputedFieldsAndRefresh()
      }
      return true
    },
    getFormulaFunctionNames() {
      return computedRegistry.getFormulaFunctionNames()
    },
    getFormulaExecutionPlan() {
      const computedExecutionPlan = computedRegistry.getComputedExecutionPlan()
      if (computedExecutionPlan.order.length === 0) {
        return null
      }
      return snapshotDataGridFormulaExecutionPlan(computedExecutionPlan)
    },
    getFormulaComputeStageDiagnostics() {
      return getFormulaComputeStageDiagnosticsSnapshot()
    },
    recomputeComputedFields(rowIds?: readonly DataGridRowId[]) {
      ensureActive()
      const normalizedRowIds = Array.isArray(rowIds)
        ? rowIds.filter(isDataGridRowId)
        : []
      return recomputeComputedFieldsAndRefresh(
        normalizedRowIds.length > 0 ? new Set<DataGridRowId>(normalizedRowIds) : undefined,
      )
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
    refresh(reason?: DataGridRowModelRefreshReason) {
      ensureActive()
      runtimeStateStore.setProjectionInvalidation(
        reason === "sort-change" ? ["sortChanged"] : ["manualRefresh"],
      )
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
        sourceColumnCacheSize: derivedCacheDiagnostics.sourceColumnCacheSize,
        sourceColumnCacheLimit: derivedCacheDiagnostics.sourceColumnCacheLimit,
        sourceColumnCacheEvictions: derivedCacheDiagnostics.sourceColumnCacheEvictions,
      }
    },
    getComputeMode() {
      return computeMode
    },
    switchComputeMode(nextMode: DataGridClientComputeMode) {
      const normalizedMode: DataGridClientComputeMode = nextMode === "worker" ? "worker" : "sync"
      if (normalizedMode === computeMode) {
        return false
      }
      const previousRuntime = computeRuntime
      computeMode = normalizedMode
      computeRuntime = createClientRowComputeRuntime({
        mode: computeMode,
        transport: computeTransport,
        workerPatchDispatchThreshold,
        orchestrator: projectionOrchestrator,
      })
      previousRuntime.dispose()
      return true
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
      clearSourceColumnValuesCache()
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
      groupedProjectionGroupIndexByRowId = new Map<DataGridRowId, number>()
      toggledPivotGroupKeys.clear()
      sortValueCache.clear()
      groupValueCache.clear()
      computedRegistry.clear()
      computedRegistryRef.current = null
      formulaDiagnosticsRuntime.commitFormulaComputeStageDiagnostics(
        createEmptyFormulaComputeStageDiagnostics(),
      )
      runtimeStateStore.setProjectionFormulaDiagnostics(null)
      invalidateTreeProjectionCaches()
      cachedFilterPredicate = null
      cachedFilterPredicateKey = "__none__"
    },
  }
}
