# DataGrid API method reference

Status: advanced public reference.

This page is the method-level reference for `DataGridApi` from
`@affino/datagrid-core`. The API is namespaced: use `api.rows.setData(...)`, not
an old flat method such as `api.setData(...)`.

All argument and result types below are public exports from
`@affino/datagrid-core`. `TRow` is the row type used to create the API.

## Lifecycle

```ts
api.lifecycle.state: DataGridCore["lifecycle"]["state"]
api.lifecycle.startupOrder: DataGridCore["lifecycle"]["startupOrder"]
api.lifecycle.isBusy(): boolean
api.lifecycle.whenIdle(): Promise<void>
api.lifecycle.runExclusive<TResult>(fn: () => TResult | Promise<TResult>): Promise<TResult>

api.init(): Promise<void>
api.start(): Promise<void>
api.stop(): Promise<void>
api.dispose(): Promise<void>
```

Call `init()` once after creating the API, then `start()`. `dispose()` is
terminal: use it when the runtime will not be reused.

## Rows and projection

```ts
api.rows.getSnapshot(): DataGridRowModelSnapshot<TRow>
api.rows.getCount(): number
api.rows.get(index: number): DataGridRowNode<TRow> | undefined
api.rows.getRange(range: DataGridViewportRange): readonly DataGridRowNode<TRow>[]
api.rows.getProjectedRows(): TRow[]

api.rows.hasDataMutationSupport(): boolean
api.rows.hasInsertSupport(): boolean
api.rows.setData(rows: readonly DataGridRowNodeInput<TRow>[]): void
api.rows.replaceData(rows: readonly DataGridRowNodeInput<TRow>[]): void
api.rows.appendData(rows: readonly DataGridRowNodeInput<TRow>[]): void
api.rows.prependData(rows: readonly DataGridRowNodeInput<TRow>[]): void
api.rows.insertDataAt(index: number, rows: readonly DataGridRowNodeInput<TRow>[]): boolean
api.rows.insertDataBefore(rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<TRow>[]): boolean
api.rows.insertDataAfter(rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<TRow>[]): boolean

api.rows.getPagination(): DataGridPaginationSnapshot
api.rows.setPagination(pagination: DataGridPaginationInput | null): void
api.rows.setPageSize(pageSize: number | null): void
api.rows.setCurrentPage(page: number): void
api.rows.setSortModel(sortModel: readonly DataGridSortState[]): void
api.rows.setFilterModel(filterModel: DataGridFilterSnapshot | null): void
api.rows.setSortAndFilterModel(input: DataGridSortAndFilterModelInput): void
api.rows.setGroupBy(groupBy: DataGridGroupBySpec | null): void
api.rows.setAggregationModel(model: DataGridAggregationModel<TRow> | null): void
api.rows.getAggregationModel(): DataGridAggregationModel<TRow> | null
api.rows.setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null): void
api.rows.toggleGroup(groupKey: string): void
api.rows.expandGroup(groupKey: string): void
api.rows.collapseGroup(groupKey: string): void
api.rows.expandAllGroups(): void
api.rows.collapseAllGroups(): void

api.rows.hasPatchSupport(): boolean
api.rows.hasExternalUpdateSupport(): boolean
api.rows.patch(updates: readonly DataGridClientRowPatch<TRow>[], options?: DataGridClientRowPatchOptions): void
api.rows.applyEdits(updates: readonly DataGridClientRowPatch<TRow>[], options?: DataGridApplyEditsOptions): void | Promise<void>
api.rows.applyExternalUpdates(updates: readonly DataGridExternalRowUpdate<TRow>[], options?: DataGridExternalRowUpdateOptions): void | Promise<void>
api.rows.setAutoReapply(value: boolean): void
api.rows.getAutoReapply(): boolean
api.rows.batch<TResult>(fn: () => TResult): TResult
```

`index` and `range` address the current projected row order. Sorting,
filtering, grouping, tree expansion, pivoting, and pagination can change that
order. `getProjectedRows()` returns leaf row data only; group/header rows are
excluded.

### Computed and formula fields

```ts
api.rows.hasComputedSupport(): boolean
api.rows.registerComputedField(definition: DataGridComputedFieldDefinition<TRow>): void
api.rows.getComputedFields(): readonly DataGridComputedFieldSnapshot[]
api.rows.recomputeComputedFields(rowIds?: readonly DataGridRowId[]): number
api.rows.hasFormulaSupport(): boolean
api.rows.registerFormulaField(definition: DataGridFormulaFieldDefinition): void
api.rows.getFormulaFields(): readonly DataGridFormulaFieldSnapshot[]
api.rows.recomputeFormulaContext(request: DataGridFormulaContextRecomputeRequest): number
api.rows.hasFormulaFunctionRegistrySupport(): boolean
api.rows.registerFormulaFunction(name: string, definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[]) => unknown)): void
api.rows.unregisterFormulaFunction(name: string): boolean
api.rows.getFormulaFunctionNames(): readonly string[]
```

