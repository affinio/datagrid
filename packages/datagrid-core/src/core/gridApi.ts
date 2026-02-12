import type {
  DataGridColumnDef,
  DataGridColumnModel,
  DataGridColumnModelSnapshot,
  DataGridColumnPin,
  DataGridColumnSnapshot,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridPaginationSnapshot,
  DataGridRowModel,
  DataGridRowModelSnapshot,
  DataGridRowNode,
  DataGridSortState,
  DataGridViewportRange,
} from "../models"
import type { DataGridSelectionSnapshot } from "../selection/snapshot"
import {
  createDataGridSelectionSummary,
  type DataGridSelectionAggregationKind,
  type DataGridSelectionSummaryColumnConfig,
  type DataGridSelectionSummaryScope,
  type DataGridSelectionSummarySnapshot,
} from "../selection/selectionSummary"
import type {
  DataGridTransactionInput,
  DataGridTransactionSnapshot,
} from "./transactionService"
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

export interface DataGridRefreshOptions {
  reset?: boolean
}

export interface DataGridApi<TRow = unknown> {
  readonly lifecycle: DataGridCore["lifecycle"]
  init(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  dispose(): Promise<void>
  getRowModelSnapshot(): DataGridRowModelSnapshot<TRow>
  getRowCount(): number
  getRow(index: number): DataGridRowNode<TRow> | undefined
  getRowsInRange(range: DataGridViewportRange): readonly DataGridRowNode<TRow>[]
  setViewportRange(range: DataGridViewportRange): void
  getPaginationSnapshot(): DataGridPaginationSnapshot
  setPagination(pagination: DataGridPaginationInput | null): void
  setPageSize(pageSize: number | null): void
  setCurrentPage(page: number): void
  setSortModel(sortModel: readonly DataGridSortState[]): void
  setFilterModel(filterModel: DataGridFilterSnapshot | null): void
  setGroupBy(groupBy: DataGridGroupBySpec | null): void
  setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null): void
  toggleGroup(groupKey: string): void
  expandGroup(groupKey: string): void
  collapseGroup(groupKey: string): void
  expandAllGroups(): void
  collapseAllGroups(): void
  refresh(options?: DataGridRefreshOptions): Promise<void> | void
  getColumnModelSnapshot(): DataGridColumnModelSnapshot
  getColumn(key: string): DataGridColumnSnapshot | undefined
  setColumns(columns: DataGridColumnDef[]): void
  setColumnOrder(keys: readonly string[]): void
  setColumnVisibility(key: string, visible: boolean): void
  setColumnWidth(key: string, width: number | null): void
  setColumnPin(key: string, pin: DataGridColumnPin): void
  hasTransactionSupport(): boolean
  getTransactionSnapshot(): DataGridTransactionSnapshot | null
  beginTransactionBatch(label?: string): string
  commitTransactionBatch(batchId?: string): Promise<readonly string[]>
  rollbackTransactionBatch(batchId?: string): readonly string[]
  applyTransaction(transaction: DataGridTransactionInput): Promise<string>
  canUndoTransaction(): boolean
  canRedoTransaction(): boolean
  undoTransaction(): Promise<string | null>
  redoTransaction(): Promise<string | null>
  hasSelectionSupport(): boolean
  getSelectionSnapshot(): DataGridSelectionSnapshot | null
  setSelectionSnapshot(snapshot: DataGridSelectionSnapshot): void
  clearSelection(): void
  summarizeSelection(options?: DataGridSelectionSummaryApiOptions<TRow>): DataGridSelectionSummarySnapshot | null
}

export interface DataGridSelectionSummaryApiOptions<TRow = unknown> {
  /**
   * "selected-loaded" summarizes all selected cells that are currently materialized by the row model.
   * "selected-visible" limits summary to selected cells that intersect current viewportRange.
   */
  scope?: DataGridSelectionSummaryScope
  columns?: readonly DataGridSelectionSummaryColumnConfig<TRow>[]
  defaultAggregations?: readonly DataGridSelectionAggregationKind[]
  getColumnKeyByIndex?: (columnIndex: number) => string | null | undefined
}

