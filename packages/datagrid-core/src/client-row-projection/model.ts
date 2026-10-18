import type {
  DataGridRowId,
  DataGridRowNode,
  DataGridRowNodeInput,
  DataGridPaginationInput,
  DataGridPaginationSnapshot,
  DataGridSortState,
} from "../public.js"
import { createClientRowStore, type ClientRowStore, type CreateClientRowStoreOptions } from "../client-row-store.js"
import { createDataGridSortValueCachePolicy } from "./sort-cache.js"
import { readRowField } from "../models/projection/clientRowProjectionPrimitives.js"
import type { DataGridClientPerformanceMode } from "../public.js"
import type { DataGridComparatorRegistry } from "../models/comparator/comparatorRegistry.js"
import { runFilterProjectionStage } from "./filter.js"
import { runFlatSortProjectionStage, type SortValueCacheEntry } from "./sort.js"
import { runFlatVisibleProjectionStage } from "./visible.js"
import { runPaginateProjectionStage } from "./pagination.js"

export interface ClientRowProjectionModelSnapshot<T> {
  readonly revision: number
  readonly sourceRows: readonly DataGridRowNode<T>[]
  readonly rows: readonly DataGridRowNode<T>[]
  readonly sortModel: readonly DataGridSortState[]
  readonly pagination: DataGridPaginationSnapshot
}

export interface CreateClientRowProjectionModelOptions<T> extends CreateClientRowStoreOptions<T> {
  initialSortModel?: readonly DataGridSortState[]
  initialPagination?: DataGridPaginationInput | null
  filterPredicate?: ((row: DataGridRowNode<T>) => boolean) | null
  readRowField?: (row: DataGridRowNode<T>, key: string, field?: string) => unknown
  comparatorRegistry?: DataGridComparatorRegistry<T> | null
  performanceMode?: DataGridClientPerformanceMode
}

export interface ClientRowProjectionModel<T> {
  getSnapshot(): ClientRowProjectionModelSnapshot<T>
  getSourceRows(): readonly DataGridRowNode<T>[]
  getRows(): readonly DataGridRowNode<T>[]
  getRowCount(): number
  getRow(index: number): DataGridRowNode<T> | undefined
  getRowById(rowId: DataGridRowId): DataGridRowNode<T> | undefined
  setRows(rows: readonly DataGridRowNodeInput<T>[]): void
  appendRows(rows: readonly DataGridRowNodeInput<T>[]): void
  removeRows(rowIds: readonly DataGridRowId[]): boolean
  refresh(): void
  setFilterPredicate(predicate: ((row: DataGridRowNode<T>) => boolean) | null): void
  setSortModel(sortModel: readonly DataGridSortState[]): void
  setPagination(pagination: DataGridPaginationInput | null): void
  subscribe(listener: (snapshot: ClientRowProjectionModelSnapshot<T>) => void): () => void
  dispose(): void
}

/**
 * Compose the formula-free row store with filter, sort, pagination, and
 * display-index stages. Grouping, pivot, aggregation, and formula execution are
 * intentionally outside this flat projection model.
 */
