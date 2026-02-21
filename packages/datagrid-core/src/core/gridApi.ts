import type {
  DataGridColumnDef,
  DataGridColumnModel,
  DataGridColumnModelSnapshot,
  DataGridColumnPin,
  DataGridColumnSnapshot,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridFilterSnapshot,
  DataGridSortAndFilterModelInput,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridAggregationModel,
  DataGridPaginationInput,
  DataGridPaginationSnapshot,
  DataGridRowId,
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

export interface DataGridCellRefreshOptions {
  immediate?: boolean
  reason?: string
}

export interface DataGridApplyEditsOptions {
  emit?: boolean
  reapply?: boolean
}

export interface DataGridCellRefreshRange {
  rowKey: DataGridRowId
  columnKeys: readonly string[]
}

export interface DataGridCellRefreshEntry {
  rowKey: DataGridRowId
  rowIndex: number
  columnKey: string
  columnIndex: number
  pin: DataGridColumnPin
}

export interface DataGridCellsRefreshBatch {
  timestamp: number
  reason?: string
  cells: readonly DataGridCellRefreshEntry[]
}

export type DataGridCellsRefreshListener = (batch: DataGridCellsRefreshBatch) => void

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
  setSortAndFilterModel(input: DataGridSortAndFilterModelInput): void
  setGroupBy(groupBy: DataGridGroupBySpec | null): void
  setAggregationModel(aggregationModel: DataGridAggregationModel<TRow> | null): void
  getAggregationModel(): DataGridAggregationModel<TRow> | null
  setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null): void
  toggleGroup(groupKey: string): void
  expandGroup(groupKey: string): void
  collapseGroup(groupKey: string): void
  expandAllGroups(): void
  collapseAllGroups(): void
  refresh(options?: DataGridRefreshOptions): Promise<void> | void
  reapplyView(): Promise<void> | void
  hasPatchSupport(): boolean
  patchRows(
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ): void
  applyEdits(
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridApplyEditsOptions,
  ): void
  setAutoReapply(value: boolean): void
  getAutoReapply(): boolean
  refreshCellsByRowKeys(
    rowKeys: readonly DataGridRowId[],
    columnKeys: readonly string[],
    options?: DataGridCellRefreshOptions,
  ): void
  refreshCellsByRanges(
    ranges: readonly DataGridCellRefreshRange[],
    options?: DataGridCellRefreshOptions,
  ): void
  onCellsRefresh(listener: DataGridCellsRefreshListener): () => void
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

interface DataGridDeferredHandle {
  id: number
}

type DataGridDeferredScheduler = (callback: () => void) => DataGridDeferredHandle
type DataGridDeferredCanceler = (handle: DataGridDeferredHandle) => void

interface PendingRefreshRow {
  rowKey: DataGridRowId
  columnKeys: Set<string>
}

function normalizeRowRefreshKey(rowKey: DataGridRowId): string {
  if (typeof rowKey === "number") {
    return `n:${rowKey}`
  }
  return `s:${rowKey}`
}

function normalizeRefreshColumnKey(columnKey: string): string | null {
  if (typeof columnKey !== "string") {
    return null
  }
  const normalized = columnKey.trim()
  return normalized.length > 0 ? normalized : null
}

function createDeferredScheduler(): {
  schedule: DataGridDeferredScheduler
  cancel: DataGridDeferredCanceler
} {
  let nextHandleId = 1
  const cancelledHandles = new Set<number>()

  return {
    schedule(callback) {
      const handle: DataGridDeferredHandle = { id: nextHandleId }
      nextHandleId += 1
      Promise.resolve().then(() => {
        if (cancelledHandles.has(handle.id)) {
          cancelledHandles.delete(handle.id)
          return
        }
        callback()
      })
      return handle
    },
    cancel(handle) {
      cancelledHandles.add(handle.id)
    },
  }
}

class DataGridCellRefreshRegistry {
  private readonly listeners = new Set<DataGridCellsRefreshListener>()
  private readonly pendingRowsByKey = new Map<string, PendingRefreshRow>()
  private scheduledHandle: DataGridDeferredHandle | null = null
  private pendingReason: string | undefined
  private nextBatchSequence = 1

  constructor(
    private readonly resolveVisibleEntries: (
      pendingRows: readonly PendingRefreshRow[],
    ) => readonly DataGridCellRefreshEntry[],
    private readonly scheduleFrame: DataGridDeferredScheduler,
    private readonly cancelFrame: DataGridDeferredCanceler,
  ) {}

