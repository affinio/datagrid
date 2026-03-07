import {
  buildPaginationSnapshot,
  cloneGroupBySpec,
  normalizeRowNode,
  normalizeGroupBySpec,
  normalizePaginationInput,
  normalizeTreeDataSpec,
  normalizeViewportRange,
  withResolvedRowIdentity,
  type DataGridGroupExpansionSnapshot,
  type DataGridPaginationInput,
  type DataGridComputedFieldDefinition,
  type DataGridComputedFieldSnapshot,
  type DataGridFormulaCyclePolicy,
  type DataGridFormulaContextRecomputeRequest,
  type DataGridFormulaFieldDefinition,
  type DataGridFormulaFieldSnapshot,
  type DataGridFormulaComputeStageDiagnostics,
  type DataGridFormulaIterativeCalculationOptions,
  type DataGridFormulaRowRecomputeDiagnostics,
  type DataGridFormulaValue,
  type DataGridColumnHistogram,
  type DataGridColumnHistogramOptions,
  type DataGridFilterSnapshot,
  type DataGridSortAndFilterModelInput,
  type DataGridAggregationModel,
  type DataGridGroupBySpec,
  type DataGridProjectionFormulaDiagnostics,
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
  clonePivotSpec,
  normalizePivotSpec,
} from "@affino/datagrid-pivot"
import type {
  DataGridPivotCellDrilldownInput,
  DataGridPivotColumn,
  DataGridPivotSpec,
} from "@affino/datagrid-pivot"
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
  createClientRowComputedSnapshotRuntime,
  type ClientRowComputedRowBoundSnapshot,
} from "./clientRowComputedSnapshotRuntime.js"
import {
  createClientRowComputedRegistryRuntime,
  type ClientRowComputedRegistryRuntime,
} from "./clientRowComputedRegistryRuntime.js"
import { createCompiledDataGridRowDataReader } from "./clientRowComputedRegistryTokenResolverRuntime.js"
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
  snapshotDataGridFormulaGraph,
  snapshotDataGridFormulaExecutionPlan,
  type DataGridFormulaGraphSnapshot,
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
  formulaCyclePolicy?: DataGridFormulaCyclePolicy
  formulaIterativeCalculation?: DataGridFormulaIterativeCalculationOptions
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
  /**
   * Captures verbose per-row formula recompute diagnostics.
   * Disable for benchmarks or perf runs to reduce transient allocations.
   * Default: `true`.
   */
  captureFormulaRowRecomputeDiagnostics?: boolean
  /**
   * Captures formula explain diagnostics (dirty causes per node/row).
   * Disable for benchmarks or perf runs to reduce bookkeeping overhead.
   * Default: `true`.
   */
  captureFormulaExplainDiagnostics?: boolean
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

export interface DataGridCalculationSnapshotRestoreOptions {
  emit?: boolean
  rowBindingPolicy?: "strict" | "reconcile"
}

export interface DataGridCalculationSnapshot<T = unknown> {
  kind: "client-calculation"
  rowIds: readonly DataGridRowId[]
  computedSnapshot: ClientRowComputedRowBoundSnapshot
  modelSnapshot: DataGridRowModelSnapshot<T>
  aggregationModel: DataGridAggregationModel<T> | null
  formulaComputeStage: DataGridFormulaComputeStageDiagnostics | null
  formulaRowRecompute: DataGridFormulaRowRecomputeDiagnostics | null
}

export interface DataGridCalculationHistoryEntry<T = unknown> {
  id: number
  label: string | null
  snapshot: DataGridCalculationSnapshot<T>
}

export interface DataGridCalculationHistory<T = unknown> {
  index: number
  entries: readonly DataGridCalculationHistoryEntry<T>[]
}

