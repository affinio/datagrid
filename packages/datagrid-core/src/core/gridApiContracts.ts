import type {
  DataGridAggregationModel,
  DataGridClientComputeDiagnostics,
  DataGridClientComputeMode,
  DataGridClientRowModelDerivedCacheDiagnostics,
  DataGridComputedFieldDefinition,
  DataGridComputedFieldSnapshot,
  DataGridFormulaContextRecomputeRequest,
  DataGridFormulaFieldDefinition,
  DataGridFormulaFieldSnapshot,
  DataGridFormulaFunctionDefinition,
  DataGridFormulaValue,
  DataGridFormulaExecutionPlanSnapshot,
  DataGridFormulaGraphSnapshot,
  DataGridColumnInput,
  DataGridColumnHistogramOptions,
  DataGridColumnHistogramResult,
  DataGridColumnPin,
  DataGridColumnZone,
  DataGridColumnModelSnapshot,
  DataGridColumnSnapshot,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridDataSourceBackpressureDiagnostics,
  DataGridExternalRowUpdate,
  DataGridExternalRowUpdateOptions,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridPaginationSnapshot,
  DataGridProjectionDiagnostics,
  DataGridProjectionFormulaDiagnostics,
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaDirtyCause,
  DataGridFormulaRowRecomputeDiagnostics,
  DataGridFormulaExplainDependency,
  DataGridFormulaExplainNode,
  DataGridFormulaNodeComputeDiagnostics,
  DataGridProjectionStage,
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
import type {
  DataGridPivotCellDrilldown,
  DataGridPivotCellDrilldownInput,
  DataGridPivotColumn,
  DataGridPivotInteropSnapshot,
  DataGridPivotLayoutImportOptions,
  DataGridPivotLayoutSnapshot,
  DataGridPivotSpec,
} from "@affino/datagrid-pivot"
import type { DataGridSelectionSnapshot } from "../selection/snapshot"
import type { DataGridRowSelectionSnapshot } from "../selection/rowSelection"
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
import type { DataGridCore } from "./gridCore"
import type {
  DataGridSetViewportPositionOptions,
  DataGridViewportCellTarget,
  DataGridViewportColumnTarget,
  DataGridViewportPositionSnapshot,
  DataGridViewportRowTarget,
} from "./gridApiViewContracts"
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
  /** Replaces the active pivot model, or disables pivoting when null. */
  setModel(pivotModel: DataGridPivotSpec | null): void
  /** Returns the active pivot model, or null when pivoting is disabled. */
  getModel(): DataGridPivotSpec | null
  /** Returns source-row drilldown data for a pivot cell when available. */
  getCellDrilldown(input: DataGridPivotCellDrilldownInput): DataGridPivotCellDrilldown<TRow> | null
  /** Exports the current pivot layout state for persistence or transfer. */
  exportLayout(): DataGridPivotLayoutSnapshot<TRow>
  /** Exports pivot data in the interop snapshot format when available. */
  exportInterop(): DataGridPivotInteropSnapshot<TRow> | null
  /** Imports a previously exported pivot layout snapshot. */
  importLayout(
    layout: DataGridPivotLayoutSnapshot<TRow>,
    options?: DataGridPivotLayoutImportOptions,
  ): void
}

export interface DataGridApiSelectionNamespace<TRow = unknown> {
  /** Returns true when cell/range selection is backed by the current grid runtime. */
  hasSupport(): boolean
  /** Returns the current cell/range selection snapshot, or null when empty/unsupported. */
  getSnapshot(): DataGridSelectionSnapshot | null
  /** Replaces the current cell/range selection snapshot. */
  setSnapshot(snapshot: DataGridSelectionSnapshot): void
  /** Clears the current cell/range selection. */
  clear(): void
  /** Summarizes selected cells using the current projected row model. */
  summarize(options?: DataGridSelectionSummaryApiOptions<TRow>): DataGridSelectionSummarySnapshot | null
  /**
   * Returns row data touched by the current material cell selection ranges.
   *
   * Rows are resolved against the current projected row order, de-duplicated
   * across overlapping ranges, and returned in projected row order. Single-cell
   * focus ranges are not treated as material ranges and return no row data.
   */
  getRangeRowData(): TRow[]
}