  queueByRowKeys(
    rowKeys: readonly DataGridRowId[],
    columnKeys: readonly string[],
    options?: DataGridCellRefreshOptions,
  ): void {
    this.queueByRanges(
      rowKeys.map(rowKey => ({ rowKey, columnKeys })),
      options,
    )
  }

  queueByRanges(
    ranges: readonly DataGridCellRefreshRange[],
    options?: DataGridCellRefreshOptions,
  ): void {
    for (const range of ranges) {
      const normalizedRowKey = normalizeRowRefreshKey(range.rowKey)
      const pendingRow = this.pendingRowsByKey.get(normalizedRowKey) ?? {
        rowKey: range.rowKey,
        columnKeys: new Set<string>(),
      }

      for (const rawColumnKey of range.columnKeys) {
        const columnKey = normalizeRefreshColumnKey(rawColumnKey)
        if (!columnKey) {
          continue
        }
        pendingRow.columnKeys.add(columnKey)
      }

      if (pendingRow.columnKeys.size > 0) {
        this.pendingRowsByKey.set(normalizedRowKey, pendingRow)
      }
    }

    if (typeof options?.reason === "string" && options.reason.trim().length > 0) {
      this.pendingReason = options.reason
    }

    if (options?.immediate) {
      this.flush()
      return
    }

    this.schedule()
  }