## Data-source backpressure

```ts
api.data.hasBackpressureControlSupport(): boolean
api.data.pause(): boolean
api.data.resume(): boolean
api.data.flush(): Promise<void>
```

These methods are available only when the bound row model exposes backpressure
control. Check `api.capabilities.backpressureControl` before adding controls
for them to a host UI.

## Columns

```ts
api.columns.getSnapshot(): DataGridColumnModelSnapshot
api.columns.get(key: string): DataGridColumnSnapshot | undefined
api.columns.setAll(columns: DataGridColumnInput[]): void
api.columns.insertAt(index: number, columns: readonly DataGridColumnInput[]): boolean
api.columns.insertBefore(columnKey: string, columns: readonly DataGridColumnInput[]): boolean
api.columns.insertAfter(columnKey: string, columns: readonly DataGridColumnInput[]): boolean
api.columns.setOrder(keys: readonly string[]): void
api.columns.setZoneOrder(zone: DataGridColumnZone, keys: readonly string[]): void
api.columns.setVisibility(key: string, visible: boolean): void
api.columns.setWidth(key: string, width: number | null): void
api.columns.setPin(key: string, pin: DataGridColumnPin): void
api.columns.getHistogram(columnId: string, options?: DataGridColumnHistogramOptions): DataGridColumnHistogramResult
```

`setWidth(key, null)` clears the explicit width. Histogram calls require the
`histogram` capability.

## View and rendered cells

```ts
api.view.setViewportRange(range: DataGridViewportRange): void
api.view.getViewportPosition(): DataGridViewportPositionSnapshot | null
api.view.setViewportPosition(position: DataGridViewportPositionSnapshot, options?: DataGridSetViewportPositionOptions): void
api.view.scrollToRow(target: DataGridViewportRowTarget): void
api.view.scrollToColumn(target: DataGridViewportColumnTarget): void
api.view.scrollToCell(target: DataGridViewportCellTarget): void
api.view.refresh(options?: DataGridRefreshOptions): Promise<void> | void
api.view.reapply(): Promise<void> | void
api.view.expandAllGroups(): void
api.view.collapseAllGroups(): void

api.view.setRowHeightMode(mode: "fixed" | "auto"): void
api.view.setBaseRowHeight(height: number): void
api.view.measureRowHeight(): void
api.view.getEffectiveRowHeight(): number
api.view.setRowHeightOverride(rowIndex: number, height: number | null): void
api.view.getRowHeightOverride(rowIndex: number): number | null
api.view.getRowHeightVersion(): number
api.view.getRowHeightOverridesSnapshot?(): ReadonlyMap<number, number>
api.view.getLastRowHeightMutation?(): {
  version: number
  kind: "set" | "clear" | "clear-all"
  rowIndex: number | null
  previousHeight: number | null
  nextHeight: number | null
} | null
api.view.clearRowHeightOverrides(): void

api.view.refreshCellsByRowKeys(rowKeys: readonly DataGridRowId[], columnKeys: readonly string[], options?: DataGridCellRefreshOptions): void
api.view.refreshCellsByRanges(ranges: readonly DataGridCellRefreshRange[], options?: DataGridCellRefreshOptions): void
api.view.onCellsRefresh(listener: DataGridCellsRefreshListener): () => void
```

Viewport targets are semantic (`rowId`, `rowIndex`, `columnKey`, or
`columnIndex`). DOM elements and raw scroll offsets remain adapter-owned.

## Selection

```ts
api.selection.hasSupport(): boolean
api.selection.getSnapshot(): DataGridSelectionSnapshot | null
api.selection.setSnapshot(snapshot: DataGridSelectionSnapshot): void
api.selection.clear(): void
api.selection.summarize(options?: DataGridSelectionSummaryApiOptions<TRow>): DataGridSelectionSummarySnapshot | null
api.selection.getRangeRowData(): TRow[]

api.rowSelection.hasSupport(): boolean
api.rowSelection.getSnapshot(): DataGridRowSelectionSnapshot | null
api.rowSelection.setSnapshot(snapshot: DataGridRowSelectionSnapshot): void
api.rowSelection.clear(): void
api.rowSelection.getFocusedRow(): DataGridRowId | null
api.rowSelection.setFocusedRow(rowId: DataGridRowId | null): void
api.rowSelection.getSelectedRows(): readonly DataGridRowId[]
api.rowSelection.isSelected(rowId: DataGridRowId): boolean
api.rowSelection.setSelected(rowId: DataGridRowId, selected: boolean): void
api.rowSelection.selectRows(rowIds: Iterable<DataGridRowId>): void
api.rowSelection.deselectRows(rowIds: Iterable<DataGridRowId>): void
api.rowSelection.clearSelectedRows(): void
api.rowSelection.getSelectedRowData(): TRow[]
```

