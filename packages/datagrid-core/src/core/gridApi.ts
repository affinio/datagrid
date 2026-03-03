import {
  createDataGridCellRefreshRegistry,
} from "./gridApiCellRefresh"
import { createDataGridApiComputeMethods } from "./gridApiComputeMethods"
import { createDataGridApiColumnsMethods } from "./gridApiColumnsMethods"
import { createDataGridApiDiagnosticsMethods } from "./gridApiDiagnosticsMethods"
import { createDataGridApiEventsRuntime } from "./gridApiEventsRuntime"
import { createDataGridApiMetaMethods } from "./gridApiMetaMethods"
import {
  createDataGridApiCapabilityRuntime,
} from "./gridApiCapabilitiesRuntime"
import { createDataGridApiPluginsRuntime } from "./gridApiPluginsRuntime"
import { createDataGridApiPolicyMethods } from "./gridApiPolicyMethods"
import type { DataGridApi, DataGridApiProjectionMode } from "./gridApiContracts"
import {
  resolveDataGridApiDependencies,
  type CreateDataGridApiOptions,
} from "./gridApiDependencies"
import {
  createDataGridApiFromMethodSet,
  type DataGridApiMethodSet,
} from "./gridApiNamespaces"
import { createDataGridApiPivotMethods } from "./gridApiPivotMethods"
import { createDataGridApiRowsMethods } from "./gridApiRowsMethods"
import { createDataGridApiSelectionMethods } from "./gridApiSelectionMethods"
import { buildDataGridSelectionSummary } from "./gridApiSelectionSummary"
import { createDataGridApiStateMethods } from "./gridApiStateMethods"
import { createDataGridApiTransactionMethods } from "./gridApiTransactionMethods"
import { createDataGridApiViewMethods } from "./gridApiViewMethods"

export type {
  CreateDataGridApiFromCoreOptions,
  CreateDataGridApiFromDepsOptions,
  CreateDataGridApiDependencies,
  CreateDataGridApiOptions,
} from "./gridApiDependencies"

export type {
  DataGridRefreshOptions,
  DataGridApplyEditsOptions,
  DataGridApiPivotNamespace,
  DataGridApiSelectionNamespace,
  DataGridApiTransactionNamespace,
  DataGridApiRowsNamespace,
  DataGridApiColumnsNamespace,
  DataGridApiViewNamespace,
  DataGridApiComputeNamespace,
  DataGridApiDiagnosticsNamespace,
  DataGridApiDiagnosticsSnapshot,
  DataGridApiRowModelDiagnostics,
  DataGridApiMetaNamespace,
  DataGridApiSchemaSnapshot,
  DataGridApiSchemaColumn,
  DataGridApiRuntimeInfo,
  DataGridApiPolicyNamespace,
  DataGridApiProjectionMode,
  DataGridApiPluginDefinition,
  DataGridApiPluginsNamespace,
  DataGridApiStateNamespace,
  DataGridApiEventsNamespace,
  DataGridApiCapabilities,
  DataGridApiEventMap,
  DataGridApiEventName,
  DataGridApiEventPayload,
  DataGridSetStateOptions,
  DataGridUnifiedRowsState,
  DataGridUnifiedColumnState,
  DataGridUnifiedState,
  DataGridApi,
  DataGridSelectionSummaryApiOptions,
} from "./gridApiContracts"

export type {
  DataGridCellRefreshOptions,
  DataGridCellRefreshRange,
  DataGridCellRefreshEntry,
  DataGridCellsRefreshBatch,
  DataGridCellsRefreshListener,
} from "./gridApiCellRefresh"

export type {
  DataGridPivotLayoutColumnState,
  DataGridPivotLayoutSnapshot,
  DataGridPivotLayoutImportOptions,
  DataGridPivotInteropSnapshot,
} from "./gridApiPivotLayout"

