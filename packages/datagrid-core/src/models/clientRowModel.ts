// Main composition root for the client-side row engine. This file should wire
// subsystems together and expose the public row-model API, but avoid owning
// domain logic that already lives in host/state/projection/materialization runtimes.
import{
  cloneGroupBySpec,
  normalizePaginationInput,
  normalizeViewportRange,
  type DataGridComputedFieldComputeContext,
  type DataGridGroupExpansionSnapshot,
  type DataGridPaginationInput,
  type DataGridComputedFieldDefinition,
  type DataGridComputedFieldSnapshot,
  type DataGridFormulaCyclePolicy,
  type DataGridFormulaContextRecomputeRequest,
  type DataGridFormulaFieldDefinition,
  type DataGridFormulaFieldSnapshot,
  type DataGridFormulaTablePatch,
  type DataGridFormulaTableSource,
  type DataGridFormulaReferenceParserOptions,
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
  type DataGridProjectionStageTimer,
  type DataGridFilterCellStyleReader,
  type DataGridRowId,
  type DataGridRowIdResolver,
  type DataGridRowNode,
  type DataGridRowNodeInput,
  type DataGridRowModel,
  type DataGridRowModelListener,
  type DataGridRowModelRefreshReason,
  type DataGridRowModelSnapshot,
  type DataGridSortState,
  type DataGridTreeDataSpec,
  type DataGridViewportRange,
} from "./rowModel.js"
import {
  clonePivotSpec,
  normalizePivotAxisValue,
} from "@affino/datagrid-pivot"
import type {
  DataGridPivotCellDrilldownInput,
  DataGridPivotSpec,
} from "@affino/datagrid-pivot"
import { expandClientProjectionStages } from "./projection/clientRowProjectionEngine.js"
import { DATAGRID_CLIENT_ALL_PROJECTION_STAGES } from "./projection/projectionStages.js"
import {
  type DataGridClientComputeDiagnostics,
  type DataGridClientComputeMode,
  type DataGridClientComputeTransport,
} from "./compute/clientRowComputeRuntime.js"
import type { DataGridClientPerformanceMode, DataGridProjectionPolicy } from "./projection/projectionPolicy.js"
import { createClientRowLifecycle } from "./clientRowLifecycle.js"
import { createClientRowComputedSnapshotFieldsRuntime } from "./materialization/clientRowComputedSnapshotFieldsRuntime.js"
import type { ClientRowComputedSnapshotFieldsRuntime } from "./materialization/clientRowComputedSnapshotFieldsRuntime.js"
import {
  buildColumnHistogram,
  createFilterPredicate,
  normalizeText,
} from "./projection/clientRowProjectionPrimitives.js"
import {
  applyRowDataPatch,
  mergeRowPatch,
} from "./clientRowRuntimeUtils.js"
import type { DataGridFieldDependency } from "./dependency/dependencyGraph.js"
import { resolveClientRowPivotCellDrilldown } from "./pivot/clientRowPivotDrilldownRuntime.js"
import { createClientRowSourceColumnHostRuntime } from "./host/clientRowSourceColumnHostRuntime.js"
import { createClientRowFormulaDiagnosticsRuntime } from "./compute/clientRowFormulaDiagnosticsRuntime.js"
import { createClientRowSourceColumnCacheRuntime } from "./materialization/clientRowSourceColumnCacheRuntime.js"
import { createClientRowMaterializationRuntime } from "./materialization/clientRowMaterializationRuntime.js"
import { cloneAggregationModel } from "./clientRowModelHelpers.js"
import { createClientRowRowVersionRuntime } from "./state/clientRowRowVersionRuntime.js"
import {
  createClientRowDerivedCacheRuntime,
  type DataGridClientRowModelDerivedCacheDiagnostics,
} from "./projection/clientRowDerivedCacheRuntime.js"
import {
  cloneProjectionFormulaDiagnostics,
  type DataGridCalculationHistory,
  type DataGridCalculationHistoryEntry,
  type DataGridCalculationSnapshot,
  type DataGridCalculationSnapshotInspection,
  type DataGridCalculationSnapshotRestoreOptions,
} from "./snapshot/clientRowCalculationSnapshotRuntime.js"
import {
  createClientRowComputedSnapshotRuntime,
} from "./materialization/clientRowComputedSnapshotRuntime.js"
import {
  createClientRowComputedRegistryRuntime,
  type ClientRowComputedRegistryRuntime,
} from "./compute/clientRowComputedRegistryRuntime.js"
import { createClientRowComputedFieldHostRuntime } from "./host/clientRowComputedFieldHostRuntime.js"
import { createClientRowFormulaHostRuntime } from "./host/clientRowFormulaHostRuntime.js"
import {
  createClientRowComputedExecutionRuntime,
  type ApplyComputedFieldsToSourceRowsOptions,
  type ApplyComputedFieldsToSourceRowsResult,
} from "./compute/clientRowComputedExecutionRuntime.js"
import {
  type DataGridFormulaFunctionDefinition,
  type DataGridFormulaFunctionRegistry,
} from "./formula/formulaEngine.js"
import { createClientRowModelStateBootstrap } from "./bootstrap/clientRowModelStateBootstrap.js"
import { createClientRowModelAccessorBootstrap } from "./bootstrap/clientRowModelAccessorBootstrap.js"
import { createClientRowModelMutationBootstrap } from "./bootstrap/clientRowModelMutationBootstrap.js"
import { createClientRowModelProjectionBootstrap } from "./bootstrap/clientRowModelProjectionBootstrap.js"
import { createClientRowModelComputeBootstrap } from "./bootstrap/clientRowModelComputeBootstrap.js"
import { createClientRowModelSnapshotBootstrap } from "./bootstrap/clientRowModelSnapshotBootstrap.js"
import {
  snapshotDataGridFormulaGraph,
  snapshotDataGridFormulaExecutionPlan,
  type DataGridFormulaGraphSnapshot,
  type DataGridFormulaExecutionPlanSnapshot,
} from "@affino/datagrid-formula-engine"

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
  readFilterCell?: (rowNode: DataGridRowNode<T>, columnKey: string) => unknown
  readFilterCellStyle?: DataGridFilterCellStyleReader<T>
  /**
   * Clones row payloads on ingest to isolate the model from later external mutation.
   * Disable only for tightly controlled perf-sensitive paths.
   * Default: `true`.
   */
  isolateInputRows?: boolean
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
  formulaReferenceParserOptions?: DataGridFormulaReferenceParserOptions
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
  projectionStageTimer?: DataGridProjectionStageTimer
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
  getSourceRows(): readonly DataGridRowNode<T>[]
  getSourceRowsRevision(): number
  getFormulaStructureRevision(): number
  setRows(rows: readonly DataGridRowNodeInput<T>[]): void
  replaceRows(rows: readonly DataGridRowNodeInput<T>[]): void
  appendRows(rows: readonly DataGridRowNodeInput<T>[]): void
  prependRows(rows: readonly DataGridRowNodeInput<T>[]): void
  insertRowsAt(index: number, rows: readonly DataGridRowNodeInput<T>[]): boolean
  insertRowsBefore(rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]): boolean
  insertRowsAfter(rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]): boolean
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
    definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[], context?: DataGridComputedFieldComputeContext<unknown>) => unknown),
  ): void
  unregisterFormulaFunction(name: string): boolean
  getFormulaFunctionNames(): readonly string[]
  setFormulaTable(name: string, rows: DataGridFormulaTableSource): void
  patchFormulaTables(patch: DataGridFormulaTablePatch): boolean
  removeFormulaTable(name: string): boolean
  getFormulaTableNames(): readonly string[]
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

