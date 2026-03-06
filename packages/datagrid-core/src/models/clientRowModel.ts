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
  type DataGridComputedFieldComputeContext,
  type DataGridComputedFieldSnapshot,
  type DataGridComputedDependencyToken,
  type DataGridFormulaFieldDefinition,
  type DataGridFormulaFieldSnapshot,
  type DataGridFormulaComputeStageDiagnostics,
  type DataGridFormulaRuntimeError,
  type DataGridColumnHistogram,
  type DataGridColumnHistogramOptions,
  type DataGridFilterSnapshot,
  type DataGridSortAndFilterModelInput,
  type DataGridAggregationModel,
  type DataGridGroupBySpec,
  type DataGridPivotColumn,
  type DataGridPivotSpec,
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
import { normalizeDataGridDependencyToken } from "./dependencyModel.js"
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
import type { ApplyClientRowPatchUpdatesResult } from "./clientRowPatchRuntime.js"
import {
  compileDataGridFormulaFieldDefinition,
  type DataGridCompiledFormulaField,
  type DataGridFormulaFunctionDefinition,
  type DataGridFormulaFunctionRegistry,
} from "./formulaEngine.js"
import {
  createDataGridFormulaExecutionPlan,
  snapshotDataGridFormulaExecutionPlan,
  type DataGridFormulaExecutionPlan,
  type DataGridFormulaExecutionDependencyDomain,
  type DataGridFormulaExecutionPlanSnapshot,
} from "./formulaExecutionPlan.js"

const DATAGRID_FORMULA_RUNTIME_ERRORS_PREVIEW_LIMIT = 50
const DATAGRID_COMPUTE_VECTOR_BATCH_SIZE = 1024
const DATAGRID_COLUMN_CACHE_VERIFY_FLAG = "__AFFINO_DATAGRID_VERIFY_COLUMN_CACHE__"

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
    definition: DataGridFormulaFunctionDefinition | ((args: readonly number[]) => unknown),
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
}