export interface DataGridApiRowSelectionNamespace<TRow = unknown> {
  /** Returns true when row selection is backed by the current grid runtime. */
  hasSupport(): boolean
  /** Returns the current row-selection snapshot, or null when empty/unsupported. */
  getSnapshot(): DataGridRowSelectionSnapshot | null
  /** Replaces the current row-selection snapshot. */
  setSnapshot(snapshot: DataGridRowSelectionSnapshot): void
  /** Clears focused and selected row state. */
  clear(): void
  /** Returns the focused row id, or null when no row is focused. */
  getFocusedRow(): DataGridRowId | null
  /** Sets the focused row id without changing selected rows. */
  setFocusedRow(rowId: DataGridRowId | null): void
  /** Returns selected row ids from the row-selection snapshot. */
  getSelectedRows(): readonly DataGridRowId[]
  /** Returns true when the row id is selected in the current row-selection state. */
  isSelected(rowId: DataGridRowId): boolean
  /** Selects or deselects one row id. */
  setSelected(rowId: DataGridRowId, selected: boolean): void
  /** Adds row ids to the current row selection. */
  selectRows(rowIds: Iterable<DataGridRowId>): void
  /** Removes row ids from the current row selection. */
  deselectRows(rowIds: Iterable<DataGridRowId>): void
  /** Clears selected row ids while preserving other row-selection state when supported. */
  clearSelectedRows(): void
  /**
   * Returns row data for the current row-selection snapshot.
   *
   * Selected ids are resolved against the current projected rows, preserving
   * projected row order and avoiding duplicates. The all-selection mode honors
   * excluded rows. Returns a new array and does not clone row objects.
   */
  getSelectedRowData(): TRow[]
}

export interface DataGridApiTransactionNamespace {
  /** Returns true when undo/redo transactions are backed by the current runtime. */
  hasSupport(): boolean
  /** Returns the current transaction stack snapshot, or null when unsupported. */
  getSnapshot(): DataGridTransactionSnapshot | null
  /** Opens a transaction batch and returns its batch id. */
  beginBatch(label?: string): string
  /** Commits the current or specified transaction batch. */
  commitBatch(batchId?: string): Promise<readonly string[]>
  /** Rolls back the current or specified transaction batch. */
  rollbackBatch(batchId?: string): readonly string[]
  /** Applies a transaction through the public transaction service. */
  apply(transaction: DataGridTransactionInput, options?: DataGridApiMutationControlOptions): Promise<string>
  /** Returns true when an undo operation is available. */
  canUndo(): boolean
  /** Returns true when a redo operation is available. */
  canRedo(): boolean
  /** Runs one undo operation and returns the transaction id when applied. */
  undo(): Promise<string | null>
  /** Runs one redo operation and returns the transaction id when applied. */
  redo(): Promise<string | null>
}

