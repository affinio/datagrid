import {
  createDataGridCellRefreshRegistry,
} from "./gridApiCellRefresh"
import {
  DATAGRID_PUBLIC_PACKAGE_VERSION,
  DATAGRID_PUBLIC_PROTOCOL_VERSION,
} from "../protocol"
import { createDataGridApiComputeMethods } from "./gridApiComputeMethods"
import { createDataGridApiColumnsMethods } from "./gridApiColumnsMethods"
import { createDataGridApiDataMethods } from "./gridApiDataMethods"
import { createDataGridApiDiagnosticsMethods } from "./gridApiDiagnosticsMethods"
import { createDataGridApiEventsRuntime } from "./gridApiEventsRuntime"
import { createDataGridApiMetaMethods } from "./gridApiMetaMethods"
import { createDataGridApiLifecycleRuntime } from "./gridApiLifecycleRuntime"
import {
  createDataGridApiCapabilityRuntime,
} from "./gridApiCapabilitiesRuntime"
import { createDataGridApiPluginsRuntime } from "./gridApiPluginsRuntime"
import { createDataGridApiPolicyMethods } from "./gridApiPolicyMethods"
import type {
  DataGridApi,
  DataGridApiErrorCode,
  DataGridApiProjectionMode,
} from "./gridApiContracts"
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
  DataGridApiMutationControlOptions,
  DataGridApiPivotNamespace,
  DataGridApiSelectionNamespace,
  DataGridApiTransactionNamespace,
  DataGridApiRowsNamespace,
  DataGridApiDataNamespace,
  DataGridApiColumnsNamespace,
  DataGridApiViewNamespace,
  DataGridApiComputeNamespace,
  DataGridApiDiagnosticsNamespace,
  DataGridApiDiagnosticsSnapshot,
  DataGridApiRowModelDiagnostics,
  DataGridApiLifecycleNamespace,
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
  DataGridApiErrorCode,
  DataGridApiErrorEvent,
  DataGridMigrateStateOptions,
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
  const lifecycleRuntime = createDataGridApiLifecycleRuntime({
    coreLifecycle: lifecycle,
  })

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
    getBackpressureControlCapability,
    getComputeCapability,
    getSortFilterBatchCapability,
    getColumnHistogramCapability,
  } = capabilityRuntime
  const cellRefreshRegistry = createDataGridCellRefreshRegistry(rowModel, columnModel)
  const eventsRuntime = createDataGridApiEventsRuntime<TRow>({
    rowModel,
    columnModel,
  })

  const resolveErrorCode = (
    operation: string,
    error: unknown,
  ): DataGridApiErrorCode => {
    if (error && typeof error === "object" && (error as { name?: string }).name === "AbortError") {
      return "aborted"
    }
    if (error instanceof Error) {
      if (error.message.includes("exclusive lifecycle operation")) {
        return "lifecycle-conflict"
      }
      if (error.message.toLowerCase().includes("capability")) {
        return "capability-error"
      }
    }
    if (operation === "state.set") {
      return "invalid-state-import"
    }
    if (operation === "compute.switchMode") {
      return "compute-switch-conflict"
    }
    if (operation.startsWith("transaction.")) {
      return "transaction-conflict"
    }
    if (operation.startsWith("rows.")) {
      return "mutation-conflict"
    }
    if (operation.startsWith("datasource.")) {
      return "data-source-protocol-error"
    }
    if (operation.startsWith("data.")) {
      return "data-source-protocol-error"
    }
    if (operation.startsWith("lifecycle.")) {
      return "lifecycle-conflict"
    }
    return "unknown-error"
  }

  const emitError = (operation: string, error: unknown, recoverable = true): void => {
    eventsRuntime.emitError({
      code: resolveErrorCode(operation, error),
      operation,
      recoverable,
      error,
    })
  }

  const runGuardedSync = <TResult>(
    operation: string,
    fn: () => TResult,
  ): TResult => {
    try {
      return lifecycleRuntime.runExclusiveSync(operation, fn)
    } catch (error) {
      emitError(operation, error)
      throw error
    }
  }

  const runGuardedAsync = <TResult>(
    operation: string,
    fn: () => TResult | Promise<TResult>,
  ): Promise<TResult> => {
    return lifecycleRuntime.runExclusiveAsync(operation, fn).catch((error) => {
      emitError(operation, error)
      throw error
    })
  }
  const rowsMethods = createDataGridApiRowsMethods<TRow>({
    rowModel,
    getPatchCapability,
    getRowsDataMutationCapability,
    getSortFilterBatchCapability,
    getProjectionMode: () => projectionMode,
  })
  const dataMethods = createDataGridApiDataMethods({
    getBackpressureControlCapability,
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
    getApiVersion: () => DATAGRID_PUBLIC_PACKAGE_VERSION,
    getProtocolVersion: () => DATAGRID_PUBLIC_PROTOCOL_VERSION,
  })
  const pluginsRuntime = createDataGridApiPluginsRuntime<TRow>({
    events: eventsRuntime.namespace,
    initialPlugins,
  })

  const methodSet: DataGridApiMethodSet<TRow> = {
    lifecycle: lifecycleRuntime.namespace,
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
    ...dataMethods,
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
    beginTransactionBatch: (label?: string) =>
      runGuardedSync("transaction.beginBatch", () => transactionMethods.beginTransactionBatch(label)),
    commitTransactionBatch: (batchId?: string) =>
      runGuardedAsync("transaction.commitBatch", () => transactionMethods.commitTransactionBatch(batchId)),
    rollbackTransactionBatch: (batchId?: string) =>
      runGuardedSync("transaction.rollbackBatch", () => transactionMethods.rollbackTransactionBatch(batchId)),
    applyTransaction: (transactionInput, options) =>
      runGuardedAsync("transaction.apply", () => transactionMethods.applyTransaction(transactionInput, options)),
    undoTransaction: () =>
      runGuardedAsync("transaction.undo", () => transactionMethods.undoTransaction()),
    redoTransaction: () =>
      runGuardedAsync("transaction.redo", () => transactionMethods.redoTransaction()),
    switchComputeMode: (mode) =>
      runGuardedSync("compute.switchMode", () => computeMethods.switchComputeMode(mode)),
    setUnifiedState: (state, setStateOptions) =>
      runGuardedSync("state.set", () => {
        eventsRuntime.emitStateImportBegin(state)
        try {
          stateMethods.setUnifiedState(state, setStateOptions)
        } finally {
          eventsRuntime.emitStateImportEnd(state)
        }
      }),
    batchRows: (fn) =>
      runGuardedSync("rows.batch", () =>
        eventsRuntime.runBatched(() => rowsMethods.batch(fn))),
    pauseBackpressure: () =>
      runGuardedSync("data.pause", () => dataMethods.pauseBackpressure()),
    resumeBackpressure: () =>
      runGuardedSync("data.resume", () => dataMethods.resumeBackpressure()),
    flushBackpressure: () =>
      runGuardedAsync("data.flush", () => dataMethods.flushBackpressure()),
    registerPlugin: pluginsRuntime.registerPlugin,
    unregisterPlugin: pluginsRuntime.unregisterPlugin,
    hasPlugin: pluginsRuntime.hasPlugin,
    listPlugins: pluginsRuntime.listPlugins,
    clearPlugins: pluginsRuntime.clearPlugins,
    onApiEvent: eventsRuntime.namespace.on,
  }
  return createDataGridApiFromMethodSet(methodSet)
}
