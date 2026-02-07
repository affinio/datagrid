/**
 * Stable public API for @affino/datagrid-core.
 * Keep this surface small and semver-protected while internals evolve.
 */
export * from "./types"
export {
  createInMemoryTableSettingsAdapter,
  type UiTableSettingsAdapter,
  type UiTableGroupState,
  type UiTablePinPosition,
} from "./tableSettingsAdapter"
export {
  createInMemoryDataGridSettingsAdapter,
  type DataGridSettingsAdapter,
  type DataGridGroupState,
  type DataGridPinPosition,
} from "./dataGridSettingsAdapter"
export {
  createDataGridRuntime,
  isDataGridHostEventName,
  DATAGRID_HOST_EVENT_NAME_MAP,
  type DataGridRuntime,
  type DataGridRuntimeOptions,
  type DataGridHostEventName,
  type DataGridEventArgs,
} from "./runtime/dataGridRuntime"
export {
  createDataGridCore,
  type DataGridCore,
  type DataGridCoreLifecycleState,
  type DataGridCoreService,
  type DataGridCoreServiceContext,
  type DataGridCoreServiceName,
  type DataGridCoreServiceRegistry,
  type CreateDataGridCoreOptions,
} from "./core/gridCore"
export {
  createDataGridViewportController,
  type DataGridViewportController,
  type DataGridViewportControllerOptions,
  type DataGridViewportImperativeCallbacks,
  type DataGridViewportRuntimeOverrides,
  type DataGridViewportMetricsSnapshot,
  type DataGridViewportSyncTargets,
  type DataGridViewportSyncState,
  type DataGridViewportState,
  type DataGridRowPoolItem,
  type DataGridImperativeColumnUpdatePayload,
  type DataGridImperativeRowUpdatePayload,
  type DataGridImperativeScrollSyncPayload,
} from "./viewport/dataGridViewportController"
export {
  createClientRowModel,
  createServerBackedRowModel,
  normalizeRowNode,
  normalizeViewportRange,
  type DataGridRowNode,
  type DataGridRowNodeState,
  type DataGridRowPinState,
  type DataGridRowModel,
  type DataGridRowModelKind,
  type DataGridRowModelSnapshot,
  type DataGridRowModelListener,
  type DataGridRowModelRefreshReason,
  type DataGridViewportRange,
  type ClientRowModel,
  type CreateClientRowModelOptions,
  type ServerBackedRowModel,
  type CreateServerBackedRowModelOptions,
} from "./models"
export {
  createDataGridColumnModel,
  type DataGridColumnModel,
  type DataGridColumnModelSnapshot,
  type DataGridColumnModelListener,
  type DataGridColumnSnapshot,
  type DataGridColumnPin,
  type CreateDataGridColumnModelOptions,
} from "./models"