export interface DataGridApiRowsNamespace<TRow = unknown> {
  /** Returns the current row-model snapshot, including projection and pagination state. */
  getSnapshot(): DataGridRowModelSnapshot<TRow>
  /** Returns the current projected row count. */
  getCount(): number
  /** Returns the projected row node at index, or undefined when out of range. */
  get(index: number): DataGridRowNode<TRow> | undefined
  /** Returns projected row nodes in the inclusive index range. */
  getRange(range: DataGridViewportRange): readonly DataGridRowNode<TRow>[]
  /**
   * Returns row data for all current projected leaf rows in api.rows order.
   *
   * The result reflects active projection state such as filtering, sorting,
   * grouping, pivoting, tree expansion, and pagination. Group/header rows are
   * excluded. Returns a new array and does not clone row objects.
   */
  getProjectedRows(): TRow[]
  /** Returns true when the row model supports replacing/inserting row data. */
  hasDataMutationSupport(): boolean
  /** Returns true when the row model supports row insertion helpers. */
  hasInsertSupport(): boolean
  /** Replaces row data using the row model mutation capability. */
  setData(rows: readonly DataGridRowNodeInput<TRow>[]): void
  /** Replaces row data, using a dedicated replace path when available. */
  replaceData(rows: readonly DataGridRowNodeInput<TRow>[]): void
  /** Appends rows to the end of the row model when supported. */
  appendData(rows: readonly DataGridRowNodeInput<TRow>[]): void
  /** Prepends rows to the start of the row model when supported. */
  prependData(rows: readonly DataGridRowNodeInput<TRow>[]): void
  /** Inserts rows at the projected/source index supported by the row model. */
  insertDataAt(index: number, rows: readonly DataGridRowNodeInput<TRow>[]): boolean
  /** Inserts rows before the row id when supported. */
  insertDataBefore(rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<TRow>[]): boolean
  /** Inserts rows after the row id when supported. */
  insertDataAfter(rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<TRow>[]): boolean
  /** Returns the current pagination snapshot. */
  getPagination(): DataGridPaginationSnapshot
  /** Sets pagination state, or disables pagination when null. */
  setPagination(pagination: DataGridPaginationInput | null): void
  /** Sets page size while preserving pagination semantics. */
  setPageSize(pageSize: number | null): void
  /** Sets the current zero-based page index. */
  setCurrentPage(page: number): void
  /** Replaces the current sort model. */
  setSortModel(sortModel: readonly DataGridSortState[]): void
  /** Replaces the current filter model. */
  setFilterModel(filterModel: DataGridFilterSnapshot | null): void
  /** Replaces sort and filter models in one projection update when supported. */
  setSortAndFilterModel(input: DataGridSortAndFilterModelInput): void
  /** Sets group-by state, or disables grouping when null. */
  setGroupBy(groupBy: DataGridGroupBySpec | null): void
  /** Sets row aggregation state, or disables aggregation when null. */
  setAggregationModel(aggregationModel: DataGridAggregationModel<TRow> | null): void
  /** Returns the current row aggregation model, or null when disabled. */
  getAggregationModel(): DataGridAggregationModel<TRow> | null
  /** Replaces group expansion state. */
  setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null): void
  /** Toggles one group expansion key. */
  toggleGroup(groupKey: string): void
  /** Expands one group key. */
  expandGroup(groupKey: string): void
  /** Collapses one group key. */
  collapseGroup(groupKey: string): void
  /** Expands all groups in the current grouping model. */
  expandAllGroups(): void
  /** Collapses all groups in the current grouping model. */
  collapseAllGroups(): void
  /** Returns true when row patch operations are supported. */
  hasPatchSupport(): boolean
  /** Returns true when external row updates are supported. */
  hasExternalUpdateSupport(): boolean
  /** Returns true when computed fields are supported. */
  hasComputedSupport(): boolean
  /** Registers a computed field on supported client row models. */
  registerComputedField(definition: DataGridComputedFieldDefinition<TRow>): void
  /** Returns registered non-formula computed field snapshots. */
  getComputedFields(): readonly DataGridComputedFieldSnapshot[]
  /** Recomputes computed/formula fields for all rows or the provided row ids. */
  recomputeComputedFields(rowIds?: readonly DataGridRowId[]): number
  /** Returns true when formula fields are supported. */
  hasFormulaSupport(): boolean
  /** Registers a formula-backed computed field. */
  registerFormulaField(definition: DataGridFormulaFieldDefinition): void
  /** Returns registered formula field snapshots. */
  getFormulaFields(): readonly DataGridFormulaFieldSnapshot[]
  /** Recomputes formulas affected by changed external context keys. */
  recomputeFormulaContext(request: DataGridFormulaContextRecomputeRequest): number
  /** Returns true when formula function registration is supported. */
  hasFormulaFunctionRegistrySupport(): boolean
  /** Registers or replaces a formula function by name. */
  registerFormulaFunction(
    name: string,
    definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[]) => unknown),
  ): void
  /** Unregisters a formula function by name and reports whether it existed. */
  unregisterFormulaFunction(name: string): boolean
  /** Returns registered formula function names. */
  getFormulaFunctionNames(): readonly string[]
  /** Applies row patches through the row model patch capability. */
  patch(
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ): void
  /** Applies user-edit style row patches and optional reapply/abort policy. */
  applyEdits(
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridApplyEditsOptions,
  ): void | Promise<void>
  /** Applies external row updates through supported row models. */
  applyExternalUpdates(
    updates: readonly DataGridExternalRowUpdate<TRow>[],
    options?: DataGridExternalRowUpdateOptions,
  ): void | Promise<void>
  /** Sets whether edits automatically reapply current projection by default. */
  setAutoReapply(value: boolean): void
  /** Returns the default auto-reapply policy for row edits. */
  getAutoReapply(): boolean
  /** Runs row operations in a row-model batch boundary when supported. */
  batch<TResult>(fn: () => TResult): TResult
}

