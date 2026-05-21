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
  createFilterPredicate,
} from "./projection/clientRowProjectionPrimitives.js"
import { createClientRowColumnHistogramRuntime } from "./projection/clientRowColumnHistogramRuntime.js"
import {
  applyRowDataPatch,
  mergeRowPatch,
} from "./clientRowRuntimeUtils.js"
import type { DataGridFieldDependency } from "./dependency/dependencyGraph.js"
import { createClientRowPivotDrilldownHostRuntime } from "./pivot/clientRowPivotDrilldownHostRuntime.js"
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
  type DataGridCalculationHistory,
  type DataGridCalculationHistoryEntry,
  type DataGridCalculationSnapshot,
  type DataGridCalculationSnapshotInspection,
  type DataGridCalculationSnapshotRestoreOptions,
} from "./snapshot/clientRowCalculationSnapshotRuntime.js"
import { createClientRowCalculationSnapshotRestoreRuntime } from "./snapshot/clientRowCalculationSnapshotRestoreRuntime.js"
import {
  createClientRowComputedSnapshotRuntime,
} from "./materialization/clientRowComputedSnapshotRuntime.js"
import {
  createClientRowComputedRegistryRuntime,
  type ClientRowComputedRegistryRuntime,
} from "./compute/clientRowComputedRegistryRuntime.js"
import { createClientRowComputedFieldHostRuntime } from "./host/clientRowComputedFieldHostRuntime.js"
import { createClientRowFormulaHostRuntime } from "./host/clientRowFormulaHostRuntime.js"
import { createClientRowFormulaTableHostRuntime } from "./host/clientRowFormulaTableHostRuntime.js"
import { createClientRowDisposeHostRuntime } from "./host/clientRowDisposeHostRuntime.js"
import { createClientRowRefreshHostRuntime } from "./host/clientRowRefreshHostRuntime.js"
import { createClientRowAccessHostRuntime } from "./host/clientRowAccessHostRuntime.js"
import { createClientRowRowsFacadeRuntime } from "./host/clientRowRowsFacadeRuntime.js"
import { createClientRowCalculationSnapshotFacadeRuntime } from "./host/clientRowCalculationSnapshotFacadeRuntime.js"
import { createClientRowFormulaFacadeRuntime } from "./host/clientRowFormulaFacadeRuntime.js"
import {
  createClientRowComputedExecutionRuntime,
  type ApplyComputedFieldsToSourceRowsOptions,
  type ApplyComputedFieldsToSourceRowsResult,
} from "./compute/clientRowComputedExecutionRuntime.js"
import { createClientRowComputedApplyRuntime } from "./compute/clientRowComputedApplyRuntime.js"
import { createClientRowComputedRefreshRuntime } from "./compute/clientRowComputedRefreshRuntime.js"
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
  createDataGridComparatorRegistry,
  type DataGridComparatorRegistryInput,
} from "./comparator/comparatorPolicy.js"
import type {
  DataGridAggregationRegistry,
  DataGridAggregationRegistryInput,
} from "./aggregation/aggregationEngine.js"
import {
  snapshotDataGridFormulaGraph,
  snapshotDataGridFormulaExecutionPlan,
  type DataGridFormulaGraphSnapshot,
  type DataGridFormulaExecutionPlanSnapshot,
} from "@affino/datagrid-formula-engine"
import {
  DATAGRID_COMPUTE_VECTOR_BATCH_SIZE,
  DATAGRID_FORMULA_RUNTIME_ERRORS_PREVIEW_LIMIT,
  isDataGridColumnCacheParityVerificationEnabled,
  isDataGridRowId,
  isRecord,
  normalizeFormulaColumnCacheMaxColumns,
} from "./clientRowModelRuntimeConfig.js"

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
  comparatorRegistry?: DataGridComparatorRegistryInput<T> | null
  aggregationRegistry?: DataGridAggregationRegistryInput<T> | DataGridAggregationRegistry<T> | null
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
  previousData?: Partial<T>
  revisions?: Readonly<Record<string, string | number | null>>
  revision?: string | number | null
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
  const columnHistogramRuntime = createClientRowColumnHistogramRuntime<T>({
    ensureActive: () => lifecycle.ensureActive(),
    getBaseSourceRows,
    getFilteredRowsProjection: () => runtimeState.filteredRowsProjection,
    readProjectionRowField: (row, key, field) => readProjectionRowField(row, key, field),
    readFilterCell: options.readFilterCell,
    readFilterCellStyle: options.readFilterCellStyle,
    resolveFilterPredicate: filterOptions => derivedCacheRuntime.resolveFilterPredicate(filterOptions),
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
    aggregationRegistry: options.aggregationRegistry,
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
  let formulaStructureRevision = 0
  const getMaterializedSourceRows = (): readonly DataGridRowNode<T>[] => {
    return materializationRuntime.getMaterializedSourceRows(runtimeState.rowRevision)
  }
  const materializeOutputRow = materializationRuntime.materializeOutputRow
  const materializeOutputRows = materializationRuntime.materializeOutputRows
  const materializeOutputRowsInRange = materializationRuntime.materializeOutputRowsInRange
  const refreshMaterializedSourceRows = sourceColumnHostRuntime.refreshMaterializedSourceRows
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
  const computedApplyRuntime = createClientRowComputedApplyRuntime<T>({
    executeComputedFields: applyOptions =>
      computedExecutionRuntime.applyComputedFieldsToSourceRows(applyOptions),
    syncComputedSnapshotFields: () => computedSnapshotFieldsRuntime.sync(),
    applyComputedUpdates: updates => computedSnapshotRuntime.applyComputedUpdates(updates),
    refreshMaterializedSourceRows,
  })
  const applyComputedFieldsToSourceRows: (
    options?: ApplyComputedFieldsToSourceRowsOptions,
  ) => ApplyComputedFieldsToSourceRowsResult<T> = applyOptions =>
    computedApplyRuntime.applyComputedFieldsToSourceRows(applyOptions)
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
    comparatorRegistry: createDataGridComparatorRegistry(options.comparatorRegistry),
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

  const calculationSnapshotRestoreRuntime = createClientRowCalculationSnapshotRestoreRuntime<T>({
    syncComputedSnapshotFields: () => computedSnapshotFieldsRuntime.sync(),
    replaceComputedSnapshot: snapshot => {
      computedSnapshotRuntime.replaceRowBoundSnapshot(snapshot)
    },
    refreshMaterializedSourceRows,
    cloneSortModel,
    setSortModel,
    cloneFilterModel,
    setFilterModel,
    isTreeDataEnabled: () => Boolean(treeData),
    cloneGroupBySpec,
    setGroupBy,
    restoreExpansionSnapshot: snapshot => {
      expansionHostRuntime.restoreExpansionSnapshot(snapshot)
    },
    clonePivotSpec,
    setPivotModel,
    normalizePivotColumns: columns => pivotRuntime.normalizeColumns(columns),
    setPivotColumns,
    resetPivotExpansionState: () => {
      treePivotIntegrationRuntime.resetPivotExpansionState()
    },
    cloneAggregationModel,
    setAggregationModel,
    normalizePaginationInput,
    setPaginationInput,
    normalizeViewportRange,
    getOutputRowCount: () => runtimeState.rows.length,
    setViewportRange,
    createEmptyFormulaDiagnostics,
    commitFormulaDiagnostics,
    createEmptyFormulaComputeStageDiagnostics,
    commitFormulaComputeStageDiagnostics,
    commitFormulaRowRecomputeDiagnostics,
    resetDerivedCaches: () => {
      derivedCacheRuntime.resetAllCaches()
    },
    clearPendingPivotValuePatch: () => {
      treePivotIntegrationRuntime.clearPendingPivotValuePatch()
    },
    resetGroupByIncrementalAggregationState: () => {
      projectionTransientStateRuntime.resetGroupByIncrementalAggregationState()
    },
    invalidateTreeProjectionCaches: () => {
      treePivotIntegrationRuntime.invalidateTreeProjectionCaches()
    },
    setProjectionInvalidation: reasons => {
      runtimeStateStore.setProjectionInvalidation(reasons)
    },
    tryApplyFlatIdentityProjectionRefresh: () => flatIdentityProjectionRefreshRuntime.tryApply(),
    refreshComputeHost: () => {
      computeHostRuntime.refresh()
    },
    emit,
  })

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
      calculationSnapshotRestoreRuntime.restoreCalculationSnapshot(snapshot, restoreOptions),
  })

  const {
    snapshotHostRuntime,
  } = snapshotBootstrap
  const calculationSnapshotFacadeRuntime = createClientRowCalculationSnapshotFacadeRuntime<T>({
    ensureActive,
    snapshotHostRuntime,
  })

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
  const rowAccessHostRuntime = createClientRowAccessHostRuntime<T>({
    ensureActive,
    getMaterializedSourceRows,
    getRowRevision: () => runtimeState.rowRevision,
    getFormulaStructureRevision: () => formulaStructureRevision,
    getRows: () => runtimeState.rows,
    normalizeViewportRange,
    materializeOutputRow,
    materializeOutputRowsInRange,
  })
  const rowsFacadeRuntime = createClientRowRowsFacadeRuntime<T>({
    getBaseSourceRows,
    setRows: rows => {
      mutationHostRuntime.setRows(rows)
    },
    insertRowsAt: mutationHostRuntime.insertRowsAt,
    insertRowsBefore: mutationHostRuntime.insertRowsBefore,
    insertRowsAfter: mutationHostRuntime.insertRowsAfter,
  })

  const computedRefreshRuntime = createClientRowComputedRefreshRuntime<T>({
    applyComputedFieldsToSourceRows,
    commitFormulaDiagnostics,
    commitFormulaComputeStageDiagnostics,
    commitFormulaRowRecomputeDiagnostics,
    bumpRowVersions: rowIds => {
      rowVersionRuntime.bump(rowIds)
    },
    bumpRowRevision: () => {
      runtimeStateStore.bumpRowRevision()
    },
    resetGroupByIncrementalAggregationState: () => {
      projectionIntegrationHostRuntime.resetGroupByIncrementalAggregationState()
    },
    invalidateTreeProjectionCaches: () => {
      projectionIntegrationHostRuntime.invalidateTreeProjectionCaches()
    },
    markComputedProjectionInvalidated: () => {
      runtimeStateStore.setProjectionInvalidation(["computedChanged"])
    },
    tryApplyFlatIdentityProjectionRefresh: () => flatIdentityProjectionRefreshRuntime.tryApply(),
    recomputeFromComputeStage: () => {
      computeHostRuntime.recomputeFromStage("compute")
    },
    emit,
  })
  const recomputeComputedFieldsAndRefresh = computedRefreshRuntime.recomputeComputedFieldsAndRefresh

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

  const formulaTableHostRuntime = createClientRowFormulaTableHostRuntime({
    ensureActive,
    setFormulaTable: computedRegistry.setFormulaTable,
    removeFormulaTable: computedRegistry.removeFormulaTable,
    getFormulaTableNames: computedRegistry.getFormulaTableNames,
    recomputeFormulaContext: contextKeys => {
      void recomputeComputedFieldsAndRefresh(undefined, { contextKeys })
    },
  })
  const formulaFacadeRuntime = createClientRowFormulaFacadeRuntime<T>({
    resolveFormulaModule: () => formulaHostRuntime.resolveModule(),
    formulaTableHostRuntime,
  })
  const pivotDrilldownHostRuntime = createClientRowPivotDrilldownHostRuntime<T>({
    ensureActive,
    getPivotModel,
    getPivotColumns,
    getAggregatedRowsProjection: () => runtimeState.aggregatedRowsProjection,
    getPivotedRowsProjection: () => runtimeState.pivotedRowsProjection,
    getGroupedRowsProjection: () => runtimeState.groupedRowsProjection,
    getSourceRows: () => getBaseSourceRows(),
    isDataGridRowId,
    readProjectionRowField: (row, key) => readProjectionRowField(row, key),
    materializeOutputRows,
  })
  const disposeHostRuntime = createClientRowDisposeHostRuntime<T>({
    lifecycle,
    formulaHostRuntime,
    computeHostRuntime,
    clearSourceRowsState,
    clearSourceColumnValuesCache,
    runtimeState,
    materializationRuntime,
    resetPivotColumns,
    rowVersionRuntime,
    projectionIntegrationHostRuntime,
    projectionTransientStateRuntime,
    treePivotIntegrationRuntime,
    expansionHostRuntime,
    derivedCacheRuntime,
    computedRegistry,
    computedRegistryRef,
    formulaDiagnosticsRuntime,
    runtimeStateStore,
  })
  const refreshHostRuntime = createClientRowRefreshHostRuntime({
    ensureActive,
    setProjectionInvalidation: reasons => {
      runtimeStateStore.setProjectionInvalidation(reasons)
    },
    tryApplyFlatIdentityProjectionRefresh: () => flatIdentityProjectionRefreshRuntime.tryApply(),
    refreshComputeHost: () => {
      computeHostRuntime.refresh()
    },
    recomputeFromComputeStage: () => {
      computeHostRuntime.recomputeFromStage("compute")
    },
    emit,
  })

  refreshHostRuntime.bootstrapInitialProjection()

  return {
    kind: "client",
    getSnapshot,
    getSourceRows() {
      return rowAccessHostRuntime.getSourceRows()
    },
    getSourceRowsRevision() {
      return rowAccessHostRuntime.getSourceRowsRevision()
    },
    getFormulaStructureRevision() {
      return rowAccessHostRuntime.getFormulaStructureRevision()
    },
    getRowCount() {
      return rowAccessHostRuntime.getRowCount()
    },
    getRow(index: number) {
      return rowAccessHostRuntime.getRow(index)
    },
    getRowsInRange(range: DataGridViewportRange) {
      return rowAccessHostRuntime.getRowsInRange(range)
    },
    setRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      rowsFacadeRuntime.setRows(nextRows)
    },
    replaceRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      rowsFacadeRuntime.replaceRows(nextRows)
    },
    appendRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      rowsFacadeRuntime.appendRows(nextRows)
    },
    prependRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      rowsFacadeRuntime.prependRows(nextRows)
    },
    insertRowsAt(index: number, nextRows: readonly DataGridRowNodeInput<T>[]) {
      return rowsFacadeRuntime.insertRowsAt(index, nextRows)
    },
    insertRowsBefore(rowId: DataGridRowId, nextRows: readonly DataGridRowNodeInput<T>[]) {
      return rowsFacadeRuntime.insertRowsBefore(rowId, nextRows)
    },
    insertRowsAfter(rowId: DataGridRowId, nextRows: readonly DataGridRowNodeInput<T>[]) {
      return rowsFacadeRuntime.insertRowsAfter(rowId, nextRows)
    },
    patchRows(
      updates: readonly DataGridClientRowPatch<T>[],
      options: DataGridClientRowPatchOptions = {},
    ) {
      patchHostRuntime.patchRows(updates, options)
    },
    registerComputedField(definition: DataGridComputedFieldDefinition<T>) {
      formulaFacadeRuntime.registerComputedField(definition)
    },
    registerFormulaField(definition: DataGridFormulaFieldDefinition) {
      formulaFacadeRuntime.registerFormulaField(definition)
    },
    getComputedFields() {
      return formulaFacadeRuntime.getComputedFields()
    },
    getFormulaFields() {
      return formulaFacadeRuntime.getFormulaFields()
    },
    registerFormulaFunction(
      name: string,
      definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[], context?: DataGridComputedFieldComputeContext<unknown>) => unknown),
    ) {
      formulaFacadeRuntime.registerFormulaFunction(name, definition)
    },
    unregisterFormulaFunction(name: string) {
      return formulaFacadeRuntime.unregisterFormulaFunction(name)
    },
    getFormulaFunctionNames() {
      return formulaFacadeRuntime.getFormulaFunctionNames()
    },
    setFormulaTable(name: string, rows: DataGridFormulaTableSource) {
      formulaFacadeRuntime.setFormulaTable(name, rows)
    },
    patchFormulaTables(patch: DataGridFormulaTablePatch) {
      return formulaFacadeRuntime.patchFormulaTables(patch)
    },
    removeFormulaTable(name: string) {
      return formulaFacadeRuntime.removeFormulaTable(name)
    },
    getFormulaTableNames() {
      return formulaFacadeRuntime.getFormulaTableNames()
    },
    getFormulaExecutionPlan() {
      return formulaFacadeRuntime.getFormulaExecutionPlan()
    },
    getFormulaGraph() {
      return formulaFacadeRuntime.getFormulaGraph()
    },
    getFormulaComputeStageDiagnostics() {
      return formulaFacadeRuntime.getFormulaComputeStageDiagnostics()
    },
    getFormulaRowRecomputeDiagnostics() {
      return formulaFacadeRuntime.getFormulaRowRecomputeDiagnostics()
    },
    recomputeComputedFields(rowIds?: readonly DataGridRowId[]) {
      return formulaFacadeRuntime.recomputeComputedFields(rowIds)
    },
    recomputeFormulaContext(request: DataGridFormulaContextRecomputeRequest) {
      return formulaFacadeRuntime.recomputeFormulaContext(request)
    },
    reorderRows(input: DataGridClientRowReorderInput) {
      return mutationHostRuntime.reorderRows(input)
    },
    createCalculationSnapshot() {
      return calculationSnapshotFacadeRuntime.createCalculationSnapshot()
    },
    restoreCalculationSnapshot(snapshot, options = {}) {
      return calculationSnapshotFacadeRuntime.restoreCalculationSnapshot(snapshot, options)
    },
    inspectCalculationSnapshot(snapshot, options = {}) {
      return calculationSnapshotFacadeRuntime.inspectCalculationSnapshot(snapshot, options)
    },
    pushCalculationSnapshot(label?: string) {
      return calculationSnapshotFacadeRuntime.pushCalculationSnapshot(label)
    },
    undoCalculationSnapshot(options = {}) {
      return calculationSnapshotFacadeRuntime.undoCalculationSnapshot(options)
    },
    redoCalculationSnapshot(options = {}) {
      return calculationSnapshotFacadeRuntime.redoCalculationSnapshot(options)
    },
    getCalculationSnapshotHistory() {
      return calculationSnapshotFacadeRuntime.getCalculationSnapshotHistory()
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
      return pivotDrilldownHostRuntime.getPivotCellDrilldown(input)
    },
    setAggregationModel(nextAggregationModel: DataGridAggregationModel<T> | null) {
      mutationHostRuntime.setAggregationModel(nextAggregationModel)
    },
    getAggregationModel() {
      return cloneAggregationModel(viewStateRuntime.getAggregationModel())
    },
    getColumnHistogram(columnId: string, histogramOptions?: DataGridColumnHistogramOptions) {
      return columnHistogramRuntime.getColumnHistogram(columnId, histogramOptions)
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
      refreshHostRuntime.refresh(reason)
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
      disposeHostRuntime.dispose()
    },
  }
}