export type {
  DataGridCalculationHistory,
  DataGridCalculationHistoryEntry,
  DataGridCalculationSnapshot,
  DataGridCalculationSnapshotInspection,
  DataGridCalculationSnapshotRestoreOptions,
} from "./snapshot/clientRowCalculationSnapshotRuntime.js"
export type { DataGridClientRowModelDerivedCacheDiagnostics } from "./projection/clientRowDerivedCacheRuntime.js"

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

export function createClientRowModel<T>(
  options: CreateClientRowModelOptions<T> = {},
): ClientRowModel<T> {
  const stateBootstrap = createClientRowModelStateBootstrap<T>({
    options,
    normalizeFormulaColumnCacheMaxColumns,
  })

  const {
    cloneSortModel,
    cloneFilterModel,
    treeData,
    projectionPolicy,
    formulaColumnCacheMaxColumns,
    captureFormulaRowRecomputeDiagnostics,
    captureFormulaExplainDiagnostics,
    projectionTransientStateRuntime,
    sourceNormalizationRuntime,
    sourceStateRuntime,
    runtimeStateStore,
    viewStateRuntime,
  } = stateBootstrap

  const accessors = createClientRowModelAccessorBootstrap<T>({
    sourceStateRuntime,
    runtimeStateStore,
    viewStateRuntime,
  })
  const {
    runtimeState,
    getBaseSourceRows,
    setBaseSourceRows,
    getSourceRowsState,
    setSourceRowsState,
    resetSourceRowsToBase,
    clearSourceRowsState,
    getSourceRowIndexById,
    setSourceRowIndexById,
    getSortModel,
    setSortModel,
    getFilterModel,
    setFilterModel,
    getGroupBy,
    setGroupBy,
    getPivotModel,
    setPivotModel,
    getPivotColumns,
    setPivotColumns,
    resetPivotColumns,
    getAggregationModel,
    setAggregationModel,
    getPaginationInput,
    setPaginationInput,
    getPagination,
    setPagination,
    getViewportRange,
    setViewportRange,
  } = accessors
  let materializationRuntime: ReturnType<typeof createClientRowMaterializationRuntime<T>>
  const readProjectionRowField = (row: DataGridRowNode<T>, key: string, field?: string): unknown => {
    return materializationRuntime.readProjectionRowField(row, key, field)
  }
  const lifecycle = createClientRowLifecycle<T>()
  const rowVersionRuntime = createClientRowRowVersionRuntime(getSourceRowsState())
  const derivedCacheRuntime = createClientRowDerivedCacheRuntime<T>({
    getFilterModel,
    getFilterRevision: () => runtimeState.filterRevision,
    readRowField: readProjectionRowField,
    readFilterCell: options.readFilterCell,
    readFilterCellStyle: options.readFilterCellStyle,
    createFilterPredicate,
    sourceColumnCacheLimit: Number.isFinite(formulaColumnCacheMaxColumns)
      ? formulaColumnCacheMaxColumns
      : null,
  })
  derivedCacheRuntime.updateRevisions({
    row: runtimeState.rowRevision,
    sort: runtimeState.sortRevision,
    filter: runtimeState.filterRevision,
    group: runtimeState.groupRevision,
  })
  const groupByIncrementalAggregationState = projectionTransientStateRuntime.getGroupByIncrementalAggregationState()
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
  let computedSnapshotFieldsRuntime: ClientRowComputedSnapshotFieldsRuntime | null = null
  const computedRegistry = createClientRowComputedRegistryRuntime<T>({
    projectionPolicy,
    initialFormulaFunctionRegistry: options.initialFormulaFunctionRegistry,
    formulaReferenceParserOptions: options.formulaReferenceParserOptions,
    formulaCyclePolicy,
    resolveRowFieldValue: (rowNode, field, readBaseValue) => {
      return computedSnapshotRuntime.readFieldValue(rowNode, field, readBaseValue)
    },
    onFormulaRuntimeError: pushFormulaRuntimeError,
    onComputedPlanChanged: () => {
      computedSnapshotFieldsRuntime?.markDirty()
    },
  })
  computedRegistryRef.current = computedRegistry
  const computedSnapshotRuntime = createClientRowComputedSnapshotRuntime<T>({
    applyRowDataPatch,
    getSourceRows: () => getBaseSourceRows(),
    getSourceRowIndexById: () => getSourceRowIndexById(),
  })
  const projectionBootstrap = createClientRowModelProjectionBootstrap<T>({
    readProjectionRowField,
    resolveTreeDataRow: (rowNode) => computedSnapshotRuntime.materializeRow(rowNode).data,
    getAggregationModel,
    getTreeData: () => treeData,
    getSourceRows: () => getSourceRowsState(),
    getPivotModel,
    getGroupBy,
  })
  const {
    pivotRuntime,
    treeProjectionRuntime,
    aggregationEngine,
    treePivotIntegrationRuntime,
    expansionHostRuntime,
  } = projectionBootstrap
  computedSnapshotFieldsRuntime = createClientRowComputedSnapshotFieldsRuntime({
    getComputedFieldNames: () => computedRegistry.getComputedEntryByIndex().map(entry => entry.field),
    setComputedFields: fields => computedSnapshotRuntime.setComputedFields(fields),
  })
  const commitCalculationSnapshotRestore = (
    snapshot: DataGridCalculationSnapshot<T>,
    options: DataGridCalculationSnapshotRestoreOptions = {},
  ): boolean => {
    computedSnapshotFieldsRuntime.sync()
    computedSnapshotRuntime.replaceRowBoundSnapshot(snapshot.computedSnapshot)
    refreshMaterializedSourceRows()

    const restoredModelSnapshot = snapshot.modelSnapshot
    setSortModel(cloneSortModel(restoredModelSnapshot.sortModel))
    setFilterModel(cloneFilterModel(restoredModelSnapshot.filterModel))
    if (!treeData) {
      setGroupBy(cloneGroupBySpec(restoredModelSnapshot.groupBy))
      expansionHostRuntime.restoreExpansionSnapshot(restoredModelSnapshot.groupExpansion)
    }
    setPivotModel(clonePivotSpec(restoredModelSnapshot.pivotModel ?? null))
    setPivotColumns(pivotRuntime.normalizeColumns(restoredModelSnapshot.pivotColumns ?? []))
    treePivotIntegrationRuntime.resetPivotExpansionState()
    setAggregationModel(cloneAggregationModel(snapshot.aggregationModel))
    setPaginationInput(restoredModelSnapshot.pagination.enabled
      ? normalizePaginationInput({
        pageSize: restoredModelSnapshot.pagination.pageSize,
        currentPage: restoredModelSnapshot.pagination.currentPage,
      })
      : normalizePaginationInput(null))
    setViewportRange(normalizeViewportRange(restoredModelSnapshot.viewportRange, runtimeState.rows.length))

    formulaDiagnosticsRuntime.commitFormulaDiagnostics(
      cloneProjectionFormulaDiagnostics(restoredModelSnapshot.projection?.formula ?? null) ?? createEmptyFormulaDiagnostics(),
    )
    commitFormulaComputeStageDiagnostics(snapshot.formulaComputeStage ?? createEmptyFormulaComputeStageDiagnostics())
    commitFormulaRowRecomputeDiagnostics(snapshot.formulaRowRecompute ?? { rows: [] })

    derivedCacheRuntime.resetAllCaches()
    treePivotIntegrationRuntime.clearPendingPivotValuePatch()
    projectionTransientStateRuntime.resetGroupByIncrementalAggregationState()
    treePivotIntegrationRuntime.invalidateTreeProjectionCaches()

    runtimeStateStore.setProjectionInvalidation(["computedChanged"])
    if (!flatIdentityProjectionRefreshRuntime.tryApply()) {
      computeHostRuntime.refresh()
    }
    if (options.emit !== false) {
      emit()
    }
    return true
  }

  const sourceColumnCacheRuntime = createClientRowSourceColumnCacheRuntime<T>({
    getSourceRows: () => getBaseSourceRows(),
    getSourceRowIndexById: () => getSourceRowIndexById(),
    maxColumns: formulaColumnCacheMaxColumns,
    setCacheSize: (size) => {
      derivedCacheRuntime.setSourceColumnCacheSize(size)
    },
    incrementCacheEvictions: () => {
      derivedCacheRuntime.incrementSourceColumnCacheEvictions()
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
  const sourceColumnHostRuntime = createClientRowSourceColumnHostRuntime({
    getBaseRowCount: () => getBaseSourceRows().length,
    getSourceRowIndexById: () => getSourceRowIndexById(),
    resetSourceRowsToBase,
    clearSourceColumnValuesCache,
    getSourceColumnValues,
    invalidateSourceColumnValuesByRowIds,
  })
  materializationRuntime = createClientRowMaterializationRuntime<T>({
    getBaseSourceRows: () => getBaseSourceRows(),
    getSourceRowIndexById: () => getSourceRowIndexById(),
    setSourceRows: rows => {
      setSourceRowsState(rows as DataGridRowNode<T>[])
    },
    setSourceRowIndexById: index => {
      setSourceRowIndexById(index)
    },
    clearSourceColumnValuesCache,
    invalidateSourceColumnValuesByRowIds,
    materializeRow: rowNode => computedSnapshotRuntime.materializeRow(rowNode),
    readMaterializedFieldValue: (row, field, readBaseValue) =>
      computedSnapshotRuntime.readFieldValue(row, field, readBaseValue),
  })
  const materializeBaseRowAtIndex = (rowIndex: number): DataGridRowNode<T> | null => {
    return materializationRuntime.materializeBaseRowAtIndex(rowIndex) ?? null
  }
  let materializedSourceRowsCacheRevision = -1
  let materializedSourceRowsCache: readonly DataGridRowNode<T>[] = []
  let formulaStructureRevision = 0
  const getMaterializedSourceRows = (): readonly DataGridRowNode<T>[] => {
    if (materializedSourceRowsCacheRevision === runtimeState.rowRevision) {
      return materializedSourceRowsCache
    }
    const baseSourceRows = getBaseSourceRows()
    if (baseSourceRows.length === 0) {
      materializedSourceRowsCache = []
      materializedSourceRowsCacheRevision = runtimeState.rowRevision
      return materializedSourceRowsCache
    }
    const materializedRows = new Array<DataGridRowNode<T>>(baseSourceRows.length)
    for (let index = 0; index < baseSourceRows.length; index += 1) {
      materializedRows[index] = materializeBaseRowAtIndex(index) ?? baseSourceRows[index] as DataGridRowNode<T>
    }
    materializedSourceRowsCache = materializedRows
    materializedSourceRowsCacheRevision = runtimeState.rowRevision
    return materializedSourceRowsCache
  }
  const materializeOutputRow = materializationRuntime.materializeOutputRow
  const materializeOutputRows = materializationRuntime.materializeOutputRows
  const materializeOutputRowsInRange = materializationRuntime.materializeOutputRowsInRange
  const computedExecutionRuntime = createClientRowComputedExecutionRuntime<T>({
    vectorBatchSize: DATAGRID_COMPUTE_VECTOR_BATCH_SIZE,
    isRecord,
    isColumnCacheParityVerificationEnabled: isDataGridColumnCacheParityVerificationEnabled,
    isFormulaRowRecomputeDiagnosticsEnabled: () => captureFormulaRowRecomputeDiagnostics,
    isFormulaExplainDiagnosticsEnabled: () => captureFormulaExplainDiagnostics,
    getSourceRows: () => getBaseSourceRows(),
    getSourceRowIndexById: () => getSourceRowIndexById(),
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
    getFormulaContextValue: computedRegistry.getFormulaContextValue,
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
    const fieldsChanged = computedSnapshotFieldsRuntime.sync()
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
  const refreshMaterializedSourceRows = sourceColumnHostRuntime.refreshMaterializedSourceRows
  const computedFieldHostRuntime = createClientRowComputedFieldHostRuntime<T>({
    computedRegistry,
    initialComputedFields: options.initialComputedFields,
    initialFormulaFields: options.initialFormulaFields,
    commitFormulaDiagnostics,
    commitFormulaComputeStageDiagnostics,
    applyComputedFieldsToSourceRows: () => {
      return applyComputedFieldsToSourceRows()
    },
    bumpRowVersions: (rowIds) => {
      rowVersionRuntime.bump(rowIds)
    },
  })
  computedFieldHostRuntime.bootstrapInitialComputedAndFormulaFields()

  function ensureActive() {
    lifecycle.ensureActive()
  }

  const computeBootstrap = createClientRowModelComputeBootstrap<T>({
    runtimeState,
    runtimeStateStore,
    treeData,
    projectionPolicy,
    getBaseSourceRows,
    getSourceRowsState,
    getSourceRowIndexById,
    readProjectionRowField,
    resolveFilterPredicate: (options?: { ignoreColumnFilterKey?: string }) => derivedCacheRuntime.resolveFilterPredicate(options),
    rowVersionRuntime,
    derivedCacheRuntime,
    projectionTransientStateRuntime,
    treeProjectionRuntime,
    pivotRuntime,
    aggregationEngine,
    expansionHostRuntime,
    treePivotIntegrationRuntime,
    getSortModel,
    getFilterModel,
    getGroupBy,
    getPivotModel,
    getAggregationModel,
    getPivotColumns,
    setPivotColumns,
    getPaginationInput,
    setPaginationInput,
    getPagination,
    setPagination,
    getViewportRange,
    setViewportRange,
    normalizeViewportRange,
    workerPatchDispatchThreshold: options.workerPatchDispatchThreshold ?? null,
    computeTransport: options.computeTransport ?? null,
    computeMode: options.computeMode,
    projectionStageTimer: options.projectionStageTimer,
    groupByIncrementalAggregationState,
  })

  const {
    computeModuleHost,
    projectionIntegrationHostRuntime,
    flatIdentityProjectionRefreshRuntime,
    computeHostRuntime,
  } = computeBootstrap

  const snapshotBootstrap = createClientRowModelSnapshotBootstrap<T>({
    runtimeState,
    runtimeStateStore,
    getStaleStages: () => computeHostRuntime.getStaleStages(),
    getFormulaComputeStageDiagnostics: () => getFormulaComputeStageDiagnosticsSnapshot(),
    getViewportRange,
    setViewportRange,
    normalizeViewportRange,
    getPagination,
    getSortModel,
    cloneSortModel,
    getFilterModel,
    cloneFilterModel,
    isTreeDataEnabled: () => Boolean(treeData),
    getTreeDataDiagnostics: () => projectionTransientStateRuntime.getTreeDataDiagnostics(),
    cloneTreeDataDiagnostics: diagnostics => projectionTransientStateRuntime.cloneTreeDataDiagnostics(diagnostics),
    getGroupBy,
    cloneGroupBySpec,
    getPivotModel,
    clonePivotSpec,
    getPivotColumns,
    normalizePivotColumns: (columns) => pivotRuntime.normalizeColumns(columns),
    getExpansionSnapshot: () => expansionHostRuntime.getCurrentExpansionSnapshot(),
    getBaseSourceRows: () => getBaseSourceRows(),
    createComputedSnapshot: () => computedSnapshotRuntime.createRowBoundSnapshot(),
    getAggregationModel,
    cloneAggregationModel,
    getFormulaComputeStageDiagnosticsSnapshot,
    getFormulaRowRecomputeDiagnosticsSnapshot,
    applySnapshotRestore: (snapshot, _inspection, restoreOptions) =>
      commitCalculationSnapshotRestore(snapshot, restoreOptions),
  })

  const {
    snapshotHostRuntime,
  } = snapshotBootstrap

  function getSnapshot(): DataGridRowModelSnapshot<T> {
    return snapshotHostRuntime.getSnapshot()
  }

  function emit() {
    lifecycle.emit(getSnapshot)
  }

  const mutationBootstrap = createClientRowModelMutationBootstrap<T>({
    ensureActive,
    emit,
    isDataGridRowId,
    treeData,
    projectionPolicy,
    runtimeState,
    runtimeStateStore,
    getBaseSourceRows,
    setBaseSourceRows,
    getSourceRowIndexById,
    getSortModel,
    setSortModel,
    cloneSortModel,
    getFilterModel,
    setFilterModel,
    cloneFilterModel,
    getGroupBy,
    setGroupBy,
    getPivotModel,
    setPivotModel,
    resetPivotColumns,
    getAggregationModel,
    setAggregationModel,
    getPaginationInput,
    setPaginationInput,
    getPagination,
    setPagination,
    getViewportRange,
    setViewportRange,
    normalizeViewportRange,
    rowVersionRuntime,
    derivedCacheRuntime,
    expansionHostRuntime,
    projectionIntegrationHostRuntime,
    treePivotIntegrationRuntime,
    flatIdentityProjectionRefreshRuntime,
    computeHostRuntime,
    sourceNormalizationRuntime,
    computedSnapshotRuntime,
    applyRowDataPatch,
    isRecord,
    mergeRowPatch,
    materializeBaseRowAtIndex,
    refreshMaterializedSourceRows,
    invalidateSourceColumnValuesByRowIds,
    applyComputedFieldsToSourceRows,
    commitFormulaDiagnostics,
    commitFormulaComputeStageDiagnostics,
    commitFormulaRowRecomputeDiagnostics,
    getAllStages: () => DATAGRID_CLIENT_ALL_PROJECTION_STAGES,
    expandStages: expandClientProjectionStages,
    applyIncrementalAggregationPatch: (changeSet, previousRowsById) =>
      projectionIntegrationHostRuntime.applyIncrementalAggregationPatch(changeSet, previousRowsById),
    hasComputedFields: () => computedRegistry.hasComputedFields(),
  })

  const {
    mutationHostRuntime,
    patchHostRuntime,
  } = mutationBootstrap

  function recomputeComputedFieldsAndRefresh(
    rowIds?: ReadonlySet<DataGridRowId>,
    options: {
      contextKeys?: ReadonlySet<string>
    } = {},
  ): number {
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
    rowVersionRuntime.bump(computedResult.changedRowIds)
    runtimeStateStore.bumpRowRevision()
    projectionIntegrationHostRuntime.resetGroupByIncrementalAggregationState()
    projectionIntegrationHostRuntime.invalidateTreeProjectionCaches()
    runtimeStateStore.setProjectionInvalidation(["computedChanged"])
    if (!flatIdentityProjectionRefreshRuntime.tryApply()) {
      computeHostRuntime.recomputeFromStage("compute")
    }
    emit()
    return computedResult.changedRowIds.length
  }

  const formulaHostRuntime = createClientRowFormulaHostRuntime<T>({
    computeModuleHost,
    ensureActive,
    emit,
    onFormulaStructureChanged: () => {
      formulaStructureRevision += 1
    },
    isDataGridRowId,
    registerComputedFieldInternal: computedFieldHostRuntime.registerComputedFieldInternal,
    registerFormulaFieldInternal: computedFieldHostRuntime.registerFormulaFieldInternal,
    getComputedFieldSnapshots: computedFieldHostRuntime.getComputedFieldSnapshots,
    getFormulaFieldSnapshots: computedFieldHostRuntime.getFormulaFieldSnapshots,
    hasRegisteredFormulaFields: () => computedFieldHostRuntime.getFormulaFieldsByName().size > 0,
    registerFormulaFunction: computedRegistry.registerFormulaFunction,
    unregisterFormulaFunction: computedRegistry.unregisterFormulaFunction,
    getFormulaFunctionNames: computedRegistry.getFormulaFunctionNames,
    getFormulaExecutionPlanSnapshot: () => {
      const computedExecutionPlan = computedRegistry.getComputedExecutionPlan()
      if (computedExecutionPlan.order.length === 0) {
        return null
      }
      return snapshotDataGridFormulaExecutionPlan(computedExecutionPlan)
    },
    getFormulaGraphSnapshot: () => {
      const computedExecutionPlan = computedRegistry.getComputedExecutionPlan()
      if (computedExecutionPlan.order.length === 0) {
        return null
      }
      return snapshotDataGridFormulaGraph(computedExecutionPlan)
    },
    getFormulaComputeStageDiagnosticsSnapshot: getFormulaComputeStageDiagnosticsSnapshot,
    getFormulaRowRecomputeDiagnosticsSnapshot: getFormulaRowRecomputeDiagnosticsSnapshot,
    recomputeComputedFieldsAndRefresh,
  })

  const normalizeFormulaTableName = (value: unknown): string => String(value ?? "").trim().toLowerCase()
  const createFormulaTableContextKey = (name: string): string => `table:${name}`

  const applyFormulaTablePatch = (patch: DataGridFormulaTablePatch): boolean => {
    ensureActive()
    const contextKeys = new Set<string>()
    let changed = false

    if (Array.isArray(patch.remove)) {
      for (const name of patch.remove) {
        const normalizedName = normalizeFormulaTableName(name)
        if (normalizedName.length === 0) {
          continue
        }
        if (!computedRegistry.removeFormulaTable(normalizedName)) {
          continue
        }
        contextKeys.add("tables")
        contextKeys.add(createFormulaTableContextKey(normalizedName))
        changed = true
      }
    }

    if (Array.isArray(patch.set)) {
      for (const entry of patch.set) {
        if (!entry) {
          continue
        }
        const normalizedName = normalizeFormulaTableName(entry.name)
        if (normalizedName.length === 0) {
          throw new Error("[clientRowModel] Formula table name must be non-empty")
        }
        if (!computedRegistry.setFormulaTable(normalizedName, entry.rows)) {
          continue
        }
        contextKeys.add("tables")
        contextKeys.add(createFormulaTableContextKey(normalizedName))
        changed = true
      }
    }

    if (!changed) {
      return false
    }

    void recomputeComputedFieldsAndRefresh(undefined, { contextKeys })
    return true
  }

  runtimeStateStore.setProjectionInvalidation(["rowsChanged"])
  if (!flatIdentityProjectionRefreshRuntime.tryApply()) {
    computeHostRuntime.recomputeFromStage("compute")
  }

  return {
    kind: "client",
    getSnapshot,
    getSourceRows() {
      ensureActive()
      return getMaterializedSourceRows()
    },
    getSourceRowsRevision() {
      ensureActive()
      return runtimeState.rowRevision
    },
    getFormulaStructureRevision() {
      ensureActive()
      return formulaStructureRevision
    },
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
      mutationHostRuntime.setRows(nextRows)
    },
    replaceRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      mutationHostRuntime.setRows(nextRows)
    },
    appendRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      if (nextRows.length === 0) {
        return
      }
      mutationHostRuntime.setRows([...getBaseSourceRows(), ...nextRows])
    },
    prependRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      if (nextRows.length === 0) {
        return
      }
      mutationHostRuntime.setRows([...nextRows, ...getBaseSourceRows()])
    },
    insertRowsAt(index: number, nextRows: readonly DataGridRowNodeInput<T>[]) {
      return mutationHostRuntime.insertRowsAt(index, nextRows)
    },
    insertRowsBefore(rowId: DataGridRowId, nextRows: readonly DataGridRowNodeInput<T>[]) {
      return mutationHostRuntime.insertRowsBefore(rowId, nextRows)
    },
    insertRowsAfter(rowId: DataGridRowId, nextRows: readonly DataGridRowNodeInput<T>[]) {
      return mutationHostRuntime.insertRowsAfter(rowId, nextRows)
    },
    patchRows(
      updates: readonly DataGridClientRowPatch<T>[],
      options: DataGridClientRowPatchOptions = {},
    ) {
      patchHostRuntime.patchRows(updates, options)
    },
    registerComputedField(definition: DataGridComputedFieldDefinition<T>) {
      formulaHostRuntime.resolveModule().registerComputedField(definition)
    },
    registerFormulaField(definition: DataGridFormulaFieldDefinition) {
      formulaHostRuntime.resolveModule().registerFormulaField(definition)
    },
    getComputedFields() {
      return formulaHostRuntime.resolveModule().getComputedFields()
    },
    getFormulaFields() {
      return formulaHostRuntime.resolveModule().getFormulaFields()
    },
    registerFormulaFunction(
      name: string,
      definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[], context?: DataGridComputedFieldComputeContext<unknown>) => unknown),
    ) {
      formulaHostRuntime.resolveModule().registerFormulaFunction(name, definition)
    },
    unregisterFormulaFunction(name: string) {
      return formulaHostRuntime.resolveModule().unregisterFormulaFunction(name)
    },
    getFormulaFunctionNames() {
      return formulaHostRuntime.resolveModule().getFormulaFunctionNames()
    },
    setFormulaTable(name: string, rows: DataGridFormulaTableSource) {
      applyFormulaTablePatch({
        set: [{ name, rows }],
      })
    },
    patchFormulaTables(patch: DataGridFormulaTablePatch) {
      return applyFormulaTablePatch(patch)
    },
    removeFormulaTable(name: string) {
      return applyFormulaTablePatch({
        remove: [name],
      })
    },
    getFormulaTableNames() {
      ensureActive()
      return computedRegistry.getFormulaTableNames()
    },
    getFormulaExecutionPlan() {
      return formulaHostRuntime.resolveModule().getFormulaExecutionPlan()
    },
    getFormulaGraph() {
      return formulaHostRuntime.resolveModule().getFormulaGraph()
    },
    getFormulaComputeStageDiagnostics() {
      return formulaHostRuntime.resolveModule().getFormulaComputeStageDiagnostics()
    },
    getFormulaRowRecomputeDiagnostics() {
      return formulaHostRuntime.resolveModule().getFormulaRowRecomputeDiagnostics()
    },
    recomputeComputedFields(rowIds?: readonly DataGridRowId[]) {
      return formulaHostRuntime.resolveModule().recomputeComputedFields(rowIds)
    },
    recomputeFormulaContext(request: DataGridFormulaContextRecomputeRequest) {
      return formulaHostRuntime.resolveModule().recomputeFormulaContext(request)
    },
    reorderRows(input: DataGridClientRowReorderInput) {
      return mutationHostRuntime.reorderRows(input)
    },
    createCalculationSnapshot() {
      ensureActive()
      return snapshotHostRuntime.createCalculationSnapshot()
    },
    restoreCalculationSnapshot(snapshot, options = {}) {
      ensureActive()
      return snapshotHostRuntime.restoreCalculationSnapshot(snapshot, options)
    },
    inspectCalculationSnapshot(snapshot, options = {}) {
      ensureActive()
      return snapshotHostRuntime.inspectCalculationSnapshot(snapshot, options)
    },
    pushCalculationSnapshot(label?: string) {
      ensureActive()
      return snapshotHostRuntime.pushCalculationSnapshot(label)
    },
    undoCalculationSnapshot(options = {}) {
      ensureActive()
      return snapshotHostRuntime.undoCalculationSnapshot(options)
    },
    redoCalculationSnapshot(options = {}) {
      ensureActive()
      return snapshotHostRuntime.redoCalculationSnapshot(options)
    },
    getCalculationSnapshotHistory() {
      ensureActive()
      return snapshotHostRuntime.getCalculationSnapshotHistory()
    },
    setViewportRange(range: DataGridViewportRange) {
      mutationHostRuntime.setViewportRange(range)
    },
    setPagination(nextPagination: DataGridPaginationInput | null) {
      mutationHostRuntime.setPagination(nextPagination)
    },
    setPageSize(pageSize: number | null) {
      mutationHostRuntime.setPageSize(pageSize)
    },
    setCurrentPage(page: number) {
      mutationHostRuntime.setCurrentPage(page)
    },
    setSortModel(nextSortModel: readonly DataGridSortState[]) {
      mutationHostRuntime.setSortModel(nextSortModel)
    },
    setFilterModel(nextFilterModel: DataGridFilterSnapshot | null) {
      mutationHostRuntime.setFilterModel(nextFilterModel)
    },
    setSortAndFilterModel(input: DataGridSortAndFilterModelInput) {
      mutationHostRuntime.setSortAndFilterModel(input)
    },
    setGroupBy(nextGroupBy: DataGridGroupBySpec | null) {
      mutationHostRuntime.setGroupBy(nextGroupBy)
    },
    setPivotModel(nextPivotModel: DataGridPivotSpec | null) {
      mutationHostRuntime.setPivotModel(nextPivotModel)
    },
    getPivotModel() {
      return clonePivotSpec(viewStateRuntime.getPivotModel())
    },
    getPivotCellDrilldown(input: DataGridPivotCellDrilldownInput) {
      ensureActive()
      const drilldown = resolveClientRowPivotCellDrilldown({
        input,
        pivotModel: getPivotModel(),
        pivotColumns: getPivotColumns(),
        aggregatedRowsProjection: runtimeState.aggregatedRowsProjection,
        pivotedRowsProjection: runtimeState.pivotedRowsProjection,
        groupedRowsProjection: runtimeState.groupedRowsProjection,
        sourceRows: getBaseSourceRows(),
        isDataGridRowId,
        normalizePivotAxisValue: (value: unknown) => normalizePivotAxisValue(value, normalizeText),
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
      mutationHostRuntime.setAggregationModel(nextAggregationModel)
    },
    getAggregationModel() {
      return cloneAggregationModel(viewStateRuntime.getAggregationModel())
    },
    getColumnHistogram(columnId: string, histogramOptions?: DataGridColumnHistogramOptions) {
      ensureActive()
      const normalizedColumnId = columnId.trim()
      if (normalizedColumnId.length === 0) {
        return []
      }

      const scope = histogramOptions?.scope ?? "filtered"
      if (scope === "sourceAll") {
        return buildColumnHistogram(getBaseSourceRows(), normalizedColumnId, histogramOptions, {
          readField: readProjectionRowField,
          readFilterCell: options.readFilterCell,
          readFilterCellStyle: options.readFilterCellStyle,
        })
      }

      if (histogramOptions?.ignoreSelfFilter === true) {
        const filterPredicate = derivedCacheRuntime.resolveFilterPredicate({ ignoreColumnFilterKey: normalizedColumnId })
        const rowsForHistogram: DataGridRowNode<T>[] = []
        for (const row of getBaseSourceRows()) {
          if (filterPredicate(row)) {
            rowsForHistogram.push(row)
          }
        }
        return buildColumnHistogram(rowsForHistogram, normalizedColumnId, histogramOptions, {
          readField: readProjectionRowField,
          readFilterCell: options.readFilterCell,
          readFilterCellStyle: options.readFilterCellStyle,
        })
      }

      return buildColumnHistogram(
        runtimeState.filteredRowsProjection,
        normalizedColumnId,
        histogramOptions,
        {
          readField: readProjectionRowField,
          readFilterCell: options.readFilterCell,
          readFilterCellStyle: options.readFilterCellStyle,
        },
      )
    },
    setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null) {
      mutationHostRuntime.setGroupExpansion(expansion)
    },
    toggleGroup(groupKey: string) {
      mutationHostRuntime.toggleGroup(groupKey)
    },
    expandGroup(groupKey: string) {
      mutationHostRuntime.expandGroup(groupKey)
    },
    collapseGroup(groupKey: string) {
      mutationHostRuntime.collapseGroup(groupKey)
    },
    expandAllGroups() {
      mutationHostRuntime.expandAllGroups()
    },
    collapseAllGroups() {
      mutationHostRuntime.collapseAllGroups()
    },
    refresh(reason?: DataGridRowModelRefreshReason) {
      ensureActive()
      runtimeStateStore.setProjectionInvalidation(
        reason === "sort-change" ? ["sortChanged"] : ["manualRefresh"],
      )
      if (!flatIdentityProjectionRefreshRuntime.tryApply()) {
        computeHostRuntime.refresh()
      }
      emit()
    },
    subscribe(listener: DataGridRowModelListener<T>) {
      return lifecycle.subscribe(listener)
    },
    getDerivedCacheDiagnostics() {
      return derivedCacheRuntime.getDiagnostics()
    },
    getComputeMode() {
      return computeHostRuntime.getMode()
    },
    switchComputeMode(nextMode: DataGridClientComputeMode) {
      return computeHostRuntime.switchMode(nextMode)
    },
    getComputeDiagnostics() {
      return computeHostRuntime.getDiagnostics()
    },
    dispose() {
      if (!lifecycle.dispose()) {
        return
      }
      formulaHostRuntime.dispose()
      computeHostRuntime.dispose()
      clearSourceRowsState()
      clearSourceColumnValuesCache()
      runtimeState.rows = []
      runtimeState.filteredRowsProjection = []
      runtimeState.sortedRowsProjection = []
      runtimeState.groupedRowsProjection = []
      runtimeState.pivotedRowsProjection = []
      runtimeState.aggregatedRowsProjection = []
      runtimeState.paginatedRowsProjection = []
      materializedSourceRowsCache = []
      materializedSourceRowsCacheRevision = -1
      resetPivotColumns()
      rowVersionRuntime.clear()
      projectionIntegrationHostRuntime.resetGroupByIncrementalAggregationState()
      projectionTransientStateRuntime.resetGroupedProjectionGroupIndexByRowId()
      treePivotIntegrationRuntime.resetPivotExpansionState()
      expansionHostRuntime.resetExpansionState()
      derivedCacheRuntime.clearSortValueCache()
      derivedCacheRuntime.clearGroupValueCache()
      computedRegistry.clear()
      computedRegistryRef.current = null
      formulaDiagnosticsRuntime.commitFormulaComputeStageDiagnostics(
        createEmptyFormulaComputeStageDiagnostics(),
      )
      formulaDiagnosticsRuntime.commitFormulaRowRecomputeDiagnostics({ rows: [] })
      runtimeStateStore.setProjectionFormulaDiagnostics(null)
      projectionIntegrationHostRuntime.invalidateTreeProjectionCaches()
      derivedCacheRuntime.clearFilterPredicateCache()
    },
  }
}