export interface DataGridCalculationSnapshotInspection {
  rowBindingPolicy: "strict" | "reconcile"
  restorable: boolean
  fullyBound: boolean
  reordered: boolean
  snapshotRowCount: number
  currentRowCount: number
  matchedRowCount: number
  missingRowIds: readonly DataGridRowId[]
  extraRowIds: readonly DataGridRowId[]
  computedFields: readonly string[]
  overlayValueCounts: Readonly<Record<string, number>>
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
  recomputeFormulaContext(request: DataGridFormulaContextRecomputeRequest): number
  registerFormulaFunction(
    name: string,
    definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[]) => unknown),
  ): void
  unregisterFormulaFunction(name: string): boolean
  getFormulaFunctionNames(): readonly string[]
  getFormulaExecutionPlan(): DataGridFormulaExecutionPlanSnapshot | null
  getFormulaGraph(): DataGridFormulaGraphSnapshot | null
  getFormulaComputeStageDiagnostics(): DataGridFormulaComputeStageDiagnostics | null
  getFormulaRowRecomputeDiagnostics(): DataGridFormulaRowRecomputeDiagnostics | null
  reorderRows(input: DataGridClientRowReorderInput): boolean
  createCalculationSnapshot(): DataGridCalculationSnapshot<T>
  restoreCalculationSnapshot(
    snapshot: DataGridCalculationSnapshot<T>,
    options?: DataGridCalculationSnapshotRestoreOptions,
  ): boolean
  inspectCalculationSnapshot(
    snapshot: DataGridCalculationSnapshot<T>,
    options?: Pick<DataGridCalculationSnapshotRestoreOptions, "rowBindingPolicy">,
  ): DataGridCalculationSnapshotInspection
  pushCalculationSnapshot(label?: string): DataGridCalculationHistoryEntry<T>
  undoCalculationSnapshot(options?: DataGridCalculationSnapshotRestoreOptions): boolean
  redoCalculationSnapshot(options?: DataGridCalculationSnapshotRestoreOptions): boolean
  getCalculationSnapshotHistory(): DataGridCalculationHistory<T>
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
  const captureFormulaRowRecomputeDiagnostics = options.captureFormulaRowRecomputeDiagnostics !== false
  const captureFormulaExplainDiagnostics = options.captureFormulaExplainDiagnostics !== false
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
    const cloneRowData = (value: T): T => {
      if (!isRecord(value)) {
        return value
      }
      const clone = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>
      Object.defineProperties(clone, Object.getOwnPropertyDescriptors(value))
      return clone as T
    }
    const normalized = Array.isArray(inputRows)
      ? reindexSourceRows(inputRows.map((row, index) => {
          const normalizedRow = normalizeRowNode(withResolvedRowIdentity(row, index, resolveRowId), index)
          const isolatedRowData = cloneRowData(normalizedRow.data)
          return {
            ...normalizedRow,
            data: isolatedRowData,
            row: isolatedRowData,
          }
        }))
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

  let baseSourceRows: DataGridRowNode<T>[] = normalizeSourceRows(options.rows ?? [])
  let sourceRows: readonly DataGridRowNode<T>[] = baseSourceRows
  let sourceRowIndexById = buildRowIdPositionIndex(baseSourceRows)
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
  const pivotRuntime = createPivotRuntime<T>({
    readRowField: (row, key, field) => readProjectionRowField(row, key, field),
  })
  const treeProjectionRuntime = createTreeProjectionRuntime<T>({
    resolveTreeDataRow: (rowNode) => computedSnapshotRuntime.materializeRow(rowNode).data,
  })
  const aggregationEngine = createDataGridAggregationEngine<T>(aggregationModel, {
    readRowField: (row, key, field) => readProjectionRowField(row, key, field),
  })
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
  const commitFormulaRowRecomputeDiagnostics = formulaDiagnosticsRuntime.commitFormulaRowRecomputeDiagnostics
  const getFormulaComputeStageDiagnosticsSnapshot = formulaDiagnosticsRuntime.getFormulaComputeStageDiagnosticsSnapshot
  const getFormulaRowRecomputeDiagnosticsSnapshot = formulaDiagnosticsRuntime.getFormulaRowRecomputeDiagnosticsSnapshot
  const formulaCyclePolicy: DataGridFormulaCyclePolicy = options.formulaCyclePolicy === "iterative"
    ? "iterative"
    : "error"
  let computedSnapshotFieldList: readonly string[] = []
  let computedSnapshotFieldsDirty = true
  const computedRegistry = createClientRowComputedRegistryRuntime<T>({
    projectionPolicy,
    initialFormulaFunctionRegistry: options.initialFormulaFunctionRegistry,
    formulaCyclePolicy,
    resolveRowFieldValue: (rowNode, field, readBaseValue) => {
      return computedSnapshotRuntime.readFieldValue(rowNode, field, readBaseValue)
    },
    onFormulaRuntimeError: pushFormulaRuntimeError,
    onComputedPlanChanged: () => {
      computedSnapshotFieldsDirty = true
    },
  })
  computedRegistryRef.current = computedRegistry
  const normalizeComputedName = computedRegistry.normalizeComputedName
  const normalizeComputedTargetField = computedRegistry.normalizeComputedTargetField
  const computedSnapshotRuntime = createClientRowComputedSnapshotRuntime<T>({
    applyRowDataPatch,
    getSourceRows: () => baseSourceRows,
    getSourceRowIndexById: () => sourceRowIndexById,
  })
  let calculationSnapshotHistoryEntries: DataGridCalculationHistoryEntry<T>[] = []
  let calculationSnapshotHistoryIndex = -1
  let calculationSnapshotHistorySequence = 0

  const cloneFormulaDiagnostics = (
    diagnostics: DataGridProjectionFormulaDiagnostics | null | undefined,
  ): DataGridProjectionFormulaDiagnostics | null => {
    if (!diagnostics) {
      return null
    }
    return {
      recomputedFields: [...diagnostics.recomputedFields],
      runtimeErrorCount: diagnostics.runtimeErrorCount,
      runtimeErrors: diagnostics.runtimeErrors.map(error => ({ ...error })),
      ...(diagnostics.compileCache
        ? {
          compileCache: { ...diagnostics.compileCache },
        }
        : {}),
    }
  }

  const buildCalculationSnapshot = (): DataGridCalculationSnapshot<T> => ({
    kind: "client-calculation",
    rowIds: baseSourceRows.map(row => row.rowId),
    computedSnapshot: computedSnapshotRuntime.createRowBoundSnapshot(),
    modelSnapshot: getSnapshot(),
    aggregationModel: cloneAggregationModel(aggregationModel),
    formulaComputeStage: getFormulaComputeStageDiagnosticsSnapshot(),
    formulaRowRecompute: getFormulaRowRecomputeDiagnosticsSnapshot(),
  })

  const inspectCalculationSnapshot = (
    snapshot: DataGridCalculationSnapshot<T>,
    options: Pick<DataGridCalculationSnapshotRestoreOptions, "rowBindingPolicy"> = {},
  ): DataGridCalculationSnapshotInspection => {
    const rowBindingPolicy = options.rowBindingPolicy === "strict" ? "strict" : "reconcile"
    const currentRowIds = baseSourceRows.map(row => row.rowId)
    const currentRowIdSet = new Set<DataGridRowId>(currentRowIds)
    const snapshotRowIdSet = new Set<DataGridRowId>(snapshot.rowIds)
    const missingRowIds: DataGridRowId[] = []
    const extraRowIds: DataGridRowId[] = []
    let matchedRowCount = 0
    for (const rowId of snapshot.rowIds) {
      if (currentRowIdSet.has(rowId)) {
        matchedRowCount += 1
      } else {
        missingRowIds.push(rowId)
      }
    }
    for (const rowId of currentRowIds) {
      if (!snapshotRowIdSet.has(rowId)) {
        extraRowIds.push(rowId)
      }
    }
    const reordered = snapshot.rowIds.length === currentRowIds.length
      && snapshot.rowIds.some((rowId, index) => !Object.is(rowId, currentRowIds[index]))
    const fullyBound = missingRowIds.length === 0
    const restorable = rowBindingPolicy === "strict"
      ? fullyBound && extraRowIds.length === 0 && !reordered
      : true
    const overlayValueCounts: Record<string, number> = {}
    for (const [field, entries] of Object.entries(snapshot.computedSnapshot.overlayValuesByField ?? {})) {
      overlayValueCounts[field] = Array.isArray(entries) ? entries.length : 0
    }
    return {
      rowBindingPolicy,
      restorable,
      fullyBound,
      reordered,
      snapshotRowCount: snapshot.rowIds.length,
      currentRowCount: currentRowIds.length,
      matchedRowCount,
      missingRowIds,
      extraRowIds,
      computedFields: [...snapshot.computedSnapshot.computedFields],
      overlayValueCounts,
    }
  }

  const commitCalculationSnapshotRestore = (
    snapshot: DataGridCalculationSnapshot<T>,
    options: DataGridCalculationSnapshotRestoreOptions = {},
  ): boolean => {
    const inspection = inspectCalculationSnapshot(snapshot, options)
    if (!inspection.restorable) {
      return false
    }
    if (inspection.rowBindingPolicy === "strict") {
      if (inspection.snapshotRowCount !== inspection.currentRowCount || inspection.reordered) {
        return false
      }
    }

    syncComputedSnapshotFields()
    computedSnapshotRuntime.replaceRowBoundSnapshot(snapshot.computedSnapshot)
    refreshMaterializedSourceRows()

    const restoredModelSnapshot = snapshot.modelSnapshot
    sortModel = cloneSortModel(restoredModelSnapshot.sortModel)
    filterModel = cloneFilterModel(restoredModelSnapshot.filterModel)
    if (!treeData) {
      groupBy = cloneGroupBySpec(restoredModelSnapshot.groupBy)
      expansionExpandedByDefault = Boolean(restoredModelSnapshot.groupExpansion.expandedByDefault)
      toggledGroupKeys.clear()
      for (const groupKey of restoredModelSnapshot.groupExpansion.toggledGroupKeys) {
        toggledGroupKeys.add(groupKey)
      }
    }
    pivotModel = clonePivotSpec(restoredModelSnapshot.pivotModel ?? null)
    pivotColumns = pivotRuntime.normalizeColumns(restoredModelSnapshot.pivotColumns ?? [])
    pivotExpansionExpandedByDefault = true
    toggledPivotGroupKeys.clear()
    aggregationModel = cloneAggregationModel(snapshot.aggregationModel)
    paginationInput = restoredModelSnapshot.pagination.enabled
      ? normalizePaginationInput({
        pageSize: restoredModelSnapshot.pagination.pageSize,
        currentPage: restoredModelSnapshot.pagination.currentPage,
      })
      : normalizePaginationInput(null)
    viewportRange = normalizeViewportRange(restoredModelSnapshot.viewportRange, runtimeState.rows.length)

    formulaDiagnosticsRuntime.commitFormulaDiagnostics(
      cloneFormulaDiagnostics(restoredModelSnapshot.projection?.formula ?? null) ?? createEmptyFormulaDiagnostics(),
    )
    commitFormulaComputeStageDiagnostics(snapshot.formulaComputeStage ?? createEmptyFormulaComputeStageDiagnostics())
    commitFormulaRowRecomputeDiagnostics(snapshot.formulaRowRecompute ?? { rows: [] })

    cachedFilterPredicateKey = "__none__"
    cachedFilterPredicate = null
    sortValueCache.clear()
    sortValueCacheKey = "__none__"
    groupValueCache.clear()
    groupValueCacheKey = "__none__"
    pendingPivotValuePatch = null
    resetGroupByIncrementalAggregationState()
    invalidateTreeProjectionCaches()

    runtimeStateStore.setProjectionInvalidation(["computedChanged"])
    if (!tryApplyFlatIdentityProjectionRefresh()) {
      computeRuntime.refresh()
    }
    if (options.emit !== false) {
      emit()
    }
    return true
  }

  const pushCalculationSnapshot = (label?: string): DataGridCalculationHistoryEntry<T> => {
    const entry: DataGridCalculationHistoryEntry<T> = {
      id: ++calculationSnapshotHistorySequence,
      label: typeof label === "string" && label.trim().length > 0 ? label.trim() : null,
      snapshot: buildCalculationSnapshot(),
    }
    if (calculationSnapshotHistoryIndex < calculationSnapshotHistoryEntries.length - 1) {
      calculationSnapshotHistoryEntries = calculationSnapshotHistoryEntries.slice(0, calculationSnapshotHistoryIndex + 1)
    }
    calculationSnapshotHistoryEntries.push(entry)
    calculationSnapshotHistoryIndex = calculationSnapshotHistoryEntries.length - 1
    return entry
  }

  const getCalculationSnapshotHistory = (): DataGridCalculationHistory<T> => ({
    index: calculationSnapshotHistoryIndex,
    entries: calculationSnapshotHistoryEntries.map(entry => ({
      id: entry.id,
      label: entry.label,
      snapshot: entry.snapshot,
    })),
  })

  const syncComputedSnapshotFields = (): boolean => {
    if (computedSnapshotFieldsDirty) {
      computedSnapshotFieldList = computedRegistry.getComputedEntryByIndex().map(entry => entry.field)
      computedSnapshotFieldsDirty = false
    }
    return computedSnapshotRuntime.setComputedFields(computedSnapshotFieldList)
  }

  const refreshMaterializedSourceRows = (
    changedRowIds?: readonly DataGridRowId[],
  ): void => {
    if (!changedRowIds || changedRowIds.length === 0) {
      sourceRows = baseSourceRows
      sourceRowIndexById = buildRowIdPositionIndex(baseSourceRows)
      clearSourceColumnValuesCache()
      return
    }
    const invalidatedRowIds: DataGridRowId[] = []
    for (const rowId of changedRowIds) {
      const rowIndex = sourceRowIndexById.get(rowId)
      if (typeof rowIndex !== "number" || rowIndex < 0 || rowIndex >= baseSourceRows.length) {
        continue
      }
      invalidatedRowIds.push(rowId)
    }
    if (invalidatedRowIds.length > 0) {
      invalidateSourceColumnValuesByRowIds(invalidatedRowIds)
    }
  }

  const sourceColumnCacheRuntime = createClientRowSourceColumnCacheRuntime<T>({
    getSourceRows: () => baseSourceRows,
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
  const materializeBaseRowAtIndex = (rowIndex: number): DataGridRowNode<T> | undefined => {
    if (rowIndex < 0 || rowIndex >= baseSourceRows.length) {
      return undefined
    }
    const baseRow = baseSourceRows[rowIndex]
    return baseRow ? computedSnapshotRuntime.materializeRow(baseRow) : undefined
  }
  const materializeOutputRow = (rowNode: DataGridRowNode<T> | undefined): DataGridRowNode<T> | undefined => {
    if (!rowNode || rowNode.kind !== "leaf") {
      return rowNode
    }
    return computedSnapshotRuntime.materializeRow(rowNode)
  }
  const materializeOutputRows = (rows: readonly DataGridRowNode<T>[]): DataGridRowNode<T>[] => {
    const materializedRows = new Array<DataGridRowNode<T>>(rows.length)
    for (let index = 0; index < rows.length; index += 1) {
      materializedRows[index] = materializeOutputRow(rows[index]) as DataGridRowNode<T>
    }
    return materializedRows
  }
  const materializeOutputRowsInRange = (rows: readonly DataGridRowNode<T>[], start: number, end: number): DataGridRowNode<T>[] => {
    if (end < start) {
      return []
    }
    const length = end - start + 1
    const materializedRows = new Array<DataGridRowNode<T>>(length)
    let outputIndex = 0
    for (let index = start; index <= end; index += 1) {
      materializedRows[outputIndex] = materializeOutputRow(rows[index]) as DataGridRowNode<T>
      outputIndex += 1
    }
    return materializedRows
  }
  const computedExecutionRuntime = createClientRowComputedExecutionRuntime<T>({
    vectorBatchSize: DATAGRID_COMPUTE_VECTOR_BATCH_SIZE,
    isRecord,
    isColumnCacheParityVerificationEnabled: isDataGridColumnCacheParityVerificationEnabled,
    isFormulaRowRecomputeDiagnosticsEnabled: () => captureFormulaRowRecomputeDiagnostics,
    isFormulaExplainDiagnosticsEnabled: () => captureFormulaExplainDiagnostics,
    getSourceRows: () => baseSourceRows,
    getSourceRowIndexById: () => sourceRowIndexById,
    setSourceRows: () => {},
    resolveRowFieldReader: computedRegistry.resolveRowFieldReader,
    getComputedExecutionPlan: computedRegistry.getComputedExecutionPlan,
    getComputedOrder: computedRegistry.getComputedOrder,
    getComputedEntryByIndex: computedRegistry.getComputedEntryByIndex,
    getComputedFieldReaderByIndex: computedRegistry.getComputedFieldReaderByIndex,
    getComputedLevelIndexes: computedRegistry.getComputedLevelIndexes,
    getComputedDependentsByIndex: computedRegistry.getComputedDependentsByIndex,
    getFormulaIterativeCalculationOptions: () => options.formulaIterativeCalculation ?? null,
    getFormulaFieldsByName: computedRegistry.getFormulaFieldsByName,
    getFormulaCompileCacheDiagnostics: computedRegistry.getFormulaCompileCacheDiagnostics,
    resolveComputedRootIndexes: computedRegistry.resolveComputedRootIndexes,
    resolveComputedRootIndexesForField: computedRegistry.resolveComputedRootIndexesForField,
    resolveComputedRootIndexesForContext: computedRegistry.resolveComputedRootIndexesForContext,
    resolveComputedRootIndexesForContextKeys: computedRegistry.resolveComputedRootIndexesForContextKeys,
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
    const result = computedExecutionRuntime.applyComputedFieldsToSourceRows(options)
    const fieldsChanged = syncComputedSnapshotFields()
    const snapshotChanged = computedSnapshotRuntime.applyComputedUpdates(result.computedUpdatesByRowId)
    if (fieldsChanged) {
      refreshMaterializedSourceRows()
    } else if (snapshotChanged || result.changed) {
      const changedRowIds = result.changedRowIds.length > 0
        ? result.changedRowIds
        : Array.from(result.computedUpdatesByRowId.keys())
      refreshMaterializedSourceRows(changedRowIds)
    }
    return result
  }
  const projectionRowFieldReaderCache = new Map<string, (row: DataGridRowNode<T>) => unknown>()
  const readProjectionRowField = (row: DataGridRowNode<T>, key: string, field?: string): unknown => {
    const resolvedField = field && field.trim().length > 0 ? field : key
    if (!resolvedField) {
      return undefined
    }
    let reader = projectionRowFieldReaderCache.get(resolvedField)
    if (!reader) {
      const readDataValue = createCompiledDataGridRowDataReader(resolvedField)
      reader = (rowNode: DataGridRowNode<T>): unknown => readDataValue(rowNode.data as unknown)
      projectionRowFieldReaderCache.set(resolvedField, reader)
    }
    return computedSnapshotRuntime.readFieldValue(row, resolvedField, reader)
  }
  const registerComputedFieldInternal = (
    definition: DataGridComputedFieldDefinition<T>,
    internalOptions?: {
      knownComputedNames?: ReadonlySet<string>
      deferRebuild?: boolean
    },
  ): void => {
    computedRegistry.registerComputedFieldInternal(definition, internalOptions)
  }
  const registerFormulaFieldInternal = (
    definition: DataGridFormulaFieldDefinition,
    options: {
      knownComputedNames?: ReadonlySet<string>
      knownComputedNameByField?: ReadonlyMap<string, string>
      deferRebuild?: boolean
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
    rebuildComputedPlan: computedRegistry.rebuildComputedPlan,
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
        if (typeof rowIndex !== "number" || rowIndex < 0 || rowIndex >= baseSourceRows.length) {
          return undefined
        }
        return baseSourceRows[rowIndex]
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
      return createFilterPredicate(filterModel, {
        ignoreColumnFilterKey: ignoredColumnKey,
        readRowField: readProjectionRowField,
      })
    }

    const filterKey = String(runtimeState.filterRevision)
    return filterKey === cachedFilterPredicateKey && cachedFilterPredicate
      ? (() => {
          derivedCacheDiagnostics.filterPredicateHits += 1
          return cachedFilterPredicate as (rowNode: DataGridRowNode<T>) => boolean
        })()
      : (() => {
          const next = createFilterPredicate(filterModel, {
            readRowField: readProjectionRowField,
          })
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
    readRowField: readProjectionRowField,
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

  const canUseFlatIdentityProjectionRefresh = (): boolean => {
    return !hasActiveFilterModel(filterModel)
      && sortModel.length === 0
      && treeData === null
      && groupBy === null
      && pivotModel === null
      && !Boolean(aggregationModel && aggregationModel.columns.length > 0)
      && pagination.enabled !== true
  }

  const commitFlatIdentityProjectionRefresh = (): void => {
    const nextFlatRows = baseSourceRows as DataGridRowNode<T>[]
    runtimeState.filteredRowsProjection = nextFlatRows
    runtimeState.sortedRowsProjection = nextFlatRows
    runtimeState.groupedRowsProjection = nextFlatRows
    runtimeState.pivotedRowsProjection = nextFlatRows
    runtimeState.aggregatedRowsProjection = nextFlatRows
    runtimeState.paginatedRowsProjection = nextFlatRows
    runtimeState.rows = nextFlatRows
    pagination = buildPaginationSnapshot(nextFlatRows.length, paginationInput)
    viewportRange = normalizeViewportRange(viewportRange, nextFlatRows.length)
    runtimeStateStore.commitProjectionCycle(false)
    derivedCacheDiagnostics.revisions.row = runtimeState.rowRevision
    derivedCacheDiagnostics.revisions.sort = runtimeState.sortRevision
    derivedCacheDiagnostics.revisions.filter = runtimeState.filterRevision
    derivedCacheDiagnostics.revisions.group = runtimeState.groupRevision
  }

  const tryApplyFlatIdentityProjectionRefresh = (): boolean => {
    if (!canUseFlatIdentityProjectionRefresh()) {
      return false
    }
    commitFlatIdentityProjectionRefresh()
    return true
  }

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
      if (stage === "compute" && tryApplyFlatIdentityProjectionRefresh()) {
        return
      }
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
      if (tryApplyFlatIdentityProjectionRefresh()) {
        return
      }
      computeRuntime.recomputeFromStage("compute")
    },
    applyComputedFields: () => {
      const computedResult = applyComputedFieldsToSourceRows()
      commitFormulaDiagnostics(computedResult.formulaDiagnostics)
      commitFormulaComputeStageDiagnostics(computedResult.computeStageDiagnostics)
      commitFormulaRowRecomputeDiagnostics(computedResult.rowRecomputeDiagnostics)
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
    getSourceRows: () => baseSourceRows,
    setSourceRows: (rows) => {
      baseSourceRows = rows
      computedSnapshotRuntime.pruneRows(baseSourceRows)
      refreshMaterializedSourceRows()
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
    commitFormulaRowRecomputeDiagnostics,
    mergeRowPatch,
    getBaseSourceRows: () => baseSourceRows,
    getMaterializedSourceRowAtIndex: materializeBaseRowAtIndex,
    getSourceRowIndexById: () => sourceRowIndexById,
    preparePatchedBaseRows: (rows, changedRowIds) => {
      baseSourceRows = rows as DataGridRowNode<T>[]
      // Row patches preserve row identity/order, so the snapshot overlay can
      // stay index-aligned without a full prune/reindex pass.
      refreshMaterializedSourceRows(changedRowIds)
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
    getSourceRows: () => baseSourceRows,
    getSourceRowIndexById: () => sourceRowIndexById,
    setSourceRows: (rows) => {
      if (rows === baseSourceRows) {
        return
      }
      baseSourceRows = rows as DataGridRowNode<T>[]
      computedSnapshotRuntime.pruneRows(baseSourceRows)
      refreshMaterializedSourceRows()
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
      if (computedRegistry.hasComputedFields()) {
        const nextFlatRows = baseSourceRows as DataGridRowNode<T>[]
        runtimeState.filteredRowsProjection = nextFlatRows
        runtimeState.sortedRowsProjection = nextFlatRows
        runtimeState.groupedRowsProjection = nextFlatRows
        runtimeState.pivotedRowsProjection = nextFlatRows
        runtimeState.aggregatedRowsProjection = nextFlatRows
        runtimeState.paginatedRowsProjection = nextFlatRows
        runtimeState.rows = nextFlatRows
      } else {
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
    options: {
      contextKeys?: ReadonlySet<string>
    } = {},
  ): number => {
    const computedResult = applyComputedFieldsToSourceRows({
      rowIds,
      changedContextKeys: options.contextKeys,
    })
    commitFormulaDiagnostics(computedResult.formulaDiagnostics)
    commitFormulaComputeStageDiagnostics(computedResult.computeStageDiagnostics)
    commitFormulaRowRecomputeDiagnostics(computedResult.rowRecomputeDiagnostics)
    if (!computedResult.changed) {
      return 0
    }
    bumpRowVersions(rowVersionById, computedResult.changedRowIds)
    runtimeStateStore.bumpRowRevision()
    resetGroupByIncrementalAggregationState()
    invalidateTreeProjectionCaches()
    runtimeStateStore.setProjectionInvalidation(["computedChanged"])
    if (!tryApplyFlatIdentityProjectionRefresh()) {
      computeRuntime.recomputeFromStage("compute")
    }
    emit()
    return computedResult.changedRowIds.length
  }

  runtimeStateStore.setProjectionInvalidation(["rowsChanged"])
  if (!tryApplyFlatIdentityProjectionRefresh()) {
    computeRuntime.recomputeFromStage("compute")
  }

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
      return materializeOutputRow(runtimeState.rows[Math.max(0, Math.trunc(index))])
    },
    getRowsInRange(range: DataGridViewportRange) {
      const normalized = normalizeViewportRange(range, runtimeState.rows.length)
      if (runtimeState.rows.length === 0) {
        return []
      }
      return materializeOutputRowsInRange(runtimeState.rows, normalized.start, normalized.end)
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
      rowsMutationsRuntime.setRows([...baseSourceRows, ...nextRows])
    },
    prependRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      if (nextRows.length === 0) {
        return
      }
      rowsMutationsRuntime.setRows([...nextRows, ...baseSourceRows])
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
    getFormulaGraph() {
      const computedExecutionPlan = computedRegistry.getComputedExecutionPlan()
      if (computedExecutionPlan.order.length === 0) {
        return null
      }
      return snapshotDataGridFormulaGraph(computedExecutionPlan)
    },
    getFormulaComputeStageDiagnostics() {
      return getFormulaComputeStageDiagnosticsSnapshot()
    },
    getFormulaRowRecomputeDiagnostics() {
      return getFormulaRowRecomputeDiagnosticsSnapshot()
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
    recomputeFormulaContext(request: DataGridFormulaContextRecomputeRequest) {
      ensureActive()
      const contextKeys = Array.isArray(request.contextKeys)
        ? request.contextKeys
          .filter((value): value is string => typeof value === "string")
          .map(value => value.trim())
          .filter(value => value.length > 0)
        : []
      if (contextKeys.length === 0) {
        return 0
      }
      const normalizedRowIds = Array.isArray(request.rowIds)
        ? request.rowIds.filter(isDataGridRowId)
        : []
      return recomputeComputedFieldsAndRefresh(
        normalizedRowIds.length > 0 ? new Set<DataGridRowId>(normalizedRowIds) : undefined,
        { contextKeys: new Set<string>(contextKeys) },
      )
    },
    reorderRows(input: DataGridClientRowReorderInput) {
      return rowsMutationsRuntime.reorderRows(input)
    },
    createCalculationSnapshot() {
      ensureActive()
      return buildCalculationSnapshot()
    },
    restoreCalculationSnapshot(snapshot, options = {}) {
      ensureActive()
      return commitCalculationSnapshotRestore(snapshot, options)
    },
    inspectCalculationSnapshot(snapshot, options = {}) {
      ensureActive()
      return inspectCalculationSnapshot(snapshot, options)
    },
    pushCalculationSnapshot(label?: string) {
      ensureActive()
      return pushCalculationSnapshot(label)
    },
    undoCalculationSnapshot(options = {}) {
      ensureActive()
      if (calculationSnapshotHistoryIndex <= 0) {
        return false
      }
      const nextIndex = calculationSnapshotHistoryIndex - 1
      const entry = calculationSnapshotHistoryEntries[nextIndex]
      if (!entry || !commitCalculationSnapshotRestore(entry.snapshot, options)) {
        return false
      }
      calculationSnapshotHistoryIndex = nextIndex
      return true
    },
    redoCalculationSnapshot(options = {}) {
      ensureActive()
      if (calculationSnapshotHistoryIndex >= calculationSnapshotHistoryEntries.length - 1) {
        return false
      }
      const nextIndex = calculationSnapshotHistoryIndex + 1
      const entry = calculationSnapshotHistoryEntries[nextIndex]
      if (!entry || !commitCalculationSnapshotRestore(entry.snapshot, options)) {
        return false
      }
      calculationSnapshotHistoryIndex = nextIndex
      return true
    },
    getCalculationSnapshotHistory() {
      ensureActive()
      return getCalculationSnapshotHistory()
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
      const drilldown = resolveClientRowPivotCellDrilldown({
        input,
        pivotModel,
        pivotColumns,
        aggregatedRowsProjection: runtimeState.aggregatedRowsProjection,
        pivotedRowsProjection: runtimeState.pivotedRowsProjection,
        groupedRowsProjection: runtimeState.groupedRowsProjection,
        sourceRows: baseSourceRows,
        isDataGridRowId,
        normalizePivotAxisValue,
        readRowField: (row, key) => readProjectionRowField(row, key),
      })
      if (!drilldown) {
        return null
      }
      return {
        ...drilldown,
        rows: materializeOutputRows(drilldown.rows),
      }
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
        return buildColumnHistogram(baseSourceRows, normalizedColumnId, options, readProjectionRowField)
      }

      if (options?.ignoreSelfFilter === true) {
        const filterPredicate = resolveFilterPredicate({ ignoreColumnFilterKey: normalizedColumnId })
        const rowsForHistogram: DataGridRowNode<T>[] = []
        for (const row of baseSourceRows) {
          if (filterPredicate(row)) {
            rowsForHistogram.push(row)
          }
        }
        return buildColumnHistogram(rowsForHistogram, normalizedColumnId, options, readProjectionRowField)
      }

      return buildColumnHistogram(
        runtimeState.filteredRowsProjection,
        normalizedColumnId,
        options,
        readProjectionRowField,
      )
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
      if (!tryApplyFlatIdentityProjectionRefresh()) {
        computeRuntime.refresh()
      }
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
      formulaDiagnosticsRuntime.commitFormulaRowRecomputeDiagnostics({ rows: [] })
      runtimeStateStore.setProjectionFormulaDiagnostics(null)
      invalidateTreeProjectionCaches()
      cachedFilterPredicate = null
      cachedFilterPredicateKey = "__none__"
    },
  }
}