function isDataGridRowId(value: unknown): value is DataGridRowId {
  return typeof value === "string" || typeof value === "number"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

type DataGridCompiledPathSegment = string | number

function compileDataGridPathSegments(path: string): readonly DataGridCompiledPathSegment[] {
  if (!path.includes(".")) {
    return Object.freeze([]) as readonly DataGridCompiledPathSegment[]
  }
  return Object.freeze(
    path
      .split(".")
      .filter(segment => segment.length > 0)
      .map((segment) => {
        const parsedIndex = Number(segment)
        return Number.isInteger(parsedIndex) && parsedIndex >= 0
          ? parsedIndex
          : segment
      }),
  )
}

function createCompiledDataGridRowDataReader(
  field: string,
): (source: unknown) => unknown {
  const normalizedField = field.trim()
  if (normalizedField.length === 0) {
    return () => undefined
  }
  const compiledSegments = compileDataGridPathSegments(normalizedField)
  if (compiledSegments.length === 0) {
    return (source: unknown) => (
      isRecord(source)
        ? (source as Record<string, unknown>)[normalizedField]
        : undefined
    )
  }
  return (source: unknown) => {
    if (!isRecord(source)) {
      return undefined
    }
    const directValue = (source as Record<string, unknown>)[normalizedField]
    if (typeof directValue !== "undefined") {
      return directValue
    }
    let current: unknown = source
    for (const segment of compiledSegments) {
      if (typeof segment === "number") {
        if (!Array.isArray(current) || segment >= current.length) {
          return undefined
        }
        current = current[segment]
        continue
      }
      if (!isRecord(current) || !(segment in current)) {
        return undefined
      }
      current = (current as Record<string, unknown>)[segment]
    }
    return current
  }
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
  let sourceRowIndexById = buildRowIdPositionIndex(sourceRows)
  const sourceColumnValuesByField = new Map<string, unknown[]>()
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
  let groupedProjectionGroupIndexByRowId: ReadonlyMap<DataGridRowId, number> = new Map<DataGridRowId, number>()
  let lastTreeProjectionCacheKey: string | null = null
  let lastTreeExpansionSnapshot: DataGridGroupExpansionSnapshot | null = null
  let pendingPivotValuePatch: readonly DataGridPivotIncrementalPatchRow<T>[] | null = null
  const projectionEngine = createClientRowProjectionEngine<T>()
  type ComputedDependencyDomain = DataGridFormulaExecutionDependencyDomain
  interface DataGridResolvedComputedDependency {
    token: DataGridComputedDependencyToken
    domain: ComputedDependencyDomain
    value: string
  }
  interface DataGridRegisteredComputedField {
    name: string
    field: string
    deps: readonly DataGridResolvedComputedDependency[]
    compute: DataGridComputedFieldDefinition<T>["compute"]
  }
  interface DataGridRegisteredFormulaField {
    name: string
    field: string
    formula: string
    deps: readonly DataGridComputedDependencyToken[]
  }
  interface ApplyComputedFieldsToSourceRowsOptions {
    rowIds?: ReadonlySet<DataGridRowId>
    changedFieldsByRowId?: ReadonlyMap<DataGridRowId, ReadonlySet<string>>
    captureRowPatchMaps?: boolean
  }
  interface ApplyComputedFieldsToSourceRowsResult {
    changed: boolean
    changedRowIds: readonly DataGridRowId[]
    computedUpdatesByRowId: ReadonlyMap<DataGridRowId, Partial<T>>
    previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
    nextRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
    formulaDiagnostics: DataGridProjectionFormulaDiagnostics
    computeStageDiagnostics: DataGridFormulaComputeStageDiagnostics
  }
  interface DataGridFormulaRuntimeErrorsCollector {
    runtimeErrorCount: number
    runtimeErrors: DataGridFormulaRuntimeError[]
  }
  interface DataGridComputedColumnReadContext {
    readFieldAtRow: (
      field: string,
      rowIndex: number,
      rowNode: DataGridRowNode<T>,
    ) => unknown
  }
  type DataGridComputedTokenReader = (
    rowNode: DataGridRowNode<T>,
    rowIndex?: number,
    columnReadContext?: DataGridComputedColumnReadContext,
  ) => unknown
  const computedFieldsByName = new Map<string, DataGridRegisteredComputedField>()
  const computedFieldNameByTargetField = new Map<string, string>()
  const formulaFieldsByName = new Map<string, DataGridRegisteredFormulaField>()
  const formulaFunctionRegistry = new Map<
    string,
    DataGridFormulaFunctionDefinition | ((args: readonly number[]) => unknown)
  >()
  let computedExecutionPlan: DataGridFormulaExecutionPlan = createDataGridFormulaExecutionPlan([])
  const computedAffectedPlanCache = new Map<string, readonly number[]>()
  const rowFieldReaderCache = new Map<string, (rowNode: DataGridRowNode<T>) => unknown>()
  const computedTokenReaderCache = new Map<string, DataGridComputedTokenReader>()
  let computedOrder: readonly string[] = []
  let computedEntryByIndex: readonly DataGridRegisteredComputedField[] = []
  let computedFieldReaderByIndex: readonly ((rowNode: DataGridRowNode<T>) => unknown)[] = []
  let computedLevelIndexes: readonly (readonly number[])[] = []
  let computedDependentsByIndex: readonly (readonly number[])[] = []
  let activeFormulaRuntimeErrorsCollector: DataGridFormulaRuntimeErrorsCollector | null = null
  let latestFormulaComputeStageDiagnostics: DataGridFormulaComputeStageDiagnostics | null = null

  const createEmptyFormulaDiagnostics = (): DataGridProjectionFormulaDiagnostics => ({
    recomputedFields: [],
    runtimeErrorCount: 0,
    runtimeErrors: [],
  })

  const createEmptyFormulaComputeStageDiagnostics = (): DataGridFormulaComputeStageDiagnostics => ({
    strategy: "row",
    rowsTouched: 0,
    changedRows: 0,
    fieldsTouched: [],
    evaluations: 0,
    skippedByObjectIs: 0,
    dirtyRows: 0,
    dirtyNodes: [],
  })

  const cloneFormulaComputeStageDiagnostics = (
    diagnostics: DataGridFormulaComputeStageDiagnostics,
  ): DataGridFormulaComputeStageDiagnostics => ({
    strategy: diagnostics.strategy,
    rowsTouched: diagnostics.rowsTouched,
    changedRows: diagnostics.changedRows,
    fieldsTouched: [...diagnostics.fieldsTouched],
    evaluations: diagnostics.evaluations,
    skippedByObjectIs: diagnostics.skippedByObjectIs,
    dirtyRows: diagnostics.dirtyRows,
    dirtyNodes: [...diagnostics.dirtyNodes],
  })

  const pushFormulaRuntimeError = (runtimeError: DataGridFormulaRuntimeError): void => {
    if (!activeFormulaRuntimeErrorsCollector) {
      return
    }
    activeFormulaRuntimeErrorsCollector.runtimeErrorCount += 1
    if (activeFormulaRuntimeErrorsCollector.runtimeErrors.length >= DATAGRID_FORMULA_RUNTIME_ERRORS_PREVIEW_LIMIT) {
      return
    }
    activeFormulaRuntimeErrorsCollector.runtimeErrors.push({ ...runtimeError })
  }

  const commitFormulaDiagnostics = (diagnostics: DataGridProjectionFormulaDiagnostics): void => {
    if (
      formulaFieldsByName.size === 0
      && diagnostics.recomputedFields.length === 0
      && diagnostics.runtimeErrorCount === 0
      && diagnostics.runtimeErrors.length === 0
    ) {
      runtimeStateStore.setProjectionFormulaDiagnostics(null)
      return
    }
    runtimeStateStore.setProjectionFormulaDiagnostics(diagnostics)
  }

  const commitFormulaComputeStageDiagnostics = (
    diagnostics: DataGridFormulaComputeStageDiagnostics,
  ): void => {
    latestFormulaComputeStageDiagnostics = computedOrder.length > 0
      ? cloneFormulaComputeStageDiagnostics(diagnostics)
      : null
  }

  const getFormulaComputeStageDiagnosticsSnapshot = (): DataGridFormulaComputeStageDiagnostics | null => {
    if (!latestFormulaComputeStageDiagnostics) {
      return null
    }
    return cloneFormulaComputeStageDiagnostics(latestFormulaComputeStageDiagnostics)
  }

  const normalizeComputedName = (value: unknown): string => {
    if (typeof value !== "string") {
      throw new Error("[DataGridComputed] Computed field name must be a string.")
    }
    const normalized = value.trim()
    if (normalized.length === 0) {
      throw new Error("[DataGridComputed] Computed field name must be non-empty.")
    }
    return normalized
  }

  const normalizeFormulaFunctionName = (value: unknown): string => {
    if (typeof value !== "string") {
      throw new Error("[DataGridFormula] Formula function name must be a string.")
    }
    const normalized = value.trim().toUpperCase()
    if (normalized.length === 0) {
      throw new Error("[DataGridFormula] Formula function name must be non-empty.")
    }
    return normalized
  }

  const resolveFormulaFunctionRegistrySnapshot = (): DataGridFormulaFunctionRegistry | undefined => {
    if (formulaFunctionRegistry.size === 0) {
      return undefined
    }
    const registry: Record<string, DataGridFormulaFunctionDefinition | ((args: readonly number[]) => unknown)> = {}
    for (const [name, definition] of formulaFunctionRegistry) {
      registry[name] = definition
    }
    return registry
  }

  if (options.initialFormulaFunctionRegistry) {
    for (const [name, definition] of Object.entries(options.initialFormulaFunctionRegistry)) {
      formulaFunctionRegistry.set(normalizeFormulaFunctionName(name), definition)
    }
  }

  const normalizeComputedTargetField = (
    value: unknown,
    fallbackName: string,
  ): string => {
    const rawValue = typeof value === "string" && value.trim().length > 0
      ? value
      : fallbackName
    const normalized = rawValue.trim()
    if (normalized.length === 0) {
      throw new Error("[DataGridComputed] Computed field target must be non-empty.")
    }
    if (normalized.includes(".")) {
      throw new Error(
        `[DataGridComputed] Nested target path '${normalized}' is not supported yet. Use a top-level field.`,
      )
    }
    return normalized
  }

  const resolveComputedDependency = (
    value: DataGridComputedDependencyToken,
  ): DataGridResolvedComputedDependency => {
    const normalizedToken = normalizeDataGridDependencyToken(String(value), "field")
    if (normalizedToken.startsWith("computed:")) {
      return {
        token: normalizedToken,
        domain: "computed",
        value: normalizedToken.slice("computed:".length),
      }
    }
    if (normalizedToken.startsWith("meta:")) {
      return {
        token: normalizedToken,
        domain: "meta",
        value: normalizedToken.slice("meta:".length),
      }
    }
    return {
      token: normalizedToken,
      domain: "field",
      value: normalizedToken.slice("field:".length),
    }
  }

  const resolveRowFieldReader = (
    fieldInput: string,
  ): ((rowNode: DataGridRowNode<T>) => unknown) => {
    const field = fieldInput.trim()
    if (field.length === 0) {
      return () => undefined
    }
    const cachedReader = rowFieldReaderCache.get(field)
    if (cachedReader) {
      return cachedReader
    }
    const readDataValue = createCompiledDataGridRowDataReader(field)
    const nextReader = (rowNode: DataGridRowNode<T>): unknown => {
      return readDataValue(rowNode.data as unknown)
    }
    rowFieldReaderCache.set(field, nextReader)
    return nextReader
  }

  const clearSourceColumnValuesCache = (): void => {
    sourceColumnValuesByField.clear()
  }

  const getSourceColumnValues = (fieldInput: string): unknown[] => {
    const field = fieldInput.trim()
    let values = sourceColumnValuesByField.get(field)
    if (!values) {
      values = []
      sourceColumnValuesByField.set(field, values)
    }
    return values
  }

  const invalidateSourceColumnValuesByRowIds = (
    rowIds: readonly DataGridRowId[],
  ): void => {
    if (sourceColumnValuesByField.size === 0 || rowIds.length === 0) {
      return
    }
    const rowIndexes: number[] = []
    for (const rowId of rowIds) {
      const rowIndex = sourceRowIndexById.get(rowId)
      if (typeof rowIndex !== "number" || rowIndex < 0) {
        continue
      }
      rowIndexes.push(rowIndex)
    }
    if (rowIndexes.length === 0) {
      return
    }
    if (rowIndexes.length >= Math.max(1, Math.trunc(sourceRows.length / 2))) {
      clearSourceColumnValuesCache()
      return
    }
    for (const values of sourceColumnValuesByField.values()) {
      for (const rowIndex of rowIndexes) {
        delete values[rowIndex]
      }
    }
  }

  const rebuildComputedOrder = (): void => {
    computedExecutionPlan = createDataGridFormulaExecutionPlan(
      Array.from(computedFieldsByName.values()).map((entry) => ({
        name: entry.name,
        field: entry.field,
        deps: entry.deps.map(dep => ({
          domain: dep.domain,
          value: dep.value,
        })),
      })),
    )
    computedOrder = [...computedExecutionPlan.order]
    const nextOrderIndexByName = new Map<string, number>()
    for (let index = 0; index < computedOrder.length; index += 1) {
      const name = computedOrder[index]
      if (typeof name === "string") {
        nextOrderIndexByName.set(name, index)
      }
    }
    computedLevelIndexes = Object.freeze(
      computedExecutionPlan.levels.map((level) => Object.freeze(
        level
          .map(name => nextOrderIndexByName.get(name))
          .filter((index): index is number => typeof index === "number"),
      )),
    )
    computedDependentsByIndex = Object.freeze(
      computedOrder.map((name) => {
        const node = computedExecutionPlan.nodes.get(name)
        if (!node) {
          return Object.freeze([]) as readonly number[]
        }
        return Object.freeze(
          node.dependents
            .map(dependentName => nextOrderIndexByName.get(dependentName))
            .filter((index): index is number => typeof index === "number"),
        ) as readonly number[]
      }),
    )
    computedEntryByIndex = Object.freeze(
      computedOrder.map((name) => {
        const entry = computedFieldsByName.get(name)
        if (!entry) {
          throw new Error(`[DataGridComputed] Missing runtime entry for computed field '${name}'.`)
        }
        return entry
      }),
    )
    computedFieldReaderByIndex = Object.freeze(
      computedEntryByIndex.map(entry => resolveRowFieldReader(entry.field)),
    )
    computedAffectedPlanCache.clear()
    computedTokenReaderCache.clear()
  }

  const registerComputedFieldInternal = (
    definition: DataGridComputedFieldDefinition<T>,
  ): void => {
    const name = normalizeComputedName(definition.name)
    if (computedFieldsByName.has(name)) {
      throw new Error(`[DataGridComputed] Computed field '${name}' is already registered.`)
    }
    if (typeof definition.compute !== "function") {
      throw new Error(`[DataGridComputed] Computed field '${name}' must provide a compute function.`)
    }

    const targetField = normalizeComputedTargetField(definition.field, name)
    const existingFieldOwner = computedFieldNameByTargetField.get(targetField)
    if (existingFieldOwner) {
      throw new Error(
        `[DataGridComputed] Target field '${targetField}' is already owned by computed field '${existingFieldOwner}'.`,
      )
    }

    const rawDeps = Array.isArray(definition.deps) ? definition.deps : []
    const deps = rawDeps.map(resolveComputedDependency)
    for (const dependency of deps) {
      if (dependency.domain !== "computed") {
        continue
      }
      if (dependency.value === name) {
        throw new Error(`[DataGridComputed] Computed field '${name}' cannot depend on itself.`)
      }
      if (!computedFieldsByName.has(dependency.value)) {
        throw new Error(
          `[DataGridComputed] Missing dependency 'computed:${dependency.value}' for '${name}'.`,
        )
      }
    }

    const entry: DataGridRegisteredComputedField = {
      name,
      field: targetField,
      deps,
      compute: definition.compute,
    }
    computedFieldsByName.set(name, entry)
    computedFieldNameByTargetField.set(targetField, name)
    try {
      rebuildComputedOrder()
    } catch (error) {
      computedFieldsByName.delete(name)
      computedFieldNameByTargetField.delete(targetField)
      throw error
    }

    for (const dependency of deps) {
      if (dependency.domain === "meta") {
        continue
      }
      const sourceField = dependency.domain === "computed"
        ? computedFieldsByName.get(dependency.value)?.field
        : dependency.value
      if (!sourceField || sourceField.length === 0) {
        continue
      }
      projectionPolicy.dependencyGraph.registerDependency(
        sourceField,
        targetField,
        { kind: dependency.domain === "field" ? "structural" : "computed" },
      )
    }
  }

  const compileFormulaFieldDefinition = (
    definition: DataGridFormulaFieldDefinition,
    options: {
      knownComputedNames?: ReadonlySet<string>
      knownComputedNameByField?: ReadonlyMap<string, string>
    } = {},
  ): DataGridCompiledFormulaField<T> => {
    return compileDataGridFormulaFieldDefinition<T>(definition, {
      resolveDependencyToken: (identifier) => {
        const normalizedIdentifier = identifier.trim()
        const knownByTargetField = (
          computedFieldNameByTargetField.get(normalizedIdentifier)
          ?? options.knownComputedNameByField?.get(normalizedIdentifier)
        )
        if (knownByTargetField) {
          return `computed:${knownByTargetField}`
        }
        if (
          computedFieldsByName.has(normalizedIdentifier)
          || formulaFieldsByName.has(normalizedIdentifier)
          || options.knownComputedNames?.has(normalizedIdentifier) === true
        ) {
          return `computed:${normalizedIdentifier}`
        }
        return `field:${normalizedIdentifier}`
      },
      onRuntimeError: pushFormulaRuntimeError,
      functionRegistry: resolveFormulaFunctionRegistrySnapshot(),
    })
  }

  const compileRegisteredFormulaFields = (): Map<string, DataGridCompiledFormulaField<T>> => {
    if (formulaFieldsByName.size === 0) {
      return new Map<string, DataGridCompiledFormulaField<T>>()
    }
    const knownFormulaNames = new Set<string>()
    const knownFormulaNameByField = new Map<string, string>()
    for (const entry of formulaFieldsByName.values()) {
      knownFormulaNames.add(entry.name)
      knownFormulaNameByField.set(entry.field, entry.name)
    }
    const compiledByName = new Map<string, DataGridCompiledFormulaField<T>>()
    for (const entry of formulaFieldsByName.values()) {
      const compiled = compileFormulaFieldDefinition(
        {
          name: entry.name,
          field: entry.field,
          formula: entry.formula,
        },
        {
          knownComputedNames: knownFormulaNames,
          knownComputedNameByField: knownFormulaNameByField,
        },
      )
      if (compiled.name !== entry.name) {
        throw new Error(
          `[DataGridFormula] Formula field '${entry.name}' compiled with unexpected name '${compiled.name}'.`,
        )
      }
      if (compiled.field !== entry.field) {
        throw new Error(
          `[DataGridFormula] Formula field '${entry.name}' target changed from '${entry.field}' to '${compiled.field}'.`,
        )
      }
      compiledByName.set(entry.name, compiled)
    }
    return compiledByName
  }

  const applyCompiledFormulaFields = (
    compiledByName: ReadonlyMap<string, DataGridCompiledFormulaField<T>>,
  ): void => {
    const previousComputedFieldsByName = new Map(computedFieldsByName)
    const previousFormulaFieldsByName = new Map(formulaFieldsByName)
    const previousComputedExecutionPlan = computedExecutionPlan
    const previousComputedOrder = computedOrder
    const previousComputedEntryByIndex = computedEntryByIndex
    const previousComputedFieldReaderByIndex = computedFieldReaderByIndex
    const previousComputedLevelIndexes = computedLevelIndexes
    const previousComputedDependentsByIndex = computedDependentsByIndex
    const previousComputedAffectedPlanCache = new Map(computedAffectedPlanCache)

    try {
      for (const [formulaName, compiled] of compiledByName) {
        const computed = computedFieldsByName.get(formulaName)
        if (!computed) {
          throw new Error(
            `[DataGridFormula] Missing computed field '${formulaName}' while applying compiled formulas.`,
          )
        }
        const resolvedDeps = compiled.deps.map(resolveComputedDependency)
        computedFieldsByName.set(formulaName, {
          ...computed,
          field: compiled.field,
          deps: resolvedDeps,
          compute: compiled.compute,
        })
        formulaFieldsByName.set(formulaName, {
          name: compiled.name,
          field: compiled.field,
          formula: compiled.formula,
          deps: compiled.deps,
        })
      }
      rebuildComputedOrder()
    } catch (error) {
      computedFieldsByName.clear()
      for (const [name, entry] of previousComputedFieldsByName) {
        computedFieldsByName.set(name, entry)
      }
      formulaFieldsByName.clear()
      for (const [name, entry] of previousFormulaFieldsByName) {
        formulaFieldsByName.set(name, entry)
      }
      computedExecutionPlan = previousComputedExecutionPlan
      computedOrder = previousComputedOrder
      computedEntryByIndex = previousComputedEntryByIndex
      computedFieldReaderByIndex = previousComputedFieldReaderByIndex
      computedLevelIndexes = previousComputedLevelIndexes
      computedDependentsByIndex = previousComputedDependentsByIndex
      computedAffectedPlanCache.clear()
      for (const [key, value] of previousComputedAffectedPlanCache) {
        computedAffectedPlanCache.set(key, value)
      }
      computedTokenReaderCache.clear()
      throw error
    }
  }

  const registerFormulaFieldInternal = (
    definition: DataGridFormulaFieldDefinition,
    options: {
      knownComputedNames?: ReadonlySet<string>
      knownComputedNameByField?: ReadonlyMap<string, string>
    } = {},
  ): void => {
    const compiled = compileFormulaFieldDefinition(definition, options)
    if (formulaFieldsByName.has(compiled.name)) {
      throw new Error(`[DataGridFormula] Formula field '${compiled.name}' is already registered.`)
    }
    registerComputedFieldInternal({
      name: compiled.name,
      field: compiled.field,
      deps: compiled.deps,
      compute: compiled.compute,
    })
    formulaFieldsByName.set(compiled.name, {
      name: compiled.name,
      field: compiled.field,
      formula: compiled.formula,
      deps: compiled.deps,
    })
  }

  const resolveComputedRootIndexes = (
    changedFields: ReadonlySet<string>,
  ): readonly number[] => {
    if (computedOrder.length === 0 || changedFields.size === 0) {
      return []
    }

    const normalizedChangedFields = Array.from(changedFields)
      .map(field => field.trim())
      .filter(field => field.length > 0)
      .sort((left, right) => left.localeCompare(right))
    if (normalizedChangedFields.length === 0) {
      return []
    }

    const cacheKey = normalizedChangedFields.join("|")
    const cachedPlan = computedAffectedPlanCache.get(cacheKey)
    if (cachedPlan) {
      return cachedPlan
    }

    const affectedNames = computedExecutionPlan.directByFields(
      new Set<string>(normalizedChangedFields),
    )
    const orderedPlan = computedOrder
      .map((name, index) => (affectedNames.has(name) ? index : -1))
      .filter(index => index >= 0)
    computedAffectedPlanCache.set(cacheKey, orderedPlan)
    return orderedPlan
  }

  const resolveComputedTokenValue = (
    rowNode: DataGridRowNode<T>,
    token: DataGridComputedDependencyToken,
    rowIndex?: number,
    columnReadContext?: DataGridComputedColumnReadContext,
  ): unknown => {
    if (typeof token !== "string") {
      return undefined
    }
    const tokenInput = token.trim()
    if (tokenInput.length === 0) {
      return undefined
    }
    let reader = computedTokenReaderCache.get(tokenInput)
    if (!reader) {
      if (!tokenInput.includes(":")) {
        const computedDependency = computedFieldsByName.get(tokenInput)
        if (computedDependency) {
          const readComputedField = resolveRowFieldReader(computedDependency.field)
          const dependencyField = computedDependency.field
          reader = (
            nextRowNode: DataGridRowNode<T>,
            nextRowIndex?: number,
            nextColumnReadContext?: DataGridComputedColumnReadContext,
          ) => {
            if (
              nextColumnReadContext
              && typeof nextRowIndex === "number"
              && nextRowIndex >= 0
            ) {
              return nextColumnReadContext.readFieldAtRow(dependencyField, nextRowIndex, nextRowNode)
            }
            return readComputedField(nextRowNode)
          }
        } else {
          const readField = resolveRowFieldReader(tokenInput)
          const field = tokenInput
          reader = (
            nextRowNode: DataGridRowNode<T>,
            nextRowIndex?: number,
            nextColumnReadContext?: DataGridComputedColumnReadContext,
          ) => {
            if (
              nextColumnReadContext
              && typeof nextRowIndex === "number"
              && nextRowIndex >= 0
            ) {
              return nextColumnReadContext.readFieldAtRow(field, nextRowIndex, nextRowNode)
            }
            return readField(nextRowNode)
          }
        }
      } else {
        const dependency = resolveComputedDependency(tokenInput)
        if (dependency.domain === "meta") {
          reader = () => undefined
        } else if (dependency.domain === "computed") {
          const computedDependency = computedFieldsByName.get(dependency.value)
          if (!computedDependency) {
            reader = () => undefined
          } else {
            const readComputedField = resolveRowFieldReader(computedDependency.field)
            const dependencyField = computedDependency.field
            reader = (
              nextRowNode: DataGridRowNode<T>,
              nextRowIndex?: number,
              nextColumnReadContext?: DataGridComputedColumnReadContext,
            ) => {
              if (
                nextColumnReadContext
                && typeof nextRowIndex === "number"
                && nextRowIndex >= 0
              ) {
                return nextColumnReadContext.readFieldAtRow(dependencyField, nextRowIndex, nextRowNode)
              }
              return readComputedField(nextRowNode)
            }
          }
        } else {
          const readField = resolveRowFieldReader(dependency.value)
          const field = dependency.value
          reader = (
            nextRowNode: DataGridRowNode<T>,
            nextRowIndex?: number,
            nextColumnReadContext?: DataGridComputedColumnReadContext,
          ) => {
            if (
              nextColumnReadContext
              && typeof nextRowIndex === "number"
              && nextRowIndex >= 0
            ) {
              return nextColumnReadContext.readFieldAtRow(field, nextRowIndex, nextRowNode)
            }
            return readField(nextRowNode)
          }
        }
      }
      computedTokenReaderCache.set(tokenInput, reader)
    }
    return reader(rowNode, rowIndex, columnReadContext)
  }

  const applyComputedFieldsToSourceRows = (
    options: ApplyComputedFieldsToSourceRowsOptions = {},
  ): ApplyComputedFieldsToSourceRowsResult => {
    if (computedOrder.length === 0 || sourceRows.length === 0) {
      return {
        changed: false,
        changedRowIds: [],
        computedUpdatesByRowId: new Map<DataGridRowId, Partial<T>>(),
        previousRowsById: new Map<DataGridRowId, DataGridRowNode<T>>(),
        nextRowsById: new Map<DataGridRowId, DataGridRowNode<T>>(),
        formulaDiagnostics: createEmptyFormulaDiagnostics(),
        computeStageDiagnostics: createEmptyFormulaComputeStageDiagnostics(),
      }
    }

    const sourceRowsBaseline = sourceRows
    const captureRowPatchMaps = options.captureRowPatchMaps === true
    const rowCount = sourceRowsBaseline.length
    const rowIds = options.rowIds
    const hasExplicitChangedFields = Boolean(options.changedFieldsByRowId)
    const selectedRowIndexes: number[] = []
    const nodeCount = computedOrder.length
    const dirtyRowIndexesByNode = new Array<number[] | undefined>(nodeCount)
    const dirtyNodeMarks = new Uint8Array(nodeCount)
    let dirtyNodeCount = 0
    const dirtyRowMarks = new Uint8Array(rowCount)
    let dirtyRowsCount = 0

    const markDirtyRow = (rowIndex: number): void => {
      if (dirtyRowMarks[rowIndex] !== 0) {
        return
      }
      dirtyRowMarks[rowIndex] = 1
      dirtyRowsCount += 1
    }

    const markDirtyNode = (nodeIndex: number): void => {
      if (dirtyNodeMarks[nodeIndex] !== 0) {
        return
      }
      dirtyNodeMarks[nodeIndex] = 1
      dirtyNodeCount += 1
    }

    const enqueueDirtyNodeRowIndex = (nodeIndex: number, rowIndex: number): void => {
      let nodeDirtyRows = dirtyRowIndexesByNode[nodeIndex]
      if (!nodeDirtyRows) {
        nodeDirtyRows = []
        dirtyRowIndexesByNode[nodeIndex] = nodeDirtyRows
      }
      nodeDirtyRows.push(rowIndex)
      markDirtyNode(nodeIndex)
      markDirtyRow(rowIndex)
    }

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = sourceRowsBaseline[rowIndex]
      if (!row) {
        continue
      }
      if (rowIds && !rowIds.has(row.rowId)) {
        continue
      }
      if (!isRecord(row.data)) {
        continue
      }

      if (!hasExplicitChangedFields) {
        selectedRowIndexes.push(rowIndex)
        continue
      }

      const rawChangedFields = options.changedFieldsByRowId?.get(row.rowId) ?? null
      if (!rawChangedFields || rawChangedFields.size === 0) {
        continue
      }
      const normalizedChangedFields = new Set<string>()
      for (const field of rawChangedFields) {
        const normalized = field.trim()
        if (normalized.length > 0) {
          normalizedChangedFields.add(normalized)
        }
      }
      if (normalizedChangedFields.size === 0) {
        continue
      }
      const rootOrderIndexes = resolveComputedRootIndexes(normalizedChangedFields)
      if (rootOrderIndexes.length === 0) {
        continue
      }

      selectedRowIndexes.push(rowIndex)
      for (const nodeIndex of rootOrderIndexes) {
        enqueueDirtyNodeRowIndex(nodeIndex, rowIndex)
      }
    }

    if (selectedRowIndexes.length === 0) {
      return {
        changed: false,
        changedRowIds: [],
        computedUpdatesByRowId: new Map<DataGridRowId, Partial<T>>(),
        previousRowsById: new Map<DataGridRowId, DataGridRowNode<T>>(),
        nextRowsById: new Map<DataGridRowId, DataGridRowNode<T>>(),
        formulaDiagnostics: createEmptyFormulaDiagnostics(),
        computeStageDiagnostics: createEmptyFormulaComputeStageDiagnostics(),
      }
    }

    const levelsToRun = computedLevelIndexes

    if (levelsToRun.length === 0) {
      return {
        changed: false,
        changedRowIds: [],
        computedUpdatesByRowId: new Map<DataGridRowId, Partial<T>>(),
        previousRowsById: new Map<DataGridRowId, DataGridRowNode<T>>(),
        nextRowsById: new Map<DataGridRowId, DataGridRowNode<T>>(),
        formulaDiagnostics: createEmptyFormulaDiagnostics(),
        computeStageDiagnostics: createEmptyFormulaComputeStageDiagnostics(),
      }
    }

    const formulaComputeStrategy: "row" | "column-cache" = (
      captureRowPatchMaps
      || hasExplicitChangedFields
      || selectedRowIndexes.length >= 64
      || nodeCount >= 8
    )
      ? "column-cache"
      : "row"

    if (!hasExplicitChangedFields) {
      for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
        for (const rowIndex of selectedRowIndexes) {
          enqueueDirtyNodeRowIndex(nodeIndex, rowIndex)
        }
      }
    }

    let nextSourceRows: DataGridRowNode<T>[] | null = null
    const changedRowMarks = new Uint8Array(rowCount)
    const touchedRowMarks = new Uint8Array(rowCount)
    let touchedRowsCount = 0
    const computedPatchByRowIndex = captureRowPatchMaps
      ? new Array<Record<string, unknown> | undefined>(rowCount)
      : null
    const previousRowByIndex = captureRowPatchMaps
      ? new Array<DataGridRowNode<T> | undefined>(rowCount)
      : null
    const nextRowByIndex = captureRowPatchMaps
      ? new Array<DataGridRowNode<T> | undefined>(rowCount)
      : null
    const workingRowByIndex = new Array<DataGridRowNode<T> | undefined>(rowCount)
    const nodeVisitMarks = new Int32Array(rowCount)
    let nodeVisitEpoch = 0
    const recomputedFormulaFieldNames = new Set<string>()
    const touchedComputedFields = new Set<string>()
    const formulaRuntimeErrorsCollector: DataGridFormulaRuntimeErrorsCollector = {
      runtimeErrorCount: 0,
      runtimeErrors: [],
    }
    let computeEvaluationCount = 0
    let skippedByObjectIs = 0
    let activeComputeRowNode: DataGridRowNode<T> | null = null
    let activeComputeRowIndex = -1
    let effectiveRuntimeStrategy: "row" | "column-cache" = formulaComputeStrategy
    let forceRowReadFallback = false
    const verifyColumnCacheParity = (
      formulaComputeStrategy === "column-cache"
      && isDataGridColumnCacheParityVerificationEnabled()
    )
    const rowRuntimeColumnValuesByField = new Map<string, unknown[]>()
    const getColumnValuesForField = (fieldInput: string): unknown[] => {
      if (formulaComputeStrategy === "column-cache") {
        return getSourceColumnValues(fieldInput)
      }
      const field = fieldInput.trim()
      let values = rowRuntimeColumnValuesByField.get(field)
      if (!values) {
        values = []
        rowRuntimeColumnValuesByField.set(field, values)
      }
      return values
    }
    const columnReadContext: DataGridComputedColumnReadContext = {
      readFieldAtRow: (field, rowIndex, rowNode) => {
        const values = getColumnValuesForField(field)
        const readFieldDirect = resolveRowFieldReader(field)
        if (forceRowReadFallback) {
          const directValue = readFieldDirect(rowNode)
          values[rowIndex] = directValue
          return directValue
        }
        if (rowIndex in values) {
          if (verifyColumnCacheParity) {
            const directValue = readFieldDirect(rowNode)
            if (!Object.is(directValue, values[rowIndex])) {
              clearSourceColumnValuesCache()
              forceRowReadFallback = true
              effectiveRuntimeStrategy = "row"
              const fallbackValues = getColumnValuesForField(field)
              fallbackValues[rowIndex] = directValue
              return directValue
            }
          }
          return values[rowIndex]
        }
        const value = readFieldDirect(rowNode)
        values[rowIndex] = value
        return value
      },
    }
    const writeFieldAtRow = (field: string, rowIndex: number, value: unknown): void => {
      const values = getColumnValuesForField(field)
      values[rowIndex] = value
    }
    const nextNodeVisitEpoch = (): number => {
      nodeVisitEpoch += 1
      if (nodeVisitEpoch >= 2_000_000_000) {
        nodeVisitMarks.fill(0)
        nodeVisitEpoch = 1
      }
      return nodeVisitEpoch
    }
    const reusableComputeContext = {
      row: undefined as T,
      rowId: 0 as DataGridRowId,
      sourceIndex: 0,
      get: (token: DataGridComputedDependencyToken) => {
        if (!activeComputeRowNode) {
          return undefined
        }
        return resolveComputedTokenValue(
          activeComputeRowNode,
          token,
          activeComputeRowIndex,
          columnReadContext,
        )
      },
    } satisfies DataGridComputedFieldComputeContext<T>
    const previousFormulaRuntimeErrorsCollector = activeFormulaRuntimeErrorsCollector
    activeFormulaRuntimeErrorsCollector = formulaRuntimeErrorsCollector

    try {
      for (const level of levelsToRun) {
        const nextDirtyRowIndexesByNode = new Array<number[] | undefined>(nodeCount)
        const levelPatchByRowIndex = new Array<Record<string, unknown> | undefined>(rowCount)
        const levelPatchedRowIndexes: number[] = []

        // Vector-style stage execution: evaluate one node over row batches.
        for (const nodeIndex of level) {
          const computedName = computedOrder[nodeIndex]
          const computed = computedEntryByIndex[nodeIndex]
          const readComputedField = computedFieldReaderByIndex[nodeIndex]
          if (!computedName || !computed || !readComputedField) {
            continue
          }
          const nodeDirtyRowIndexes = dirtyRowIndexesByNode[nodeIndex]
          if (!nodeDirtyRowIndexes || nodeDirtyRowIndexes.length === 0) {
            continue
          }
          dirtyRowIndexesByNode[nodeIndex] = undefined
          const dependentIndexes = computedDependentsByIndex[nodeIndex] ?? []
          const visitEpoch = nextNodeVisitEpoch()
          let evaluatedAtLeastOnce = false

          const dirtyRowIndexesForNode = nodeDirtyRowIndexes
          for (
            let batchStart = 0;
            batchStart < dirtyRowIndexesForNode.length;
            batchStart += DATAGRID_COMPUTE_VECTOR_BATCH_SIZE
          ) {
            const batchEnd = Math.min(
              dirtyRowIndexesForNode.length,
              batchStart + DATAGRID_COMPUTE_VECTOR_BATCH_SIZE,
            )
            for (let rowCursor = batchStart; rowCursor < batchEnd; rowCursor += 1) {
              const rowIndex = dirtyRowIndexesForNode[rowCursor]
              if (typeof rowIndex !== "number" || rowIndex < 0 || rowIndex >= rowCount) {
                continue
              }
              if (nodeVisitMarks[rowIndex] === visitEpoch) {
                continue
              }
              nodeVisitMarks[rowIndex] = visitEpoch
              const sourceRow = sourceRowsBaseline[rowIndex]
              if (!sourceRow || !isRecord(sourceRow.data)) {
                continue
              }

              const workingRowNode = workingRowByIndex[rowIndex] ?? sourceRow
              evaluatedAtLeastOnce = true
              if (touchedRowMarks[rowIndex] === 0) {
                touchedRowMarks[rowIndex] = 1
                touchedRowsCount += 1
              }
              computeEvaluationCount += 1
              activeComputeRowNode = workingRowNode
              activeComputeRowIndex = rowIndex
              reusableComputeContext.row = workingRowNode.row
              reusableComputeContext.rowId = workingRowNode.rowId
              reusableComputeContext.sourceIndex = workingRowNode.sourceIndex
              let nextValue: unknown
              try {
                nextValue = computed.compute(reusableComputeContext)
              } finally {
                activeComputeRowNode = null
                activeComputeRowIndex = -1
              }
              const previousColumnValues = getColumnValuesForField(computed.field)
              const previousValue = rowIndex in previousColumnValues
                ? previousColumnValues[rowIndex]
                : (() => {
                    const value = readComputedField(workingRowNode)
                    previousColumnValues[rowIndex] = value
                    return value
                  })()
              if (Object.is(nextValue, previousValue)) {
                skippedByObjectIs += 1
                continue
              }
              touchedComputedFields.add(computed.field)

              if (computedPatchByRowIndex) {
                let rowPatch = computedPatchByRowIndex[rowIndex]
                if (!rowPatch) {
                  rowPatch = {}
                  computedPatchByRowIndex[rowIndex] = rowPatch
                }
                rowPatch[computed.field] = nextValue
              }

              let levelPatch = levelPatchByRowIndex[rowIndex]
              if (!levelPatch) {
                levelPatch = {}
                levelPatchByRowIndex[rowIndex] = levelPatch
                levelPatchedRowIndexes.push(rowIndex)
              }
              levelPatch[computed.field] = nextValue
              writeFieldAtRow(computed.field, rowIndex, nextValue)

              for (const dependentIndex of dependentIndexes) {
                let dependentDirtyRows = nextDirtyRowIndexesByNode[dependentIndex]
                if (!dependentDirtyRows) {
                  dependentDirtyRows = []
                  nextDirtyRowIndexesByNode[dependentIndex] = dependentDirtyRows
                }
                dependentDirtyRows.push(rowIndex)
                markDirtyNode(dependentIndex)
                markDirtyRow(rowIndex)
              }
            }
          }

          if (evaluatedAtLeastOnce && formulaFieldsByName.has(computedName)) {
            recomputedFormulaFieldNames.add(computedName)
          }
        }

        if (levelPatchedRowIndexes.length > 0) {
          for (const rowIndex of levelPatchedRowIndexes) {
            const levelPatch = levelPatchByRowIndex[rowIndex]
            if (!levelPatch) {
              continue
            }
            const sourceRow = sourceRowsBaseline[rowIndex]
            if (!sourceRow) {
              continue
            }
            const workingRowNode = workingRowByIndex[rowIndex] ?? sourceRow
            const nextData = applyRowDataPatch(
              workingRowNode.data,
              levelPatch as Partial<T>,
            )
            if (nextData === workingRowNode.data) {
              continue
            }
            const nextRowNode: DataGridRowNode<T> = {
              ...workingRowNode,
              data: nextData,
              row: nextData,
            }
            workingRowByIndex[rowIndex] = nextRowNode
            if (!nextSourceRows) {
              nextSourceRows = sourceRowsBaseline.slice()
            }
            nextSourceRows[rowIndex] = nextRowNode
            if (previousRowByIndex && nextRowByIndex) {
              if (!previousRowByIndex[rowIndex]) {
                previousRowByIndex[rowIndex] = sourceRow
              }
              nextRowByIndex[rowIndex] = nextRowNode
            }
            changedRowMarks[rowIndex] = 1
          }
        }

        for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
          const dependentRows = nextDirtyRowIndexesByNode[nodeIndex]
          if (!dependentRows || dependentRows.length === 0) {
            continue
          }
          let queued = dirtyRowIndexesByNode[nodeIndex]
          if (!queued) {
            dirtyRowIndexesByNode[nodeIndex] = dependentRows
            continue
          }
          queued.push(...dependentRows)
        }
      }
    } finally {
      activeFormulaRuntimeErrorsCollector = previousFormulaRuntimeErrorsCollector
    }

    const changedRowIds: DataGridRowId[] = []
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      if (changedRowMarks[rowIndex] === 0) {
        continue
      }
      const rowNode = sourceRowsBaseline[rowIndex]
      if (!rowNode) {
        continue
      }
      changedRowIds.push(rowNode.rowId)
    }

    if (nextSourceRows && changedRowIds.length > 0) {
      sourceRows = nextSourceRows
      sourceRowIndexById = buildRowIdPositionIndex(sourceRows)
    }

    const computedUpdatesByRowId = new Map<DataGridRowId, Partial<T>>()
    const previousRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()
    const nextRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()

    if (captureRowPatchMaps && computedPatchByRowIndex && previousRowByIndex && nextRowByIndex) {
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const rowNode = sourceRowsBaseline[rowIndex]
        if (!rowNode) {
          continue
        }
        const rowId = rowNode.rowId
        const computedPatch = computedPatchByRowIndex[rowIndex]
        if (computedPatch) {
          computedUpdatesByRowId.set(rowId, computedPatch as Partial<T>)
        }
        const previousRow = previousRowByIndex[rowIndex]
        if (previousRow) {
          previousRowsById.set(rowId, previousRow)
        }
        const nextRow = nextRowByIndex[rowIndex]
        if (nextRow) {
          nextRowsById.set(rowId, nextRow)
        }
      }
    }

    const recomputedFields = computedOrder.filter(name => recomputedFormulaFieldNames.has(name))

    return {
      changed: changedRowIds.length > 0,
      changedRowIds,
      computedUpdatesByRowId,
      previousRowsById,
      nextRowsById,
      formulaDiagnostics: {
        recomputedFields,
        runtimeErrorCount: formulaRuntimeErrorsCollector.runtimeErrorCount,
        runtimeErrors: formulaRuntimeErrorsCollector.runtimeErrors,
      },
      computeStageDiagnostics: {
        strategy: effectiveRuntimeStrategy,
        rowsTouched: touchedRowsCount,
        changedRows: changedRowIds.length,
        fieldsTouched: Array.from(touchedComputedFields).sort((left, right) => left.localeCompare(right)),
        evaluations: computeEvaluationCount,
        skippedByObjectIs,
        dirtyRows: dirtyRowsCount,
        dirtyNodes: (() => {
          if (dirtyNodeCount === 0) {
            return [] as string[]
          }
          const dirtyNodes: string[] = []
          for (let index = 0; index < nodeCount; index += 1) {
            if (dirtyNodeMarks[index] === 0) {
              continue
            }
            const name = computedOrder[index]
            if (typeof name === "string") {
              dirtyNodes.push(name)
            }
          }
          dirtyNodes.sort((left, right) => left.localeCompare(right))
          return dirtyNodes
        })(),
      },
    }
  }

  const getComputedFieldSnapshots = (): readonly DataGridComputedFieldSnapshot[] => {
    return computedOrder
      .map((name): DataGridComputedFieldSnapshot | null => {
        if (formulaFieldsByName.has(name)) {
          return null
        }
        const computed = computedFieldsByName.get(name)
        if (!computed) {
          return null
        }
        return {
          name: computed.name,
          field: computed.field,
          deps: computed.deps.map(dep => dep.token),
        }
      })
      .filter((entry): entry is DataGridComputedFieldSnapshot => entry !== null)
  }

  const getFormulaFieldSnapshots = (): readonly DataGridFormulaFieldSnapshot[] => {
    return Array.from(formulaFieldsByName.values()).map((formula) => ({
      name: formula.name,
      field: formula.field,
      formula: formula.formula,
      deps: [...formula.deps],
    }))
  }

  const resolveInitialComputedRegistrationOrder = (
    definitions: readonly DataGridComputedFieldDefinition<T>[],
  ): readonly DataGridComputedFieldDefinition<T>[] => {
    if (definitions.length === 0) {
      return []
    }
    const byName = new Map<string, DataGridComputedFieldDefinition<T>>()
    for (const definition of definitions) {
      const name = normalizeComputedName(definition.name)
      if (byName.has(name)) {
        throw new Error(`[DataGridComputed] Duplicate computed field '${name}' in initialComputedFields.`)
      }
      byName.set(name, definition)
    }
    const ordered: DataGridComputedFieldDefinition<T>[] = []
    const states = new Map<string, 0 | 1 | 2>()
    const visit = (name: string): void => {
      const state = states.get(name) ?? 0
      if (state === 2) {
        return
      }
      if (state === 1) {
        throw new Error(`[DataGridComputed] Cycle detected at computed field '${name}'.`)
      }
      const definition = byName.get(name)
      if (!definition) {
        throw new Error(`[DataGridComputed] Missing initial computed field '${name}'.`)
      }
      states.set(name, 1)
      for (const rawDependency of Array.isArray(definition.deps) ? definition.deps : []) {
        const dependency = resolveComputedDependency(rawDependency)
        if (dependency.domain !== "computed") {
          continue
        }
        if (byName.has(dependency.value)) {
          visit(dependency.value)
          continue
        }
        if (!computedFieldsByName.has(dependency.value)) {
          throw new Error(
            `[DataGridComputed] Missing dependency 'computed:${dependency.value}' for '${name}'.`,
          )
        }
      }
      states.set(name, 2)
      ordered.push(definition)
    }
    for (const name of byName.keys()) {
      visit(name)
    }
    return ordered
  }

  if (Array.isArray(options.initialComputedFields) && options.initialComputedFields.length > 0) {
    const orderedInitialComputedFields = resolveInitialComputedRegistrationOrder(options.initialComputedFields)
    for (const definition of orderedInitialComputedFields) {
      registerComputedFieldInternal(definition)
    }
    const initialComputedRecompute = applyComputedFieldsToSourceRows()
    commitFormulaDiagnostics(initialComputedRecompute.formulaDiagnostics)
    commitFormulaComputeStageDiagnostics(initialComputedRecompute.computeStageDiagnostics)
    if (initialComputedRecompute.changed) {
      bumpRowVersions(rowVersionById, initialComputedRecompute.changedRowIds)
    }
  }

  if (Array.isArray(options.initialFormulaFields) && options.initialFormulaFields.length > 0) {
    const initialFormulaNames = new Set<string>()
    const initialFormulaNameByField = new Map<string, string>()
    const compiledByName = new Map<string, DataGridCompiledFormulaField<T>>()
    const initialFormulaDefinitions: DataGridComputedFieldDefinition<T>[] = []

    for (const definition of options.initialFormulaFields) {
      const normalizedName = normalizeComputedName(definition.name)
      const normalizedField = normalizeComputedTargetField(definition.field, normalizedName)
      if (initialFormulaNames.has(normalizedName)) {
        throw new Error(
          `[DataGridFormula] Duplicate formula field '${normalizedName}' in initialFormulaFields.`,
        )
      }
      if (initialFormulaNameByField.has(normalizedField)) {
        throw new Error(
          `[DataGridFormula] Duplicate formula target field '${normalizedField}' in initialFormulaFields.`,
        )
      }
      initialFormulaNames.add(normalizedName)
      initialFormulaNameByField.set(normalizedField, normalizedName)
    }

    for (const definition of options.initialFormulaFields) {
      const compiled = compileFormulaFieldDefinition(definition, {
        knownComputedNames: initialFormulaNames,
        knownComputedNameByField: initialFormulaNameByField,
      })
      compiledByName.set(compiled.name, compiled)
      initialFormulaDefinitions.push({
        name: compiled.name,
        field: compiled.field,
        deps: compiled.deps,
        compute: compiled.compute,
      })
    }

    const orderedInitialFormulaFields = resolveInitialComputedRegistrationOrder(initialFormulaDefinitions)
    for (const definition of orderedInitialFormulaFields) {
      const formulaName = normalizeComputedName(definition.name)
      const compiled = compiledByName.get(formulaName)
      if (!compiled) {
        continue
      }
      registerComputedFieldInternal(definition)
      formulaFieldsByName.set(formulaName, {
        name: compiled.name,
        field: compiled.field,
        formula: compiled.formula,
        deps: compiled.deps,
      })
    }

    const initialFormulaRecompute = applyComputedFieldsToSourceRows()
    commitFormulaDiagnostics(initialFormulaRecompute.formulaDiagnostics)
    commitFormulaComputeStageDiagnostics(initialFormulaRecompute.computeStageDiagnostics)
    if (initialFormulaRecompute.changed) {
      bumpRowVersions(rowVersionById, initialFormulaRecompute.changedRowIds)
    }
  }

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
    applyComputedFieldsToPatchResult: (patchResult) => {
      invalidateSourceColumnValuesByRowIds(patchResult.changedRowIds)
      const changedFieldsByRowId = new Map<DataGridRowId, ReadonlySet<string>>()
      for (const [rowId, patch] of patchResult.changedUpdatesById.entries()) {
        const fields = new Set<string>()
        if (isRecord(patch)) {
          for (const key of Object.keys(patch)) {
            fields.add(key)
          }
        }
        changedFieldsByRowId.set(rowId, fields)
      }
      const computedResult = applyComputedFieldsToSourceRows({
        rowIds: new Set<DataGridRowId>(patchResult.changedRowIds),
        changedFieldsByRowId,
        captureRowPatchMaps: true,
      })
      commitFormulaDiagnostics(computedResult.formulaDiagnostics)
      commitFormulaComputeStageDiagnostics(computedResult.computeStageDiagnostics)
      if (!computedResult.changed) {
        return patchResult
      }

      const mergedChangedUpdatesById = new Map<DataGridRowId, Partial<T>>(patchResult.changedUpdatesById)
      for (const [rowId, computedPatch] of computedResult.computedUpdatesByRowId.entries()) {
        const existingPatch = mergedChangedUpdatesById.get(rowId)
        if (existingPatch) {
          mergedChangedUpdatesById.set(rowId, mergeRowPatch(existingPatch, computedPatch))
        } else {
          mergedChangedUpdatesById.set(rowId, computedPatch)
        }
      }

      const mergedPreviousRowsById = new Map<DataGridRowId, DataGridRowNode<T>>(patchResult.previousRowsById)
      for (const [rowId, previousRow] of computedResult.previousRowsById.entries()) {
        if (!mergedPreviousRowsById.has(rowId)) {
          mergedPreviousRowsById.set(rowId, previousRow)
        }
      }

      const mergedNextRowsById = new Map<DataGridRowId, DataGridRowNode<T>>(patchResult.nextRowsById)
      for (const [rowId, nextRow] of computedResult.nextRowsById.entries()) {
        mergedNextRowsById.set(rowId, nextRow)
      }

      const changedRowIdSet = new Set<DataGridRowId>(patchResult.changedRowIds)
      for (const rowId of computedResult.changedRowIds) {
        changedRowIdSet.add(rowId)
      }

      return {
        nextSourceRows: sourceRows,
        changed: true,
        computedChanged: true,
        changedRowIds: Array.from(changedRowIdSet),
        changedUpdatesById: mergedChangedUpdatesById,
        previousRowsById: mergedPreviousRowsById,
        nextRowsById: mergedNextRowsById,
      } satisfies ApplyClientRowPatchUpdatesResult<T>
    },
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

  const recompileRegisteredFormulaFields = (): void => {
    const compiledByName = compileRegisteredFormulaFields()
    applyCompiledFormulaFields(compiledByName)
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
      definition: DataGridFormulaFunctionDefinition | ((args: readonly number[]) => unknown),
    ) {
      ensureActive()
      const normalizedName = normalizeFormulaFunctionName(name)
      if (
        typeof definition !== "function"
        && (
          typeof definition !== "object"
          || definition === null
          || typeof definition.compute !== "function"
        )
      ) {
        throw new Error(
          `[DataGridFormula] Formula function '${normalizedName}' must be a function or an object with compute(args).`,
        )
      }

      const previousRegistry = new Map(formulaFunctionRegistry)
      formulaFunctionRegistry.set(normalizedName, definition)
      try {
        recompileRegisteredFormulaFields()
      } catch (error) {
        formulaFunctionRegistry.clear()
        for (const [entryName, entryDefinition] of previousRegistry) {
          formulaFunctionRegistry.set(entryName, entryDefinition)
        }
        throw error
      }

      if (formulaFieldsByName.size > 0) {
        void recomputeComputedFieldsAndRefresh()
      }
    },
    unregisterFormulaFunction(name: string) {
      ensureActive()
      const normalizedName = normalizeFormulaFunctionName(name)
      if (!formulaFunctionRegistry.has(normalizedName)) {
        return false
      }
      const previousRegistry = new Map(formulaFunctionRegistry)
      formulaFunctionRegistry.delete(normalizedName)
      try {
        recompileRegisteredFormulaFields()
      } catch (error) {
        formulaFunctionRegistry.clear()
        for (const [entryName, entryDefinition] of previousRegistry) {
          formulaFunctionRegistry.set(entryName, entryDefinition)
        }
        throw error
      }
      if (formulaFieldsByName.size > 0) {
        void recomputeComputedFieldsAndRefresh()
      }
      return true
    },
    getFormulaFunctionNames() {
      return Array.from(formulaFunctionRegistry.keys())
        .sort((left, right) => left.localeCompare(right))
    },
    getFormulaExecutionPlan() {
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
      computedFieldsByName.clear()
      computedFieldNameByTargetField.clear()
      formulaFieldsByName.clear()
      formulaFunctionRegistry.clear()
      computedOrder = []
      computedExecutionPlan = createDataGridFormulaExecutionPlan([])
      computedEntryByIndex = []
      computedFieldReaderByIndex = []
      computedLevelIndexes = []
      computedDependentsByIndex = []
      computedAffectedPlanCache.clear()
      rowFieldReaderCache.clear()
      computedTokenReaderCache.clear()
      latestFormulaComputeStageDiagnostics = null
      runtimeStateStore.setProjectionFormulaDiagnostics(null)
      invalidateTreeProjectionCaches()
      cachedFilterPredicate = null
      cachedFilterPredicateKey = "__none__"
    },
  }
}
