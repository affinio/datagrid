export {
  HOST_EVENT_NAME_MAP as DATAGRID_HOST_EVENT_NAME_MAP,
  createTableRuntime as createDataGridRuntime,
  isHostEventName as isDataGridHostEventName,
  type EventArgs as DataGridEventArgs,
  type HostEventName as DataGridHostEventName,
  type DataGridHostEventArgs,
  type DataGridHostEventMap,
  type DataGridRuntimeBasePluginEventMap,
  type DataGridRuntimePluginEventMap,
  type DataGridRuntimeInternalEventMap,
  type DataGridRuntimeInternalEventName,
  type TableRuntime as DataGridRuntime,
  type TableRuntimeOptions as DataGridRuntimeOptions,
} from "./tableRuntime.js"

// Legacy exports kept for migration compatibility.
export * from "./tableRuntime.js"
