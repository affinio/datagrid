import type {
  DataGridColumnModel,
  DataGridRowModel,
} from "../models"
import type {
  DataGridCore,
  DataGridCoreColumnModelService,
  DataGridCoreRowModelService,
  DataGridCoreSelectionService,
  DataGridCoreTransactionService,
  DataGridCoreViewportService,
} from "./gridCore"

export interface CreateDataGridApiFromCoreOptions {
  core: DataGridCore
}

export interface CreateDataGridApiFromDepsOptions<TRow = unknown> {
  lifecycle: DataGridCore["lifecycle"]
  init(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  dispose(): Promise<void>
  rowModel: DataGridRowModel<TRow>
  columnModel: DataGridColumnModel
  viewportService?: DataGridCoreViewportService | null
  transactionService?: DataGridCoreTransactionService | null
  selectionService?: DataGridCoreSelectionService | null
}

/** @deprecated Use CreateDataGridApiFromDepsOptions instead. */
export type CreateDataGridApiDependencies<TRow = unknown> = CreateDataGridApiFromDepsOptions<TRow>

export type CreateDataGridApiOptions<TRow = unknown> =
  | CreateDataGridApiFromCoreOptions
  | CreateDataGridApiFromDepsOptions<TRow>

export interface ResolvedDataGridApiDependencies<TRow = unknown> {
  lifecycle: DataGridCore["lifecycle"]
  init(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  dispose(): Promise<void>
  rowModel: DataGridRowModel<TRow>
  columnModel: DataGridColumnModel
  getViewportService(): DataGridCoreViewportService | null
  getTransactionService(): DataGridCoreTransactionService | null
  getSelectionService(): DataGridCoreSelectionService | null
}

function assertRowModelService(core: DataGridCore): DataGridCoreRowModelService {
  const service = core.getService("rowModel")
  if (!service.model) {
    throw new Error('[DataGridApi] "rowModel" service must expose model: DataGridRowModel.')
  }
  return service
}

function assertColumnModelService(core: DataGridCore): DataGridCoreColumnModelService {
  const service = core.getService("columnModel")
  if (!service.model) {
    throw new Error('[DataGridApi] "columnModel" service must expose model: DataGridColumnModel.')
  }
  return service
}

function isCoreApiOptions<TRow>(
  options: CreateDataGridApiOptions<TRow>,
): options is CreateDataGridApiFromCoreOptions {
  return "core" in options
}

export function resolveDataGridApiDependencies<TRow = unknown>(
  options: CreateDataGridApiOptions<TRow>,
): ResolvedDataGridApiDependencies<TRow> {
  if (isCoreApiOptions(options)) {
    const core = options.core
    const rowModelService = assertRowModelService(core)
    const columnModelService = assertColumnModelService(core)
    const rowModel = rowModelService.model as DataGridRowModel<TRow>
    const columnModel = columnModelService.model as DataGridColumnModel
    return {
      lifecycle: core.lifecycle,
      init: () => core.init(),
      start: () => core.start(),
      stop: () => core.stop(),
      dispose: () => core.dispose(),
      rowModel,
      columnModel,
      getViewportService: () => core.getService("viewport"),
      getTransactionService: () => core.getService("transaction"),
      getSelectionService: () => core.getService("selection"),
    }
  }

  return {
    lifecycle: options.lifecycle,
    init: options.init,
    start: options.start,
    stop: options.stop,
    dispose: options.dispose,
    rowModel: options.rowModel,
    columnModel: options.columnModel,
    getViewportService: () => options.viewportService ?? null,
    getTransactionService: () => options.transactionService ?? null,
    getSelectionService: () => options.selectionService ?? null,
  }
}