`selection` is cell/range selection. `rowSelection` is focused/selected row
state; the two namespaces are independent.

## Transactions

```ts
api.transaction.hasSupport(): boolean
api.transaction.getSnapshot(): DataGridTransactionSnapshot | null
api.transaction.beginBatch(label?: string): string
api.transaction.commitBatch(batchId?: string): Promise<readonly string[]>
api.transaction.rollbackBatch(batchId?: string): readonly string[]
api.transaction.apply(transaction: DataGridTransactionInput, options?: DataGridApiMutationControlOptions): Promise<string>
api.transaction.canUndo(): boolean
api.transaction.canRedo(): boolean
api.transaction.undo(): Promise<string | null>
api.transaction.redo(): Promise<string | null>
```

## Pivot, compute, diagnostics, and metadata

```ts
api.pivot.setModel(pivotModel: DataGridPivotSpec | null): void
api.pivot.getModel(): DataGridPivotSpec | null
api.pivot.getCellDrilldown(input: DataGridPivotCellDrilldownInput): DataGridPivotCellDrilldown<TRow> | null
api.pivot.exportLayout(): DataGridPivotLayoutSnapshot<TRow>
api.pivot.exportInterop(): DataGridPivotInteropSnapshot<TRow> | null
api.pivot.importLayout(layout: DataGridPivotLayoutSnapshot<TRow>, options?: DataGridPivotLayoutImportOptions): void

api.compute.hasSupport(): boolean
api.compute.getMode(): DataGridClientComputeMode | null
api.compute.switchMode(mode: DataGridClientComputeMode): boolean
api.compute.getDiagnostics(): DataGridClientComputeDiagnostics | null

api.diagnostics.getAll(): DataGridApiDiagnosticsSnapshot
api.diagnostics.getFormulaExplain(): DataGridApiFormulaExplainSnapshot
api.meta.getSchema(): DataGridApiSchemaSnapshot
api.meta.getRowModelKind(): DataGridRowModelKind
api.meta.getApiVersion(): string
api.meta.getProtocolVersion(): string
api.meta.getCapabilities(): DataGridApiCapabilities
api.meta.getRuntimeInfo(): DataGridApiRuntimeInfo
api.policy.getProjectionMode(): DataGridApiProjectionMode
api.policy.setProjectionMode(mode: DataGridApiProjectionMode): DataGridApiProjectionMode
```

`compute.switchMode()` changes the compute policy synchronously; it does not
implicitly recompute rows. `diagnostics.getAll()` is read-only.

## State, events, and plugins

```ts
api.state.get(options?: DataGridGetStateOptions): DataGridUnifiedState<TRow>
api.state.migrate(state: unknown, options?: DataGridMigrateStateOptions): DataGridUnifiedState<TRow> | null
api.state.set(state: DataGridUnifiedState<TRow>, options?: DataGridSetStateOptions): void

api.events.on<K extends keyof DataGridApiEventMap<TRow>>(
  event: K,
  listener: (payload: DataGridApiEventMap<TRow>[K]) => void,
): () => void

api.plugins.register(plugin: DataGridApiPluginDefinition<TRow>): boolean
api.plugins.unregister(id: string): boolean
api.plugins.has(id: string): boolean
api.plugins.list(): readonly string[]
api.plugins.clear(): void
```

Public event names are `rows:changed`, `columns:changed`,
`projection:recomputed`, `selection:changed`, `row-selection:changed`,
`pivot:changed`, `transaction:changed`, `viewport:changed`,
`state:import:begin`, `state:import:end`, `state:imported`, and `error`.
`events.on` returns an unsubscribe function.

## Capability checks and errors

The API object exists even when an optional service is not bound. Before an
optional operation, check its `hasSupport()` method or the matching
`api.capabilities` flag. Unsupported calls may throw a capability error;
guarded asynchronous calls can also reject with lifecycle, transaction,
mutation, or data-source errors. Subscribe to `api.events.on("error", ...)`
when the host needs recoverable runtime diagnostics.

## Related guides

- [Core API guide](../core-api.md) — lifecycle and construction.
- [Unified Grid API overview](../datagrid-grid-api.md) — semantics and invariants.
- [API stability policy](../api-stability.md) — stable versus advanced imports.
