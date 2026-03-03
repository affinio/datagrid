import type {
  DataGridAggregationModel,
  DataGridClientComputeDiagnostics,
  DataGridClientComputeMode,
  DataGridClientRowModelDerivedCacheDiagnostics,
  DataGridColumnDef,
  DataGridColumnHistogram,
  DataGridColumnHistogramOptions,
  DataGridColumnPin,
  DataGridColumnModelSnapshot,
  DataGridPivotColumn,
  DataGridColumnSnapshot,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridDataSourceBackpressureDiagnostics,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridPaginationSnapshot,
  DataGridPivotCellDrilldown,
  DataGridPivotCellDrilldownInput,
  DataGridProjectionDiagnostics,
  DataGridProjectionStage,
  DataGridPivotSpec,
  DataGridRowId,
  DataGridRowModelKind,
  DataGridRowNodeInput,
  DataGridRowModelSnapshot,
  DataGridRowNode,
  DataGridSortAndFilterModelInput,
  DataGridSortState,
  DataGridTreeDataDiagnostics,
  DataGridViewportRange,
} from "../models"
import type { DataGridSelectionSnapshot } from "../selection/snapshot"
import type {
  DataGridSelectionAggregationKind,
  DataGridSelectionSummaryColumnConfig,
  DataGridSelectionSummaryScope,
  DataGridSelectionSummarySnapshot,
} from "../selection/selectionSummary"
import type {
  DataGridCellRefreshOptions,
  DataGridCellRefreshRange,
  DataGridCellsRefreshListener,
} from "./gridApiCellRefresh"
import type {
  DataGridPivotLayoutImportOptions,
  DataGridPivotLayoutSnapshot,
  DataGridPivotInteropSnapshot,
} from "./gridApiPivotLayout"
import type { DataGridCore } from "./gridCore"
import type {
  DataGridTransactionInput,
  DataGridTransactionSnapshot,
} from "./transactionService"

export interface DataGridRefreshOptions {
  reset?: boolean
}

export interface DataGridApplyEditsOptions {
  emit?: boolean
  reapply?: boolean
  signal?: AbortSignal | null
}

export interface DataGridApiMutationControlOptions {
  signal?: AbortSignal | null
}

export interface DataGridApiPivotNamespace<TRow = unknown> {
  setModel(pivotModel: DataGridPivotSpec | null): void
  getModel(): DataGridPivotSpec | null
  getCellDrilldown(input: DataGridPivotCellDrilldownInput): DataGridPivotCellDrilldown<TRow> | null
  exportLayout(): DataGridPivotLayoutSnapshot<TRow>
  exportInterop(): DataGridPivotInteropSnapshot<TRow> | null
  importLayout(
    layout: DataGridPivotLayoutSnapshot<TRow>,
    options?: DataGridPivotLayoutImportOptions,
  ): void
}

export interface DataGridApiSelectionNamespace<TRow = unknown> {
  hasSupport(): boolean
  getSnapshot(): DataGridSelectionSnapshot | null
  setSnapshot(snapshot: DataGridSelectionSnapshot): void
  clear(): void
  summarize(options?: DataGridSelectionSummaryApiOptions<TRow>): DataGridSelectionSummarySnapshot | null
}

export interface DataGridApiTransactionNamespace {
  hasSupport(): boolean
  getSnapshot(): DataGridTransactionSnapshot | null
  beginBatch(label?: string): string
  commitBatch(batchId?: string): Promise<readonly string[]>
  rollbackBatch(batchId?: string): readonly string[]
  apply(transaction: DataGridTransactionInput, options?: DataGridApiMutationControlOptions): Promise<string>
  canUndo(): boolean
  canRedo(): boolean
  undo(): Promise<string | null>
  redo(): Promise<string | null>
}