export function createClientRowProjectionModel<T>(
  options: CreateClientRowProjectionModelOptions<T> = {},
): ClientRowProjectionModel<T> {
  const store: ClientRowStore<T> = createClientRowStore(options)
  const comparatorRegistry = options.comparatorRegistry ?? undefined
  const projectionPolicy = createDataGridSortValueCachePolicy(options.performanceMode)
  const listeners = new Set<(snapshot: ClientRowProjectionModelSnapshot<T>) => void>()
  const sortValueCache = new Map<DataGridRowId, SortValueCacheEntry>()
  const counters = { hits: 0, misses: 0 }
  let sourceRows = store.getRows()
  let rows: readonly DataGridRowNode<T>[] = sourceRows
  let sortModel = [...(options.initialSortModel ?? [])]
  let paginationInput = normalizePaginationInput(options.initialPagination)
  let pagination = emptyPaginationSnapshot()
  let filterPredicate = options.filterPredicate ?? null
  let revision = 0
  let disposed = false
  let sortValueCacheKey = "__none__"
  let sortProjectionKey = "__none__"
  let sortInputRowsReference: readonly DataGridRowNode<T>[] | null = null

  const ensureActive = (): void => {
    if (disposed) throw new Error("ClientRowProjectionModel has been disposed")
  }
  const snapshot = (): ClientRowProjectionModelSnapshot<T> => ({
    revision,
    sourceRows,
    rows,
    sortModel,
    pagination,
  })
  const recompute = (): void => {
    ensureActive()
    sourceRows = store.getRows()
    const sourceRevision = store.getSnapshot().revision
    const sourceById = new Map(sourceRows.map(row => [row.rowId, row]))
    const filtered = runFilterProjectionStage({
      sourceRows,
      previousFilteredRowsProjection: [],
      previousFilteredRowIds: new Set<DataGridRowId>(),
      sourceById,
      shouldRecompute: true,
      filterPredicate,
      resolveFilterPredicate: () => filterPredicate ?? (() => true),
    })
    const sorted = runFlatSortProjectionStage({
      sourceRows,
      filteredRowsProjection: filtered.filteredRowsProjection,
      previousSortedRowsProjection: rows,
      shouldRecompute: true,
      sortModel,
      projectionPolicy,
      sortValueCache,
      sortValueCacheKey,
      sortProjectionKey,
      sortInputRowsReference,
      rowVersionById: new Map(sourceRows.map(row => [row.rowId, sourceRevision])),
      counters,
      readRowField: options.readRowField ?? readRowField,
      comparatorRegistry,
    })
    sortValueCacheKey = sorted.sortValueCacheKey
    sortProjectionKey = sorted.sortProjectionKey
    sortInputRowsReference = sorted.sortInputRowsReference
    const paginated = runPaginateProjectionStage({
      aggregatedRowsProjection: sorted.sortedRowsProjection,
      previousPaginatedRowsProjection: rows,
      sourceById,
      shouldRecompute: true,
      paginationInput,
      currentPagination: pagination,
    })
    pagination = paginated.pagination
    const visible = runFlatVisibleProjectionStage({
      paginatedRowsProjection: paginated.paginatedRowsProjection,
      previousRows: rows,
      sourceById,
      shouldRecompute: true,
    })
    rows = visible.rows
    revision += 1
    const current = snapshot()
    for (const listener of listeners) listener(current)
  }

  const unsubscribeStore = store.subscribe(recompute)
  // Apply initial filter/sort configuration before the first consumer read.
  recompute()

  return {
    getSnapshot: snapshot,
    getSourceRows: () => sourceRows,
    getRows: () => rows,
    getRowCount: () => rows.length,
    getRow: index => rows[index],
    getRowById: rowId => rows.find(row => row.rowId === rowId),
    setRows: nextRows => store.setRows(nextRows),
    appendRows: nextRows => {
      ensureActive()
      store.appendRows(nextRows)
    },
    removeRows: rowIds => {
      ensureActive()
      return store.removeRows(rowIds)
    },
    refresh: () => {
      ensureActive()
      sortValueCache.clear()
      recompute()
    },
    setFilterPredicate: predicate => {
      ensureActive()
      filterPredicate = predicate
      recompute()
    },
    setSortModel: nextSortModel => {
      ensureActive()
      sortModel = [...nextSortModel]
      recompute()
    },
    setPagination: nextPagination => {
      ensureActive()
      paginationInput = normalizePaginationInput(nextPagination)
      recompute()
    },
    subscribe: listener => {
      ensureActive()
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      unsubscribeStore()
      store.dispose()
      listeners.clear()
      sortValueCache.clear()
    },
  }
}

function normalizePaginationInput(input: DataGridPaginationInput | null | undefined): DataGridPaginationInput {
  const pageSize = input?.pageSize ?? 0
  const currentPage = input?.currentPage ?? 0
  return {
    pageSize: Number.isFinite(pageSize) ? Math.max(0, Math.trunc(pageSize)) : 0,
    currentPage: Number.isFinite(currentPage) ? Math.max(0, Math.trunc(currentPage)) : 0,
  }
}

function emptyPaginationSnapshot(): DataGridPaginationSnapshot {
  return {
    enabled: false,
    pageSize: 0,
    currentPage: 0,
    pageCount: 0,
    totalRowCount: 0,
    startIndex: -1,
    endIndex: -1,
  }
}
