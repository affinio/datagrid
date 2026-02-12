/**
 * Advanced API for @affino/datagrid-core.
 * This surface is intended for power users and may evolve faster than root stable exports.
 */
export {
  createDataGridRuntime,
  isHostEventName as isDataGridHostEventName,
  HOST_EVENT_NAME_MAP,
  type DataGridRuntime,
  type DataGridRuntimeOptions,
  type DataGridHostEventName,
  type DataGridHostEventArgs,
  type DataGridHostEventMap,
  type DataGridRuntimeBasePluginEventMap,
  type DataGridRuntimePluginEventMap,
  type DataGridRuntimeInternalEventMap,
  type DataGridRuntimeInternalEventName,
} from "./runtime/dataGridRuntime.js"

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
  type DataGridTransactionAffectedRange,
  type DataGridTransactionCommand,
  type DataGridTransactionMeta,
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
  type DataGridTransactionEventEntry,
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
  type DataGridVirtualWindowSnapshot,
  type ViewportMetricsSnapshot as DataGridViewportMetricsSnapshot,
  type ViewportIntegrationSnapshot as DataGridViewportIntegrationSnapshot,
  type ViewportSyncTargets as DataGridViewportSyncTargets,
  type ViewportSyncState as DataGridViewportSyncState,
  type DataGridViewportState,
  type RowPoolItem as DataGridRowPoolItem,
  type ImperativeWindowUpdatePayload as DataGridImperativeWindowUpdatePayload,
  type ImperativeColumnUpdatePayload as DataGridImperativeColumnUpdatePayload,
  type ImperativeRowUpdatePayload as DataGridImperativeRowUpdatePayload,
  type ImperativeScrollSyncPayload as DataGridImperativeScrollSyncPayload,
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
  type DataGridDataSourceTreePullContext,
  type DataGridDataSourceTreePullOperation,
  type DataGridDataSourceTreePullScope,
  type DataGridDataSourcePushEvent,
  type DataGridDataSourcePushInvalidateEvent,
  type DataGridDataSourcePushListener,
  type DataGridDataSourcePushRemoveEvent,
  type DataGridDataSourcePushUpsertEvent,
  type DataGridDataSourceRowEntry,
} from "./models/index.js"

export {
  applyGroupSelectionPolicy,
  clampGridSelectionPoint,
  clampSelectionArea,
  createGridSelectionContextFromFlattenedRows,
  createGridSelectionRange,
  createGridSelectionRangeFromInput,
  normalizeGridSelectionRange,
  type GridSelectionFlattenedRow,
  type GridSelectionContext,
  type GridSelectionPoint,
  type GridSelectionPointLike,
  type GridSelectionRange,
  type GridSelectionRangeInput,
  type GridSelectionGroupPolicyOptions,
} from "./selection/selectionState.js"

export {
  transformDataGridPublicProtocolSource,
  type DataGridCodemodResult,
} from "./protocol/index.js"

export type {
  DataGridAdvancedEventMap,
  DataGridAdvancedEventName,
  DataGridEventAffectedRange,
  DataGridEventEnvelope,
  DataGridEventPhase,
  DataGridEventSource,
  DataGridEventTier,
  DataGridInternalEventMap,
  DataGridInternalEventName,
  DataGridStableEventMap,
  DataGridStableEventName,
} from "./protocol/index.js"
export {
  DATAGRID_EVENT_TIERS,
  DATAGRID_EVENT_TIER_ENTRYPOINTS,
  createDataGridEventEnvelope,
  isDataGridEventTier,
} from "./protocol/index.js"