export interface DataGridApiRowsNamespace<TRow = unknown> {
  getSnapshot(): DataGridRowModelSnapshot<TRow>
  getCount(): number
  get(index: number): DataGridRowNode<TRow> | undefined
  getRange(range: DataGridViewportRange): readonly DataGridRowNode<TRow>[]
  hasDataMutationSupport(): boolean
  setData(rows: readonly DataGridRowNodeInput<TRow>[]): void
  replaceData(rows: readonly DataGridRowNodeInput<TRow>[]): void
  appendData(rows: readonly DataGridRowNodeInput<TRow>[]): void
  prependData(rows: readonly DataGridRowNodeInput<TRow>[]): void
  getPagination(): DataGridPaginationSnapshot
  setPagination(pagination: DataGridPaginationInput | null): void
  setPageSize(pageSize: number | null): void
  setCurrentPage(page: number): void
  setSortModel(sortModel: readonly DataGridSortState[]): void
  setFilterModel(filterModel: DataGridFilterSnapshot | null): void
  setSortAndFilterModel(input: DataGridSortAndFilterModelInput): void
  setGroupBy(groupBy: DataGridGroupBySpec | null): void
  setAggregationModel(aggregationModel: DataGridAggregationModel<TRow> | null): void
  getAggregationModel(): DataGridAggregationModel<TRow> | null
  setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null): void
  toggleGroup(groupKey: string): void
  expandGroup(groupKey: string): void
  collapseGroup(groupKey: string): void
  expandAllGroups(): void
  collapseAllGroups(): void
  hasPatchSupport(): boolean
  patch(
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ): void
  applyEdits(
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridApplyEditsOptions,
  ): void
  setAutoReapply(value: boolean): void
  getAutoReapply(): boolean
  batch<TResult>(fn: () => TResult): TResult
}

export interface DataGridApiDataNamespace {
  hasBackpressureControlSupport(): boolean
  pause(): boolean
  resume(): boolean
  flush(): Promise<void>
}

export interface DataGridApiColumnsNamespace {
  getSnapshot(): DataGridColumnModelSnapshot
  get(key: string): DataGridColumnSnapshot | undefined
  setAll(columns: DataGridColumnDef[]): void
  setOrder(keys: readonly string[]): void
  setVisibility(key: string, visible: boolean): void
  setWidth(key: string, width: number | null): void
  setPin(key: string, pin: DataGridColumnPin): void
  getHistogram(columnId: string, options?: DataGridColumnHistogramOptions): DataGridColumnHistogram
}

export interface DataGridApiViewNamespace {
  setViewportRange(range: DataGridViewportRange): void
  refresh(options?: DataGridRefreshOptions): Promise<void> | void
  reapply(): Promise<void> | void
  expandAllGroups(): void
  collapseAllGroups(): void
  refreshCellsByRowKeys(
    rowKeys: readonly DataGridRowId[],
    columnKeys: readonly string[],
    options?: DataGridCellRefreshOptions,
  ): void
  refreshCellsByRanges(
    ranges: readonly DataGridCellRefreshRange[],
    options?: DataGridCellRefreshOptions,
  ): void
  onCellsRefresh(listener: DataGridCellsRefreshListener): () => void
}

export type DataGridApiProjectionMode = "mutable" | "immutable" | "excel-like"

export interface DataGridApiComputeNamespace {
  hasSupport(): boolean
  getMode(): DataGridClientComputeMode | null
  switchMode(mode: DataGridClientComputeMode): boolean
  getDiagnostics(): DataGridClientComputeDiagnostics | null
}

export interface DataGridApiPolicyNamespace {
  getProjectionMode(): DataGridApiProjectionMode
  setProjectionMode(mode: DataGridApiProjectionMode): DataGridApiProjectionMode
}

export interface DataGridApiRowModelDiagnostics {
  kind: DataGridRowModelKind
  revision: number | null
  rowCount: number
  loading: boolean
  warming: boolean
  projection: DataGridProjectionDiagnostics | null
  treeData: DataGridTreeDataDiagnostics | null
}

export interface DataGridApiDiagnosticsSnapshot {
  rowModel: DataGridApiRowModelDiagnostics
  compute: DataGridClientComputeDiagnostics | null
  derivedCache: DataGridClientRowModelDerivedCacheDiagnostics | null
  backpressure: DataGridDataSourceBackpressureDiagnostics | null
}

export interface DataGridApiDiagnosticsNamespace {
  getAll(): DataGridApiDiagnosticsSnapshot
}