interface ResolvedDataGridApiDependencies<TRow = unknown> {
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

type DataGridSelectionCapability = Required<
  Pick<DataGridCoreSelectionService, "getSelectionSnapshot" | "setSelectionSnapshot" | "clearSelection">
>

type DataGridTransactionCapability = Required<
  Pick<
    DataGridCoreTransactionService,
    | "getTransactionSnapshot"
    | "beginTransactionBatch"
    | "commitTransactionBatch"
    | "rollbackTransactionBatch"
    | "applyTransaction"
    | "canUndoTransaction"
    | "canRedoTransaction"
    | "undoTransaction"
    | "redoTransaction"
  >
>

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

function resolveApiDependencies<TRow = unknown>(
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

function resolveSelectionCapability(
  service: DataGridCoreSelectionService | null,
): DataGridSelectionCapability | null {
  if (!service) {
    return null
  }
  if (
    typeof service.getSelectionSnapshot !== "function" ||
    typeof service.setSelectionSnapshot !== "function" ||
    typeof service.clearSelection !== "function"
  ) {
    return null
  }
  return {
    getSelectionSnapshot: service.getSelectionSnapshot,
    setSelectionSnapshot: service.setSelectionSnapshot,
    clearSelection: service.clearSelection,
  }
}

function resolveTransactionCapability(
  service: DataGridCoreTransactionService | null,
): DataGridTransactionCapability | null {
  if (!service) {
    return null
  }
  if (
    typeof service.getTransactionSnapshot !== "function" ||
    typeof service.beginTransactionBatch !== "function" ||
    typeof service.commitTransactionBatch !== "function" ||
    typeof service.rollbackTransactionBatch !== "function" ||
    typeof service.applyTransaction !== "function" ||
    typeof service.canUndoTransaction !== "function" ||
    typeof service.canRedoTransaction !== "function" ||
    typeof service.undoTransaction !== "function" ||
    typeof service.redoTransaction !== "function"
  ) {
    return null
  }

  return {
    getTransactionSnapshot: service.getTransactionSnapshot,
    beginTransactionBatch: service.beginTransactionBatch,
    commitTransactionBatch: service.commitTransactionBatch,
    rollbackTransactionBatch: service.rollbackTransactionBatch,
    applyTransaction: service.applyTransaction,
    canUndoTransaction: service.canUndoTransaction,
    canRedoTransaction: service.canRedoTransaction,
    undoTransaction: service.undoTransaction,
    redoTransaction: service.redoTransaction,
  }
}

function assertSelectionCapability(
  capability: DataGridSelectionCapability | null,
): DataGridSelectionCapability {
  if (!capability) {
    throw new Error('[DataGridApi] "selection" service is present but does not implement selection capabilities.')
  }
  return capability
}

function assertTransactionCapability(
  capability: DataGridTransactionCapability | null,
): DataGridTransactionCapability {
  if (!capability) {
    throw new Error(
      '[DataGridApi] "transaction" service is present but does not implement transaction capabilities.',
    )
  }
  return capability
}

export function createDataGridApi<TRow = unknown>(
  options: CreateDataGridApiOptions<TRow>,
): DataGridApi<TRow> {
  const deps = resolveApiDependencies(options)
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

  const resolveCurrentSelectionCapability = () => resolveSelectionCapability(getSelectionService())
  const resolveCurrentTransactionCapability = () => resolveTransactionCapability(getTransactionService())

  return {
    lifecycle,
    init,
    start,
    stop,
    dispose,
    getRowModelSnapshot() {
      return rowModel.getSnapshot()
    },
    getRowCount() {
      return rowModel.getRowCount()
    },
    getRow(index: number) {
      return rowModel.getRow(index)
    },
    getRowsInRange(range: DataGridViewportRange) {
      return rowModel.getRowsInRange(range)
    },
    setViewportRange(range: DataGridViewportRange) {
      rowModel.setViewportRange(range)
      getViewportService()?.setViewportRange?.(range)
    },
    getPaginationSnapshot() {
      return rowModel.getSnapshot().pagination
    },
    setPagination(pagination: DataGridPaginationInput | null) {
      rowModel.setPagination(pagination)
    },
    setPageSize(pageSize: number | null) {
      rowModel.setPageSize(pageSize)
    },
    setCurrentPage(page: number) {
      rowModel.setCurrentPage(page)
    },
    setSortModel(sortModel: readonly DataGridSortState[]) {
      rowModel.setSortModel(sortModel)
    },
    setFilterModel(filterModel: DataGridFilterSnapshot | null) {
      rowModel.setFilterModel(filterModel)
    },
    setGroupBy(groupBy: DataGridGroupBySpec | null) {
      rowModel.setGroupBy(groupBy)
    },
    setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null) {
      rowModel.setGroupExpansion(expansion)
    },
    toggleGroup(groupKey: string) {
      rowModel.toggleGroup(groupKey)
    },
    expandGroup(groupKey: string) {
      rowModel.expandGroup(groupKey)
    },
    collapseGroup(groupKey: string) {
      rowModel.collapseGroup(groupKey)
    },
    expandAllGroups() {
      rowModel.expandAllGroups()
    },
    collapseAllGroups() {
      rowModel.collapseAllGroups()
    },
    refresh(options?: DataGridRefreshOptions) {
      return rowModel.refresh(options?.reset ? "reset" : undefined)
    },
    getColumnModelSnapshot() {
      return columnModel.getSnapshot()
    },
    getColumn(key: string) {
      return columnModel.getColumn(key)
    },
    setColumns(columns) {
      columnModel.setColumns(columns)
    },
    setColumnOrder(keys: readonly string[]) {
      columnModel.setColumnOrder(keys)
    },
    setColumnVisibility(key: string, visible: boolean) {
      columnModel.setColumnVisibility(key, visible)
    },
    setColumnWidth(key: string, width: number | null) {
      columnModel.setColumnWidth(key, width)
    },
    setColumnPin(key: string, pin: DataGridColumnPin) {
      columnModel.setColumnPin(key, pin)
    },
    hasTransactionSupport() {
      return resolveCurrentTransactionCapability() != null
    },
    getTransactionSnapshot() {
      const transactionCapability = resolveCurrentTransactionCapability()
      if (!transactionCapability) {
        return null
      }
      return transactionCapability.getTransactionSnapshot()
    },
    beginTransactionBatch(label?: string) {
      const transaction = assertTransactionCapability(resolveCurrentTransactionCapability())
      return transaction.beginTransactionBatch(label)
    },
    commitTransactionBatch(batchId?: string) {
      const transaction = assertTransactionCapability(resolveCurrentTransactionCapability())
      return transaction.commitTransactionBatch(batchId)
    },
    rollbackTransactionBatch(batchId?: string) {
      const transaction = assertTransactionCapability(resolveCurrentTransactionCapability())
      return transaction.rollbackTransactionBatch(batchId)
    },
    applyTransaction(transactionInput: DataGridTransactionInput) {
      const transaction = assertTransactionCapability(resolveCurrentTransactionCapability())
      return transaction.applyTransaction(transactionInput)
    },
    canUndoTransaction() {
      const transactionCapability = resolveCurrentTransactionCapability()
      if (!transactionCapability) {
        return false
      }
      return transactionCapability.canUndoTransaction()
    },
    canRedoTransaction() {
      const transactionCapability = resolveCurrentTransactionCapability()
      if (!transactionCapability) {
        return false
      }
      return transactionCapability.canRedoTransaction()
    },
    undoTransaction() {
      const transaction = assertTransactionCapability(resolveCurrentTransactionCapability())
      return transaction.undoTransaction()
    },
    redoTransaction() {
      const transaction = assertTransactionCapability(resolveCurrentTransactionCapability())
      return transaction.redoTransaction()
    },
    hasSelectionSupport() {
      return resolveCurrentSelectionCapability() != null
    },
    getSelectionSnapshot() {
      const selectionCapability = resolveCurrentSelectionCapability()
      if (!selectionCapability) {
        return null
      }
      return selectionCapability.getSelectionSnapshot()
    },
    setSelectionSnapshot(snapshot: DataGridSelectionSnapshot) {
      const selection = assertSelectionCapability(resolveCurrentSelectionCapability())
      selection.setSelectionSnapshot(snapshot)
    },
    clearSelection() {
      const selection = assertSelectionCapability(resolveCurrentSelectionCapability())
      selection.clearSelection()
    },
    summarizeSelection(options: DataGridSelectionSummaryApiOptions<TRow> = {}) {
      const selectionCapability = resolveCurrentSelectionCapability()
      if (!selectionCapability) {
        return null
      }
      const selectionSnapshot = selectionCapability.getSelectionSnapshot()
      if (!selectionSnapshot) {
        return null
      }

      const columnSnapshot = columnModel.getSnapshot()
      const visibleColumns = columnSnapshot.visibleColumns
      const getColumnKeyByIndex = options.getColumnKeyByIndex ?? ((columnIndex: number) => {
        return visibleColumns[columnIndex]?.key ?? null
      })
      const scope = options.scope ?? "selected-loaded"
      const viewportRange = rowModel.getSnapshot().viewportRange
      const includeRowIndex = scope === "selected-visible"
        ? (rowIndex: number) => rowIndex >= viewportRange.start && rowIndex <= viewportRange.end
        : undefined

      return createDataGridSelectionSummary<TRow>({
        selection: selectionSnapshot,
        scope,
        rowCount: rowModel.getRowCount(),
        includeRowIndex,
        getRow: rowIndex => rowModel.getRow(rowIndex),
        getColumnKeyByIndex,
        columns: options.columns,
        defaultAggregations: options.defaultAggregations,
      })
    },
  }
}