export function createDataGridApi<TRow = unknown>(
  options: CreateDataGridApiOptions<TRow>,
): DataGridApi<TRow> {
  const deps = resolveDataGridApiDependencies(options)
  const {
    lifecycle,
    init,
    start,
    stop,
    dispose,
    rowModel,
    columnModel,
    getViewportService,
    getSelectionService,
    getTransactionService,
    initialPlugins,
  } = deps
  let projectionMode: DataGridApiProjectionMode = "excel-like"

  const capabilityRuntime = createDataGridApiCapabilityRuntime<TRow>({
    rowModel,
    getSelectionService,
    getTransactionService,
  })
  const {
    capabilities,
    getSelectionCapability,
    getTransactionCapability,
    getPatchCapability,
    getRowsDataMutationCapability,
    getComputeCapability,
    getSortFilterBatchCapability,
    getColumnHistogramCapability,
  } = capabilityRuntime
  const cellRefreshRegistry = createDataGridCellRefreshRegistry(rowModel, columnModel)
  const eventsRuntime = createDataGridApiEventsRuntime<TRow>({
    rowModel,
    columnModel,
  })
  const rowsMethods = createDataGridApiRowsMethods<TRow>({
    rowModel,
    getPatchCapability,
    getRowsDataMutationCapability,
    getSortFilterBatchCapability,
    getProjectionMode: () => projectionMode,
  })
  const viewMethods = createDataGridApiViewMethods<TRow>({
    rowModel,
    getViewportService,
    cellRefreshQueue: cellRefreshRegistry,
  })
  const pivotMethods = createDataGridApiPivotMethods<TRow>({
    rowModel,
    columnModel,
    getSortFilterBatchCapability,
  })
  const columnsMethods = createDataGridApiColumnsMethods({
    columnModel,
    getColumnHistogramCapability,
  })
  const computeMethods = createDataGridApiComputeMethods({
    getComputeCapability,
  })
  const diagnosticsMethods = createDataGridApiDiagnosticsMethods({
    rowModel,
    getComputeCapability,
  })
  const transactionMethods = createDataGridApiTransactionMethods({
    getTransactionCapability,
    onChanged: snapshot => eventsRuntime.emitTransactionChanged(snapshot),
  })
  const selectionMethods = createDataGridApiSelectionMethods<TRow>({
    getSelectionCapability,
    onChanged: snapshot => eventsRuntime.emitSelectionChanged(snapshot),
    summarize: (selectionSnapshot, options) =>
      buildDataGridSelectionSummary<TRow>({
        selectionSnapshot,
        rowModel,
        columnModel,
        options,
      }),
  })
  const stateMethods = createDataGridApiStateMethods<TRow>({
    rowModel,
    columnModel,
    getSelectionCapability,
    getTransactionCapability,
    getSortFilterBatchCapability,
    setViewportRange: viewMethods.setViewportRange,
    onSelectionChanged: snapshot => eventsRuntime.emitSelectionChanged(snapshot),
    onStateImported: state => eventsRuntime.emitStateImported(state),
  })
  const policyMethods = createDataGridApiPolicyMethods({
    getProjectionMode: () => projectionMode,
    setProjectionMode: (mode) => {
      projectionMode = mode
      if (mode === "mutable") {
        rowsMethods.setAutoReapply(true)
        return
      }
      rowsMethods.setAutoReapply(false)
    },
  })
  const metaMethods = createDataGridApiMetaMethods({
    rowModel,
    columnModel,
    lifecycleState: () => lifecycle.state,
    getProjectionMode: () => projectionMode,
    getComputeMode: () => computeMethods.getComputeMode(),
    getCapabilities: () => capabilities,
  })
  const pluginsRuntime = createDataGridApiPluginsRuntime<TRow>({
    events: eventsRuntime.namespace,
    initialPlugins,
  })

  const methodSet: DataGridApiMethodSet<TRow> = {
    lifecycle,
    capabilities,
    init,
    start,
    stop,
    dispose() {
      pluginsRuntime.dispose()
      cellRefreshRegistry.dispose()
      eventsRuntime.dispose()
      return dispose()
    },
    ...rowsMethods,
    ...viewMethods,
    ...pivotMethods,
    ...columnsMethods,
    ...computeMethods,
    ...diagnosticsMethods,
    ...metaMethods,
    ...policyMethods,
    ...transactionMethods,
    ...selectionMethods,
    ...stateMethods,
    registerPlugin: pluginsRuntime.registerPlugin,
    unregisterPlugin: pluginsRuntime.unregisterPlugin,
    hasPlugin: pluginsRuntime.hasPlugin,
    listPlugins: pluginsRuntime.listPlugins,
    clearPlugins: pluginsRuntime.clearPlugins,
    onApiEvent: eventsRuntime.namespace.on,
  }
  return createDataGridApiFromMethodSet(methodSet)
}