export interface DataGridApiSchemaColumn {
  key: string
  label: string
  visible: boolean
  pin: DataGridColumnPin
  width: number | null
  hasMeta: boolean
  metaKeys: readonly string[]
}

export interface DataGridApiSchemaSnapshot {
  rowModelKind: DataGridRowModelKind
  columns: readonly DataGridApiSchemaColumn[]
}

export interface DataGridApiRuntimeInfo {
  lifecycleState: DataGridCore["lifecycle"]["state"]
  apiVersion: string
  protocolVersion: string
  rowModelKind: DataGridRowModelKind
  rowCount: number
  revision: number | null
  loading: boolean
  warming: boolean
  viewportRange: DataGridViewportRange
  projectionMode: DataGridApiProjectionMode
  computeMode: DataGridClientComputeMode | null
}

export interface DataGridApiMetaNamespace {
  getSchema(): DataGridApiSchemaSnapshot
  getRowModelKind(): DataGridRowModelKind
  getApiVersion(): string
  getProtocolVersion(): string
  getCapabilities(): DataGridApiCapabilities
  getRuntimeInfo(): DataGridApiRuntimeInfo
}

export interface DataGridUnifiedColumnState {
  order: readonly string[]
  visibility: Readonly<Record<string, boolean>>
  widths: Readonly<Record<string, number | null>>
  pins: Readonly<Record<string, DataGridColumnPin>>
}

export interface DataGridUnifiedRowsState<TRow = unknown> {
  snapshot: DataGridRowModelSnapshot<TRow>
  aggregationModel: DataGridAggregationModel<TRow> | null
}

export interface DataGridUnifiedState<TRow = unknown> {
  version: 1
  rows: DataGridUnifiedRowsState<TRow>
  columns: DataGridUnifiedColumnState
  selection: DataGridSelectionSnapshot | null
  transaction: DataGridTransactionSnapshot | null
}

export interface DataGridSetStateOptions {
  applyColumns?: boolean
  applySelection?: boolean
  applyViewport?: boolean
  strict?: boolean
}

export interface DataGridMigrateStateOptions {
  strict?: boolean
}

export interface DataGridApiStateNamespace<TRow = unknown> {
  get(): DataGridUnifiedState<TRow>
  migrate(state: unknown, options?: DataGridMigrateStateOptions): DataGridUnifiedState<TRow> | null
  set(state: DataGridUnifiedState<TRow>, options?: DataGridSetStateOptions): void
}

export interface DataGridApiRowsChangedEvent<TRow = unknown> {
  snapshot: DataGridRowModelSnapshot<TRow>
}

export interface DataGridApiColumnsChangedEvent {
  snapshot: DataGridColumnModelSnapshot
}

export interface DataGridApiProjectionRecomputedEvent<TRow = unknown> {
  snapshot: DataGridRowModelSnapshot<TRow>
  previousVersion: number
  nextVersion: number
  staleStages: readonly DataGridProjectionStage[]
}

export interface DataGridApiSelectionChangedEvent {
  snapshot: DataGridSelectionSnapshot | null
}

export interface DataGridApiPivotChangedEvent {
  pivotModel: DataGridPivotSpec | null
  pivotColumns: readonly DataGridPivotColumn[]
}

export interface DataGridApiTransactionChangedEvent {
  snapshot: DataGridTransactionSnapshot | null
}

export interface DataGridApiViewportChangedEvent<TRow = unknown> {
  range: DataGridViewportRange
  snapshot: DataGridRowModelSnapshot<TRow>
}

export interface DataGridApiStateImportedEvent<TRow = unknown> {
  state: DataGridUnifiedState<TRow>
}

export interface DataGridApiStateImportBeginEvent<TRow = unknown> {
  state: DataGridUnifiedState<TRow>
}

export interface DataGridApiStateImportEndEvent<TRow = unknown> {
  state: DataGridUnifiedState<TRow>
}

export type DataGridApiErrorCode =
  | "capability-error"
  | "invalid-state-import"
  | "transaction-conflict"
  | "compute-switch-conflict"
  | "mutation-conflict"
  | "lifecycle-conflict"
  | "data-source-protocol-error"
  | "aborted"
  | "unknown-error"

