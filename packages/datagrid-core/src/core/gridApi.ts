import {
  createDataGridCellRefreshRegistry,
} from "./gridApiCellRefresh"
import { createDataGridApiColumnsMethods } from "./gridApiColumnsMethods"
import {
  createDataGridApiCapabilityRuntime,
} from "./gridApiCapabilitiesRuntime"
import type { DataGridApi } from "./gridApiContracts"
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
  DataGridApiCapabilities,
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
  } = deps

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
    getSortFilterBatchCapability,
    getColumnHistogramCapability,
  } = capabilityRuntime
  const cellRefreshRegistry = createDataGridCellRefreshRegistry(rowModel, columnModel)
  const rowsMethods = createDataGridApiRowsMethods<TRow>({
    rowModel,
    getPatchCapability,
    getSortFilterBatchCapability,
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
  const transactionMethods = createDataGridApiTransactionMethods({
    getTransactionCapability,
  })
  const selectionMethods = createDataGridApiSelectionMethods<TRow>({
    getSelectionCapability,
    summarize: (selectionSnapshot, options) =>
      buildDataGridSelectionSummary<TRow>({
        selectionSnapshot,
        rowModel,
        columnModel,
        options,
      }),
  })

  const methodSet: DataGridApiMethodSet<TRow> = {
    lifecycle,
    capabilities,
    init,
    start,
    stop,
    dispose() {
      cellRefreshRegistry.dispose()
      return dispose()
    },
    ...rowsMethods,
    ...viewMethods,
    ...pivotMethods,
    ...columnsMethods,
    ...transactionMethods,
    ...selectionMethods,
  }
  return createDataGridApiFromMethodSet(methodSet)
}
