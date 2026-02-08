/**
 * Advanced API for @affino/datagrid-core.
 * This surface is intended for power users and may evolve faster than root stable exports.
 */
export {
  createDataGridRuntime,
  isDataGridHostEventName,
  DATAGRID_HOST_EVENT_NAME_MAP,
  type DataGridRuntime,
  type DataGridRuntimeOptions,
  type DataGridHostEventName,
  type DataGridHostEventArgs,
  type DataGridHostEventMap,
  type DataGridEventArgs,
  type DataGridRuntimeBasePluginEventMap,
  type DataGridRuntimePluginEventMap,
  type DataGridRuntimeInternalEventMap,
  type DataGridRuntimeInternalEventName,
} from "./runtime/dataGridRuntime.js"

export type {
  DataGridPluginCapability,
  DataGridPluginCapabilityMap,
  DataGridPluginCapabilityName,
  DataGridPlugin,
  DataGridPluginDefinition,
  DataGridPluginSetupContext,
} from "../plugins"

export {
  createDataGridAdapterRuntime,
  resolveDataGridAdapterEventName,
  type DataGridAdapterKind,
  type DataGridKebabHostEventName,
  type DataGridAdapterEventNameByKind,
  type DataGridAdapterRuntimePluginContext,
  type DataGridAdapterDispatchPayload,
  type CreateDataGridAdapterRuntimeOptions,
  type DataGridAdapterRuntime,
} from "./adapters/adapterRuntimeProtocol.js"

export {
  createDataGridTransactionService,
  type DataGridTransactionCommand,
  type DataGridTransactionInput,
  type DataGridTransactionSnapshot,
  type DataGridTransactionPendingBatchSnapshot,
  type DataGridTransactionExecutionContext,
  type DataGridTransactionDirection,
  type DataGridTransactionExecutor,
  type DataGridTransactionService,
  type DataGridTransactionServiceHooks,
  type DataGridTransactionAppliedEvent,
  type DataGridTransactionRolledBackEvent,
  type DataGridTransactionHistoryEvent,
  type DataGridTransactionListener,
  type CreateDataGridTransactionServiceOptions,
} from "./core/transactionService.js"

export {
  createDataGridA11yStateMachine,
  type CreateDataGridA11yStateMachineOptions,
  type DataGridA11yCellAriaState,
  type DataGridA11yFocusCell,
  type DataGridA11yGridAriaState,
  type DataGridA11yKeyboardCommand,
  type DataGridA11yKeyCommandKey,
  type DataGridA11ySnapshot,
  type DataGridA11yStateListener,
  type DataGridA11yStateMachine,
} from "./a11y/index.js"

export {
  createDataGridViewportController,
  type DataGridViewportController,
  type DataGridViewportControllerOptions,
  type DataGridViewportImperativeCallbacks,
  type DataGridViewportRuntimeOverrides,
  type DataGridViewportMetricsSnapshot,
  type DataGridViewportIntegrationSnapshot,
  type DataGridViewportSyncTargets,
  type DataGridViewportSyncState,
  type DataGridViewportState,
  type DataGridRowPoolItem,
  type DataGridImperativeColumnUpdatePayload,
  type DataGridImperativeRowUpdatePayload,
  type DataGridImperativeScrollSyncPayload,
} from "./viewport/dataGridViewportController.js"

export {
  createDataSourceBackedRowModel,
  type CreateDataSourceBackedRowModelOptions,
  type DataSourceBackedRowModel,
  type DataGridDataSource,
  type DataGridDataSourceBackpressureDiagnostics,
  type DataGridDataSourceInvalidation,
  type DataGridDataSourcePullPriority,
  type DataGridDataSourcePullReason,
  type DataGridDataSourcePullRequest,
  type DataGridDataSourcePullResult,
  type DataGridDataSourcePushEvent,
  type DataGridDataSourcePushInvalidateEvent,
  type DataGridDataSourcePushListener,
  type DataGridDataSourcePushRemoveEvent,
  type DataGridDataSourcePushUpsertEvent,
  type DataGridDataSourceRowEntry,
} from "./models/index.js"

export {
  transformDataGridPublicProtocolSource,
  type DataGridCodemodResult,
} from "./protocol/index.js"
