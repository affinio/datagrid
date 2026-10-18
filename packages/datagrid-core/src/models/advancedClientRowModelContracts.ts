import type {
  DataGridComputedFieldComputeContext,
  DataGridComputedFieldDefinition,
  DataGridComputedFieldSnapshot,
  DataGridFilterCellStyleReader,
  DataGridFilterSnapshot,
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaContextRecomputeRequest,
  DataGridFormulaFieldDefinition,
  DataGridFormulaFieldSnapshot,
  DataGridFormulaIterativeCalculationOptions,
  DataGridFormulaReferenceParserOptions,
  DataGridFormulaRowRecomputeDiagnostics,
  DataGridFormulaTablePatch,
  DataGridFormulaTableSource,
  DataGridFormulaValue,
  DataGridGroupBySpec,
  DataGridPaginationInput,
  DataGridProjectionStageTimer,
  DataGridRowId,
  DataGridRowIdResolver,
  DataGridRowModel,
  DataGridRowNode,
  DataGridRowNodeInput,
  DataGridSortAndFilterModelInput,
  DataGridSortState,
  DataGridTreeDataSpec,
} from "./rowModel.js"
import type {
  DataGridAggregationModel,
  DataGridColumnHistogram,
  DataGridColumnHistogramOptions,
  DataGridFormulaCyclePolicy,
  DataGridPivotSpec,
} from "./rowModel.js"
import type {
  DataGridFormulaFunctionDefinition,
  DataGridFormulaFunctionRegistry,
} from "./formula/formulaEngine.js"
import type { DataGridClientComputeDiagnostics, DataGridClientComputeMode, DataGridClientComputeTransport } from "./compute/clientRowComputeRuntime.js"
import type { DataGridClientPerformanceMode, DataGridProjectionPolicy } from "./projection/projectionPolicy.js"
import type { DataGridFieldDependency } from "./dependency/dependencyGraph.js"
import type {
  DataGridCalculationHistory,
  DataGridCalculationHistoryEntry,
  DataGridCalculationSnapshot,
  DataGridCalculationSnapshotInspection,
  DataGridCalculationSnapshotRestoreOptions,
} from "./snapshot/clientRowCalculationSnapshotRuntime.js"
import type { DataGridClientRowModelDerivedCacheDiagnostics } from "./projection/clientRowDerivedCacheRuntime.js"

export interface CreateAdvancedClientRowModelOptions<T> {
  rows?: readonly DataGridRowNodeInput<T>[]
  resolveRowId?: DataGridRowIdResolver<T>
  readFilterCell?: (rowNode: DataGridRowNode<T>, columnKey: string) => unknown
  readFilterCellStyle?: DataGridFilterCellStyleReader<T>
  /** Clones row payloads on ingest to isolate the model from later external mutation. Default: `true`. */
  isolateInputRows?: boolean
  initialTreeData?: DataGridTreeDataSpec<T> | null
  initialSortModel?: readonly DataGridSortState[]
  initialFilterModel?: DataGridFilterSnapshot | null
  initialGroupBy?: DataGridGroupBySpec | null
  initialPivotModel?: DataGridPivotSpec | null
  initialAggregationModel?: DataGridAggregationModel<T> | null
  comparatorRegistry?: import("./comparator/comparatorPolicy.js").DataGridComparatorRegistryInput<T> | null
  aggregationRegistry?: import("./aggregation/aggregationEngine.js").DataGridAggregationRegistryInput<T>
    | import("./aggregation/aggregationEngine.js").DataGridAggregationRegistry<T>
    | null
  /** Optional fail-closed cap for dense client pivot output cells. */
  maxPivotOutputCells?: number
  /** Omits absent aggregate fields from client pivot row payloads. */
  sparsePivotOutput?: boolean
  sparsePivotStorage?: boolean
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
  /** Worker-mode patch routing threshold. Default: `64`. */
  workerPatchDispatchThreshold?: number | null
  /** Optional cap for formula source column-cache entries; null/undefined is unlimited. */
  formulaColumnCacheMaxColumns?: number | null
  /** Captures verbose per-row formula recompute diagnostics. Default: `true`. */
  captureFormulaRowRecomputeDiagnostics?: boolean
  /** Captures formula explain diagnostics. Default: `true`. */
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
  /** `false` keeps current projection order until explicit reapply or recompute-enabled patch. */
  recomputeSort?: boolean
  /** `false` keeps current filter membership until explicit reapply or recompute-enabled patch. */
  recomputeFilter?: boolean
  /** `false` keeps current grouping and pivot layout until explicit reapply or recompute-enabled patch. */
  recomputeGroup?: boolean
  emit?: boolean
  signal?: AbortSignal | null
}

export interface ClientRowModel<T> extends DataGridRowModel<T> {
  getSourceRows(): readonly DataGridRowNode<T>[]
  getSourceRowsRevision(): number
  getFormulaStructureRevision(): number
  setRows(rows: readonly DataGridRowNodeInput<T>[]): void
  removeRows(rowIds: readonly DataGridRowId[]): boolean
  replaceRows(rows: readonly DataGridRowNodeInput<T>[]): void
  appendRows(rows: readonly DataGridRowNodeInput<T>[]): void
  prependRows(rows: readonly DataGridRowNodeInput<T>[]): void
  insertRowsAt(index: number, rows: readonly DataGridRowNodeInput<T>[]): boolean
  insertRowsBefore(rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]): boolean
  insertRowsAfter(rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]): boolean
  setSortAndFilterModel(input: DataGridSortAndFilterModelInput): void
  getColumnHistogram(columnId: string, options?: DataGridColumnHistogramOptions): DataGridColumnHistogram
  patchRows(updates: readonly DataGridClientRowPatch<T>[], options?: DataGridClientRowPatchOptions): void
  registerComputedField(definition: DataGridComputedFieldDefinition<T>): void
  unregisterComputedField(name: string): boolean
  getComputedFields(): readonly DataGridComputedFieldSnapshot[]
  recomputeComputedFields(rowIds?: readonly DataGridRowId[]): number
  registerFormulaField(definition: DataGridFormulaFieldDefinition): void
  unregisterFormulaField(name: string): boolean
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
  getFormulaExecutionPlan(): import("@affino/datagrid-formula-engine").DataGridFormulaExecutionPlanSnapshot | null
  getFormulaGraph(): import("@affino/datagrid-formula-engine").DataGridFormulaGraphSnapshot | null
  getFormulaComputeStageDiagnostics(): DataGridFormulaComputeStageDiagnostics | null
  getFormulaRowRecomputeDiagnostics(): DataGridFormulaRowRecomputeDiagnostics | null
  reorderRows(input: DataGridClientRowReorderInput): boolean
  createCalculationSnapshot(): DataGridCalculationSnapshot<T>
  restoreCalculationSnapshot(snapshot: DataGridCalculationSnapshot<T>, options?: DataGridCalculationSnapshotRestoreOptions): boolean
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
