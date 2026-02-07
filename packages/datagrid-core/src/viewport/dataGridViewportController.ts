export {
  createTableViewportController as createDataGridViewportController,
  type TableViewportController as DataGridViewportController,
  type TableViewportControllerOptions as DataGridViewportControllerOptions,
  type TableViewportImperativeCallbacks as DataGridViewportImperativeCallbacks,
  type TableViewportRuntimeOverrides as DataGridViewportRuntimeOverrides,
  type ViewportMetricsSnapshot as DataGridViewportMetricsSnapshot,
  type ViewportSyncTargets as DataGridViewportSyncTargets,
  type ViewportSyncState as DataGridViewportSyncState,
  type TableViewportState as DataGridViewportState,
  type RowPoolItem as DataGridRowPoolItem,
  type ImperativeColumnUpdatePayload as DataGridImperativeColumnUpdatePayload,
  type ImperativeRowUpdatePayload as DataGridImperativeRowUpdatePayload,
  type ImperativeScrollSyncPayload as DataGridImperativeScrollSyncPayload,
} from "./tableViewportController"

// Legacy exports kept for migration compatibility.
export * from "./tableViewportController"