export interface DataGridApiDataNamespace {
  /** Returns true when data-source backpressure controls are supported. */
  hasBackpressureControlSupport(): boolean
  /** Pauses data-source backpressure processing when supported. */
  pause(): boolean
  /** Resumes data-source backpressure processing when supported. */
  resume(): boolean
  /** Flushes queued data-source backpressure work when supported. */
  flush(): Promise<void>
}

export interface DataGridApiColumnsNamespace {
  /** Returns the current column model snapshot. */
  getSnapshot(): DataGridColumnModelSnapshot
  /** Returns one column snapshot by key. */
  get(key: string): DataGridColumnSnapshot | undefined
  /** Replaces all column definitions. */
  setAll(columns: DataGridColumnInput[]): void
  /** Inserts columns at the target column index. */
  insertAt(index: number, columns: readonly DataGridColumnInput[]): boolean
  /** Inserts columns before the target column key. */
  insertBefore(columnKey: string, columns: readonly DataGridColumnInput[]): boolean
  /** Inserts columns after the target column key. */
  insertAfter(columnKey: string, columns: readonly DataGridColumnInput[]): boolean
  /** Replaces the global column order. */
  setOrder(keys: readonly string[]): void
  /** Replaces column order for a pin/zone segment. */
  setZoneOrder(zone: DataGridColumnZone, keys: readonly string[]): void
  /** Sets column visibility. */
  setVisibility(key: string, visible: boolean): void
  /** Sets column width, or clears explicit width when null. */
  setWidth(key: string, width: number | null): void
  /** Sets column pinning state. */
  setPin(key: string, pin: DataGridColumnPin): void
  /** Returns a value histogram for the column when supported. */
  getHistogram(columnId: string, options?: DataGridColumnHistogramOptions): DataGridColumnHistogramResult
}

export interface DataGridApiViewNamespace {
  /** Sets the logical viewport row range. */
  setViewportRange(range: DataGridViewportRange): void
  /** Returns semantic viewport position when the adapter supports it. */
  getViewportPosition(): DataGridViewportPositionSnapshot | null
  /** Restores semantic viewport position when the adapter supports it. */
  setViewportPosition(
    position: DataGridViewportPositionSnapshot,
    options?: DataGridSetViewportPositionOptions,
  ): void
  /** Scrolls the view to a row target. */
  scrollToRow(target: DataGridViewportRowTarget): void
  /** Scrolls the view to a column target. */
  scrollToColumn(target: DataGridViewportColumnTarget): void
  /** Scrolls the view to a cell target. */
  scrollToCell(target: DataGridViewportCellTarget): void
  /** Sets row height behavior for rendered rows. */
  setRowHeightMode(mode: "fixed" | "auto"): void
  /** Sets the base row height used by fixed/estimated layouts. */
  setBaseRowHeight(height: number): void
  /** Requests adapter row-height measurement when supported. */
  measureRowHeight(): void
  /** Returns the effective row height used by the view. */
  getEffectiveRowHeight(): number
  /** Sets or clears a per-row height override. */
  setRowHeightOverride(rowIndex: number, height: number | null): void
  /** Returns a per-row height override, or null when none is set. */
  getRowHeightOverride(rowIndex: number): number | null
  /** Returns the row-height state revision. */
  getRowHeightVersion(): number
  /** Returns all row-height overrides when the adapter exposes them. */
  getRowHeightOverridesSnapshot?(): ReadonlyMap<number, number>
  /** Returns the latest row-height mutation for synchronization/debugging. */
  getLastRowHeightMutation?(): {
    version: number
    kind: "set" | "clear" | "clear-all"
    rowIndex: number | null
    previousHeight: number | null
    nextHeight: number | null
  } | null
  /** Clears all per-row height overrides. */
  clearRowHeightOverrides(): void
  /** Refreshes view materialization without changing row data. */
  refresh(options?: DataGridRefreshOptions): Promise<void> | void
  /** Reapplies projection/view state without changing row data. */
  reapply(): Promise<void> | void
  /** Expands all groups through the row model. */
  expandAllGroups(): void
  /** Collapses all groups through the row model. */
  collapseAllGroups(): void
  /** Refreshes rendered cells addressed by row keys and column keys. */
  refreshCellsByRowKeys(
    rowKeys: readonly DataGridRowId[],
    columnKeys: readonly string[],
    options?: DataGridCellRefreshOptions,
  ): void
  /** Refreshes rendered cells addressed by row/column ranges. */
  refreshCellsByRanges(
    ranges: readonly DataGridCellRefreshRange[],
    options?: DataGridCellRefreshOptions,
  ): void
  /** Subscribes to cell refresh batches and returns an unsubscribe function. */
  onCellsRefresh(listener: DataGridCellsRefreshListener): () => void
}

