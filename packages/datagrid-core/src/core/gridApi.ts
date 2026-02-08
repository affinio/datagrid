import type {
  DataGridColumnDef,
  DataGridColumnModel,
  DataGridColumnModelSnapshot,
  DataGridColumnPin,
  DataGridColumnSnapshot,
  DataGridFilterSnapshot,
  DataGridRowModel,
  DataGridRowModelRefreshReason,
  DataGridRowModelSnapshot,
  DataGridRowNode,
  DataGridSortState,
  DataGridViewportRange,
} from "../models"
import type { DataGridSelectionSnapshot } from "../selection/snapshot"
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

export interface CreateDataGridApiOptions {
  core: DataGridCore
}

export interface DataGridApi {
  readonly lifecycle: DataGridCore["lifecycle"]
  init(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  dispose(): Promise<void>
  getRowModelSnapshot<TRow = unknown>(): DataGridRowModelSnapshot<TRow>
  getRowCount(): number
  getRow<TRow = unknown>(index: number): DataGridRowNode<TRow> | undefined
  getRowsInRange<TRow = unknown>(range: DataGridViewportRange): readonly DataGridRowNode<TRow>[]
  setViewportRange(range: DataGridViewportRange): void
  setSortModel(sortModel: readonly DataGridSortState[]): void
  setFilterModel(filterModel: DataGridFilterSnapshot | null): void
  refreshRows(reason?: DataGridRowModelRefreshReason): Promise<void> | void
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

function getSelectionService(core: DataGridCore): DataGridCoreSelectionService {
  return core.getService("selection")
}

function getTransactionService(core: DataGridCore): DataGridCoreTransactionService {
  return core.getService("transaction")
}

function getViewportService(core: DataGridCore): DataGridCoreViewportService {
  return core.getService("viewport")
}

function assertSelectionCapability(
  service: DataGridCoreSelectionService,
): Required<Pick<DataGridCoreSelectionService, "getSelectionSnapshot" | "setSelectionSnapshot" | "clearSelection">> {
  if (
    typeof service.getSelectionSnapshot !== "function" ||
    typeof service.setSelectionSnapshot !== "function" ||
    typeof service.clearSelection !== "function"
  ) {
    throw new Error('[DataGridApi] "selection" service is present but does not implement selection capabilities.')
  }

  return {
    getSelectionSnapshot: service.getSelectionSnapshot,
    setSelectionSnapshot: service.setSelectionSnapshot,
    clearSelection: service.clearSelection,
  }
}

function assertTransactionCapability(
  service: DataGridCoreTransactionService,
): Required<
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
> {
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
    throw new Error(
      '[DataGridApi] "transaction" service is present but does not implement transaction capabilities.',
    )
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

export function createDataGridApi(options: CreateDataGridApiOptions): DataGridApi {
  const core = options.core
  const rowModelService = assertRowModelService(core)
  const columnModelService = assertColumnModelService(core)
  const transactionService = getTransactionService(core)
  const selectionService = getSelectionService(core)
  const viewportService = getViewportService(core)

  const rowModel = rowModelService.model as DataGridRowModel<unknown>
  const columnModel = columnModelService.model as DataGridColumnModel

  const hasSelectionSupport = () =>
    typeof selectionService.getSelectionSnapshot === "function" &&
    typeof selectionService.setSelectionSnapshot === "function" &&
    typeof selectionService.clearSelection === "function"

  const hasTransactionSupport = () =>
    typeof transactionService.getTransactionSnapshot === "function" &&
    typeof transactionService.beginTransactionBatch === "function" &&
    typeof transactionService.commitTransactionBatch === "function" &&
    typeof transactionService.rollbackTransactionBatch === "function" &&
    typeof transactionService.applyTransaction === "function" &&
    typeof transactionService.canUndoTransaction === "function" &&
    typeof transactionService.canRedoTransaction === "function" &&
    typeof transactionService.undoTransaction === "function" &&
    typeof transactionService.redoTransaction === "function"

  return {
    lifecycle: core.lifecycle,
    init() {
      return core.init()
    },
    start() {
      return core.start()
    },
    stop() {
      return core.stop()
    },
    dispose() {
      return core.dispose()
    },
    getRowModelSnapshot<TRow = unknown>() {
      return rowModel.getSnapshot() as DataGridRowModelSnapshot<TRow>
    },
    getRowCount() {
      return rowModel.getRowCount()
    },
    getRow<TRow = unknown>(index: number) {
      return rowModel.getRow(index) as DataGridRowNode<TRow> | undefined
    },
    getRowsInRange<TRow = unknown>(range: DataGridViewportRange) {
      return rowModel.getRowsInRange(range) as readonly DataGridRowNode<TRow>[]
    },
    setViewportRange(range: DataGridViewportRange) {
      rowModel.setViewportRange(range)
      viewportService.setViewportRange?.(range)
    },
    setSortModel(sortModel: readonly DataGridSortState[]) {
      rowModel.setSortModel(sortModel)
    },
    setFilterModel(filterModel: DataGridFilterSnapshot | null) {
      rowModel.setFilterModel(filterModel)
    },
    refreshRows(reason?: DataGridRowModelRefreshReason) {
      return rowModel.refresh(reason)
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
      return hasTransactionSupport()
    },
    getTransactionSnapshot() {
      if (!hasTransactionSupport()) {
        return null
      }
      return transactionService.getTransactionSnapshot!()
    },
    beginTransactionBatch(label?: string) {
      const transaction = assertTransactionCapability(transactionService)
      return transaction.beginTransactionBatch(label)
    },
    commitTransactionBatch(batchId?: string) {
      const transaction = assertTransactionCapability(transactionService)
      return transaction.commitTransactionBatch(batchId)
    },
    rollbackTransactionBatch(batchId?: string) {
      const transaction = assertTransactionCapability(transactionService)
      return transaction.rollbackTransactionBatch(batchId)
    },
    applyTransaction(transactionInput: DataGridTransactionInput) {
      const transaction = assertTransactionCapability(transactionService)
      return transaction.applyTransaction(transactionInput)
    },
    canUndoTransaction() {
      if (!hasTransactionSupport()) {
        return false
      }
      return transactionService.canUndoTransaction!()
    },
    canRedoTransaction() {
      if (!hasTransactionSupport()) {
        return false
      }
      return transactionService.canRedoTransaction!()
    },
    undoTransaction() {
      const transaction = assertTransactionCapability(transactionService)
      return transaction.undoTransaction()
    },
    redoTransaction() {
      const transaction = assertTransactionCapability(transactionService)
      return transaction.redoTransaction()
    },
    hasSelectionSupport() {
      return hasSelectionSupport()
    },
    getSelectionSnapshot() {
      if (!hasSelectionSupport()) {
        return null
      }
      return selectionService.getSelectionSnapshot!()
    },
    setSelectionSnapshot(snapshot: DataGridSelectionSnapshot) {
      const selection = assertSelectionCapability(selectionService)
      selection.setSelectionSnapshot(snapshot)
    },
    clearSelection() {
      const selection = assertSelectionCapability(selectionService)
      selection.clearSelection()
    },
  }
}