export interface DataGridApiErrorEvent {
  code: DataGridApiErrorCode
  operation: string
  recoverable: boolean
  error: unknown
}

export interface DataGridApiEventMap<TRow = unknown> {
  "rows:changed": DataGridApiRowsChangedEvent<TRow>
  "columns:changed": DataGridApiColumnsChangedEvent
  "projection:recomputed": DataGridApiProjectionRecomputedEvent<TRow>
  "selection:changed": DataGridApiSelectionChangedEvent
  "pivot:changed": DataGridApiPivotChangedEvent
  "transaction:changed": DataGridApiTransactionChangedEvent
  "viewport:changed": DataGridApiViewportChangedEvent<TRow>
  "state:import:begin": DataGridApiStateImportBeginEvent<TRow>
  "state:import:end": DataGridApiStateImportEndEvent<TRow>
  "state:imported": DataGridApiStateImportedEvent<TRow>
  "error": DataGridApiErrorEvent
}

export type DataGridApiEventName<TRow = unknown> = keyof DataGridApiEventMap<TRow>
export type DataGridApiEventPayload<TRow = unknown> = DataGridApiEventMap<TRow>[DataGridApiEventName<TRow>]

export interface DataGridApiPluginDefinition<TRow = unknown> {
  id: string
  onRegister?: () => void
  onDispose?: () => void
  onEvent?: (event: DataGridApiEventName<TRow>, payload: DataGridApiEventPayload<TRow>) => void
}

export interface DataGridApiPluginsNamespace<TRow = unknown> {
  register(plugin: DataGridApiPluginDefinition<TRow>): boolean
  unregister(id: string): boolean
  has(id: string): boolean
  list(): readonly string[]
  clear(): void
}

export interface DataGridApiEventsNamespace<TRow = unknown> {
  on<K extends keyof DataGridApiEventMap<TRow>>(
    event: K,
    listener: (payload: DataGridApiEventMap<TRow>[K]) => void,
  ): () => void
}

export interface DataGridApiLifecycleNamespace {
  readonly state: DataGridCore["lifecycle"]["state"]
  readonly startupOrder: DataGridCore["lifecycle"]["startupOrder"]
  isBusy(): boolean
  whenIdle(): Promise<void>
  runExclusive<TResult>(fn: () => TResult | Promise<TResult>): Promise<TResult>
}

export interface DataGridApiCapabilities {
  readonly patch: boolean
  readonly dataMutation: boolean
  readonly backpressureControl: boolean
  readonly compute: boolean
  readonly selection: boolean
  readonly transaction: boolean
  readonly histogram: boolean
  readonly sortFilterBatch: boolean
}

export interface DataGridApi<TRow = unknown> {
  readonly lifecycle: DataGridApiLifecycleNamespace
  readonly capabilities: DataGridApiCapabilities
  readonly pivot: DataGridApiPivotNamespace<TRow>
  readonly selection: DataGridApiSelectionNamespace<TRow>
  readonly transaction: DataGridApiTransactionNamespace
  readonly rows: DataGridApiRowsNamespace<TRow>
  readonly data: DataGridApiDataNamespace
  readonly columns: DataGridApiColumnsNamespace
  readonly view: DataGridApiViewNamespace
  readonly compute: DataGridApiComputeNamespace
  readonly diagnostics: DataGridApiDiagnosticsNamespace
  readonly meta: DataGridApiMetaNamespace
  readonly policy: DataGridApiPolicyNamespace
  readonly plugins: DataGridApiPluginsNamespace<TRow>
  readonly state: DataGridApiStateNamespace<TRow>
  readonly events: DataGridApiEventsNamespace<TRow>
  init(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  dispose(): Promise<void>
}

export interface DataGridSelectionSummaryApiOptions<TRow = unknown> {
  /**
   * "selected-loaded" summarizes all selected cells that are currently materialized by the row model.
   * "selected-visible" limits summary to selected cells that intersect current viewportRange.
   */
  scope?: DataGridSelectionSummaryScope
  columns?: readonly DataGridSelectionSummaryColumnConfig<TRow>[]
  defaultAggregations?: readonly DataGridSelectionAggregationKind[]
  getColumnKeyByIndex?: (columnIndex: number) => string | null | undefined
}