export type DataGridApiProjectionMode = "mutable" | "immutable" | "excel-like"

export interface DataGridApiComputeNamespace {
  /** Returns true when compute-mode controls are supported. */
  hasSupport(): boolean
  /** Returns the active compute mode, or null when unsupported. */
  getMode(): DataGridClientComputeMode | null
  /** Switches compute mode and reports whether it changed. */
  switchMode(mode: DataGridClientComputeMode): boolean
  /** Returns compute diagnostics, or null when unsupported. */
  getDiagnostics(): DataGridClientComputeDiagnostics | null
}

export interface DataGridApiPolicyNamespace {
  /** Returns the active projection mutation policy. */
  getProjectionMode(): DataGridApiProjectionMode
  /** Sets projection mutation policy and returns the applied mode. */
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

export interface DataGridApiFormulaExplainEntry {
  name: string
  field: string
  formula: string
  level: number | null
  identifiers: readonly string[]
  dependencies: readonly DataGridFormulaExplainDependency[]
  contextKeys: readonly string[]
  dependents: readonly string[]
  tree: DataGridFormulaExplainNode
  runtime: DataGridFormulaNodeComputeDiagnostics | null
  dirty: boolean
  recomputed: boolean
  touched: boolean
  dirtyCauses: readonly DataGridFormulaDirtyCause[]
}

export interface DataGridApiFormulaExplainSnapshot {
  executionPlan: DataGridFormulaExecutionPlanSnapshot | null
  graph?: DataGridFormulaGraphSnapshot | null
  projectionFormula: DataGridProjectionFormulaDiagnostics | null
  computeStage: DataGridFormulaComputeStageDiagnostics | null
  rowRecompute?: DataGridFormulaRowRecomputeDiagnostics | null
  formulas?: readonly DataGridApiFormulaExplainEntry[]
}

export interface DataGridApiDiagnosticsNamespace {
  /** Returns read-only runtime diagnostics without triggering recompute. */
  getAll(): DataGridApiDiagnosticsSnapshot
  /** Returns formula execution/explain diagnostics. */
  getFormulaExplain(): DataGridApiFormulaExplainSnapshot
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
  /** Returns schema metadata for the current row and column models. */
  getSchema(): DataGridApiSchemaSnapshot
  /** Returns the active row model kind. */
  getRowModelKind(): DataGridRowModelKind
  /** Returns the public API compatibility version. */
  getApiVersion(): string
  /** Returns the data/protocol compatibility version. */
  getProtocolVersion(): string
  /** Returns runtime-resolved API capabilities. */
  getCapabilities(): DataGridApiCapabilities
  /** Returns compact runtime metadata for diagnostics/integrations. */
  getRuntimeInfo(): DataGridApiRuntimeInfo
}

export interface DataGridUnifiedColumnState {
  order: readonly string[]
  zoneOrder?: Partial<Readonly<Record<DataGridColumnZone, readonly string[]>>>
  visibility: Readonly<Record<string, boolean>>
  widths: Readonly<Record<string, number | null>>
  pins: Readonly<Record<string, DataGridColumnPin>>
}

export interface DataGridUnifiedRowsState<TRow = unknown> {
  snapshot: DataGridRowModelSnapshot<TRow>
  aggregationModel: DataGridAggregationModel<TRow> | null
}

export interface DataGridUnifiedViewState {
  viewportPosition: DataGridViewportPositionSnapshot | null
}

export interface DataGridUnifiedState<TRow = unknown> {
  version: 1
  rows: DataGridUnifiedRowsState<TRow>
  columns: DataGridUnifiedColumnState
  view?: DataGridUnifiedViewState
  selection: DataGridSelectionSnapshot | null
  rowSelection: DataGridRowSelectionSnapshot | null
  transaction: DataGridTransactionSnapshot | null
}

export interface DataGridGetStateOptions {
  includeViewportPosition?: boolean
}

export interface DataGridSetStateOptions {
  applyColumns?: boolean
  applySelection?: boolean
  applyViewport?: boolean
  applyViewportPosition?: boolean
  dataSource?: DataGridSetStateDataSourceOptions
  strict?: boolean
}

export interface DataGridSetStateDataSourceOptions {
  atomic?: boolean
  resetViewportRange?: DataGridViewportRange | null
}

export interface DataGridMigrateStateOptions {
  strict?: boolean
}

export interface DataGridApiStateNamespace<TRow = unknown> {
  /** Exports unified grid state for persistence or transfer. */
  get(options?: DataGridGetStateOptions): DataGridUnifiedState<TRow>
  /** Migrates and validates unknown state into the current unified state shape. */
  migrate(state: unknown, options?: DataGridMigrateStateOptions): DataGridUnifiedState<TRow> | null
  /** Imports unified grid state through public model boundaries. */
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

export interface DataGridApiRowSelectionChangedEvent {
  snapshot: DataGridRowSelectionSnapshot | null
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
  "row-selection:changed": DataGridApiRowSelectionChangedEvent
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
  /** Registers a plugin by id and reports whether it was added. */
  register(plugin: DataGridApiPluginDefinition<TRow>): boolean
  /** Unregisters a plugin by id and reports whether it existed. */
  unregister(id: string): boolean
  /** Returns true when a plugin id is registered. */
  has(id: string): boolean
  /** Lists registered plugin ids. */
  list(): readonly string[]
  /** Unregisters all plugins. */
  clear(): void
}

export interface DataGridApiEventsNamespace<TRow = unknown> {
  /** Subscribes to a typed API event and returns an unsubscribe function. */
  on<K extends keyof DataGridApiEventMap<TRow>>(
    event: K,
    listener: (payload: DataGridApiEventMap<TRow>[K]) => void,
  ): () => void
}

export interface DataGridApiLifecycleNamespace {
  readonly state: DataGridCore["lifecycle"]["state"]
  readonly startupOrder: DataGridCore["lifecycle"]["startupOrder"]
  /** Returns true while a guarded lifecycle/API operation is running. */
  isBusy(): boolean
  /** Resolves when the guarded operation queue becomes idle. */
  whenIdle(): Promise<void>
  /** Runs work in the lifecycle exclusive operation queue. */
  runExclusive<TResult>(fn: () => TResult | Promise<TResult>): Promise<TResult>
}

export interface DataGridApiCapabilities {
  readonly patch: boolean
  readonly externalUpdate: boolean
  readonly dataMutation: boolean
  readonly backpressureControl: boolean
  readonly compute: boolean
  readonly selection: boolean
  readonly rowSelection: boolean
  readonly transaction: boolean
  readonly histogram: boolean
  readonly sortFilterBatch: boolean
  readonly viewportPosition: boolean
}

export interface DataGridApi<TRow = unknown> {
  readonly lifecycle: DataGridApiLifecycleNamespace
  readonly capabilities: DataGridApiCapabilities
  readonly pivot: DataGridApiPivotNamespace<TRow>
  readonly selection: DataGridApiSelectionNamespace<TRow>
  readonly rowSelection: DataGridApiRowSelectionNamespace<TRow>
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
  /** Initializes registered core services. */
  init(): Promise<void>
  /** Starts registered core services. */
  start(): Promise<void>
  /** Stops registered core services. */
  stop(): Promise<void>
  /** Disposes API-owned runtimes and registered core services. */
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
  readSelectionCell?: (rowNode: DataGridRowNode<TRow>, columnKey: string) => unknown
}