  subscribe(listener: DataGridCellsRefreshListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose(): void {
    if (this.scheduledHandle != null) {
      this.cancelFrame(this.scheduledHandle)
      this.scheduledHandle = null
    }
    this.pendingRowsByKey.clear()
    this.listeners.clear()
    this.pendingReason = undefined
  }

  private schedule(): void {
    if (this.scheduledHandle != null || this.pendingRowsByKey.size === 0) {
      return
    }
    this.scheduledHandle = this.scheduleFrame(() => {
      this.scheduledHandle = null
      this.flush()
    })
  }

  private flush(): void {
    if (this.pendingRowsByKey.size === 0) {
      return
    }

    const timestamp = this.nextBatchSequence
    this.nextBatchSequence += 1

    const pendingRows = Array.from(this.pendingRowsByKey.values())
    this.pendingRowsByKey.clear()

    const cells = this.resolveVisibleEntries(pendingRows)
    const reason = this.pendingReason
    this.pendingReason = undefined

    if (cells.length === 0 || this.listeners.size === 0) {
      return
    }

    const batch: DataGridCellsRefreshBatch = {
      timestamp,
      reason,
      cells,
    }

    for (const listener of this.listeners) {
      listener(batch)
    }
  }
}

type DataGridSelectionCapability = Required<
  Pick<DataGridCoreSelectionService, "getSelectionSnapshot" | "setSelectionSnapshot" | "clearSelection">
>

type DataGridPatchCapability<TRow = unknown> = {
  patchRows: (
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ) => void
}

type DataGridSortFilterBatchCapability = {
  setSortAndFilterModel: (input: DataGridSortAndFilterModelInput) => void
}

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

function resolvePatchCapability<TRow>(
  rowModel: DataGridRowModel<TRow>,
): DataGridPatchCapability<TRow> | null {
  const candidate = rowModel as DataGridRowModel<TRow> & Partial<DataGridPatchCapability<TRow>>
  if (typeof candidate.patchRows !== "function") {
    return null
  }
  return {
    patchRows: candidate.patchRows.bind(rowModel),
  }
}

function resolveSortFilterBatchCapability<TRow>(
  rowModel: DataGridRowModel<TRow>,
): DataGridSortFilterBatchCapability | null {
  const candidate = rowModel as DataGridRowModel<TRow> & Partial<DataGridSortFilterBatchCapability>
  if (typeof candidate.setSortAndFilterModel !== "function") {
    return null
  }
  return {
    setSortAndFilterModel: candidate.setSortAndFilterModel.bind(rowModel),
  }
}

function assertPatchCapability<TRow>(
  capability: DataGridPatchCapability<TRow> | null,
): DataGridPatchCapability<TRow> {
  if (!capability) {
    throw new Error('[DataGridApi] rowModel does not implement patchRows capability.')
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
  const resolveCurrentPatchCapability = () => resolvePatchCapability(rowModel)
  const resolveCurrentSortFilterBatchCapability = () => resolveSortFilterBatchCapability(rowModel)
  const deferredScheduler = createDeferredScheduler()
  let autoReapply = false

  const resolveVisibleCellRefreshEntries = (
    pendingRows: readonly PendingRefreshRow[],
  ): readonly DataGridCellRefreshEntry[] => {
    if (pendingRows.length === 0) {
      return []
    }

    const rowSnapshot = rowModel.getSnapshot()
    const viewportRows = rowModel.getRowsInRange(rowSnapshot.viewportRange)
    if (viewportRows.length === 0) {
      return []
    }

    const visibleRowIndexByKey = new Map<string, number>()
    for (const row of viewportRows) {
      visibleRowIndexByKey.set(normalizeRowRefreshKey(row.rowId), row.displayIndex)
    }

    const columnSnapshot = columnModel.getSnapshot()
    const visibleColumnMetaByKey = new Map<string, { columnIndex: number; pin: DataGridColumnPin }>()
    for (let index = 0; index < columnSnapshot.visibleColumns.length; index += 1) {
      const column = columnSnapshot.visibleColumns[index]
      if (!column) {
        continue
      }
      visibleColumnMetaByKey.set(column.key, {
        columnIndex: index,
        pin: column.pin,
      })
    }

    const dedupe = new Set<string>()
    const cells: DataGridCellRefreshEntry[] = []
    for (const pendingRow of pendingRows) {
      const rowIndex = visibleRowIndexByKey.get(normalizeRowRefreshKey(pendingRow.rowKey))
      if (typeof rowIndex !== "number") {
        continue
      }

      for (const columnKey of pendingRow.columnKeys) {
        const columnMeta = visibleColumnMetaByKey.get(columnKey)
        if (!columnMeta) {
          continue
        }

        const dedupeKey = `${normalizeRowRefreshKey(pendingRow.rowKey)}|${columnKey}`
        if (dedupe.has(dedupeKey)) {
          continue
        }
        dedupe.add(dedupeKey)

        cells.push({
          rowKey: pendingRow.rowKey,
          rowIndex,
          columnKey,
          columnIndex: columnMeta.columnIndex,
          pin: columnMeta.pin,
        })
      }
    }

    cells.sort((left, right) => {
      if (left.rowIndex !== right.rowIndex) {
        return left.rowIndex - right.rowIndex
      }
      return left.columnIndex - right.columnIndex
    })

    return cells
  }

  const cellRefreshRegistry = new DataGridCellRefreshRegistry(
    resolveVisibleCellRefreshEntries,
    deferredScheduler.schedule,
    deferredScheduler.cancel,
  )

  return {
    lifecycle,
    init,
    start,
    stop,
    dispose() {
      cellRefreshRegistry.dispose()
      return dispose()
    },
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
    setSortAndFilterModel(input: DataGridSortAndFilterModelInput) {
      const capability = resolveCurrentSortFilterBatchCapability()
      if (capability) {
        capability.setSortAndFilterModel(input)
        return
      }
      rowModel.setFilterModel(input.filterModel)
      rowModel.setSortModel(input.sortModel)
    },
    setGroupBy(groupBy: DataGridGroupBySpec | null) {
      rowModel.setGroupBy(groupBy)
    },
    setAggregationModel(aggregationModel: DataGridAggregationModel<TRow> | null) {
      rowModel.setAggregationModel(aggregationModel)
    },
    getAggregationModel() {
      return rowModel.getAggregationModel()
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
    reapplyView() {
      return rowModel.refresh("reapply")
    },
    hasPatchSupport() {
      return resolveCurrentPatchCapability() !== null
    },
    patchRows(
      updates: readonly DataGridClientRowPatch<TRow>[],
      options?: DataGridClientRowPatchOptions,
    ) {
      const capability = assertPatchCapability(resolveCurrentPatchCapability())
      capability.patchRows(updates, options)
    },
    applyEdits(
      updates: readonly DataGridClientRowPatch<TRow>[],
      options?: DataGridApplyEditsOptions,
    ) {
      const capability = assertPatchCapability(resolveCurrentPatchCapability())
      const shouldReapply = typeof options?.reapply === "boolean"
        ? options.reapply
        : autoReapply
      capability.patchRows(updates, {
        recomputeSort: shouldReapply,
        recomputeFilter: shouldReapply,
        recomputeGroup: shouldReapply,
        emit: options?.emit,
      })
    },
    setAutoReapply(value: boolean) {
      autoReapply = Boolean(value)
    },
    getAutoReapply() {
      return autoReapply
    },
    refreshCellsByRowKeys(
      rowKeys: readonly DataGridRowId[],
      columnKeys: readonly string[],
      options?: DataGridCellRefreshOptions,
    ) {
      cellRefreshRegistry.queueByRowKeys(rowKeys, columnKeys, options)
    },
    refreshCellsByRanges(
      ranges: readonly DataGridCellRefreshRange[],
      options?: DataGridCellRefreshOptions,
    ) {
      cellRefreshRegistry.queueByRanges(ranges, options)
    },
    onCellsRefresh(listener: DataGridCellsRefreshListener) {
      return cellRefreshRegistry.subscribe(listener)
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
