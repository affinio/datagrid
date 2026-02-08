import {
  normalizeRowNode,
  normalizeViewportRange,
  type DataGridFilterSnapshot,
  type DataGridRowId,
  type DataGridRowNode,
  type DataGridRowIdResolver,
  type DataGridRowModel,
  type DataGridRowModelListener,
  type DataGridRowModelRefreshReason,
  type DataGridRowModelSnapshot,
  type DataGridSortState,
  type DataGridViewportRange,
} from "./rowModel.js"
import type {
  DataGridDataSource,
  DataGridDataSourceBackpressureDiagnostics,
  DataGridDataSourceInvalidation,
  DataGridDataSourcePullPriority,
  DataGridDataSourcePullReason,
  DataGridDataSourcePushEvent,
  DataGridDataSourceRowEntry,
} from "./dataSourceProtocol.js"

export interface CreateDataSourceBackedRowModelOptions<T = unknown> {
  dataSource: DataGridDataSource<T>
  resolveRowId?: DataGridRowIdResolver<T>
  initialSortModel?: readonly DataGridSortState[]
  initialFilterModel?: DataGridFilterSnapshot | null
  initialTotal?: number
  rowCacheLimit?: number
}

export interface DataSourceBackedRowModel<T = unknown> extends DataGridRowModel<T> {
  readonly dataSource: DataGridDataSource<T>
  invalidateRange(range: DataGridViewportRange): void
  invalidateAll(): void
  getBackpressureDiagnostics(): DataGridDataSourceBackpressureDiagnostics
}

interface InFlightPull {
  requestId: number
  controller: AbortController
}

const DEFAULT_ROW_CACHE_LIMIT = 4096

function isAbortError(error: unknown): boolean {
  if (!error) {
    return false
  }
  const named = error as { name?: unknown }
  return named.name === "AbortError"
}

function normalizeRequestedRange(range: DataGridViewportRange): DataGridViewportRange {
  const start = Number.isFinite(range.start) ? Math.max(0, Math.trunc(range.start)) : 0
  const endCandidate = Number.isFinite(range.end) ? Math.max(0, Math.trunc(range.end)) : start
  return {
    start,
    end: Math.max(start, endCandidate),
  }
}

function rangesOverlap(left: DataGridViewportRange, right: DataGridViewportRange): boolean {
  return left.start <= right.end && right.start <= left.end
}

function normalizeTotal(total: number | null | undefined): number | null {
  if (!Number.isFinite(total)) {
    return null
  }
  return Math.max(0, Math.trunc(total as number))
}

export function createDataSourceBackedRowModel<T = unknown>(
  options: CreateDataSourceBackedRowModelOptions<T>,
): DataSourceBackedRowModel<T> {
  const dataSource = options.dataSource
  const resolveRowId = options.resolveRowId
  let sortModel: readonly DataGridSortState[] = options.initialSortModel ? [...options.initialSortModel] : []
  let filterModel: DataGridFilterSnapshot | null = options.initialFilterModel ?? null
  let rowCount = Math.max(0, Math.trunc(options.initialTotal ?? 0))
  let loading = false
  let error: Error | null = null
  let disposed = false
  let requestCounter = 0
  let inFlight: InFlightPull | null = null
  let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, rowCount)
  const rowCacheLimit =
    Number.isFinite(options.rowCacheLimit) && (options.rowCacheLimit as number) > 0
      ? Math.max(1, Math.trunc(options.rowCacheLimit as number))
      : DEFAULT_ROW_CACHE_LIMIT

  const rowCache = new Map<number, DataGridRowNode<T>>()
  const listeners = new Set<DataGridRowModelListener<T>>()
  const diagnostics: DataGridDataSourceBackpressureDiagnostics = {
    pullRequested: 0,
    pullCompleted: 0,
    pullAborted: 0,
    pullDropped: 0,
    pushApplied: 0,
    invalidatedRows: 0,
    inFlight: false,
  }

  const unsubscribePush = typeof dataSource.subscribe === "function"
    ? dataSource.subscribe(event => {
        applyPushEvent(event)
      })
    : null

  function enforceRowCacheLimit() {
    while (rowCache.size > rowCacheLimit) {
      const oldest = rowCache.keys().next().value as number | undefined
      if (typeof oldest === "undefined") {
        break
      }
      rowCache.delete(oldest)
    }
  }

  function readRowCache(index: number): DataGridRowNode<T> | undefined {
    if (!rowCache.has(index)) {
      return undefined
    }
    const cached = rowCache.get(index)
    rowCache.delete(index)
    if (cached) {
      rowCache.set(index, cached)
    }
    return cached
  }

  function writeRowCache(index: number, row: DataGridRowNode<T>) {
    if (rowCache.has(index)) {
      rowCache.delete(index)
    }
    rowCache.set(index, row)
    enforceRowCacheLimit()
  }

  function pruneRowCacheByRowCount() {
    for (const index of rowCache.keys()) {
      if (index >= rowCount) {
        rowCache.delete(index)
      }
    }
  }

  function ensureActive() {
    if (disposed) {
      throw new Error("DataSourceBackedRowModel has been disposed")
    }
  }

  function getSnapshot(): DataGridRowModelSnapshot<T> {
    return {
      kind: "server",
      rowCount,
      loading,
      error,
      viewportRange: normalizeViewportRange(viewportRange, rowCount),
      sortModel,
      filterModel,
    }
  }

  function emit() {
    if (disposed || listeners.size === 0) {
      return
    }
    const snapshot = getSnapshot()
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  function updateTotalFromRows(rows: readonly DataGridDataSourceRowEntry<T>[]) {
    let maxIndex = -1
    for (const entry of rows) {
      const index = Number.isFinite(entry.index) ? Math.max(0, Math.trunc(entry.index)) : -1
      if (index > maxIndex) {
        maxIndex = index
      }
    }
    if (maxIndex >= rowCount) {
      rowCount = maxIndex + 1
    }
  }

  function normalizeRowEntry(entry: DataGridDataSourceRowEntry<T>) {
    const index = Number.isFinite(entry.index) ? Math.max(0, Math.trunc(entry.index)) : 0
    const rowId = (() => {
      if (typeof entry.rowId === "string" || typeof entry.rowId === "number") {
        return entry.rowId as DataGridRowId
      }
      if (typeof resolveRowId === "function") {
        return resolveRowId(entry.row, index)
      }
      const fallback = (entry.row as { id?: unknown })?.id
      if (typeof fallback === "string" || typeof fallback === "number") {
        return fallback
      }
      throw new Error(
        `[DataGrid] Missing row identity for data-source row at index ${index}. Provide rowId or resolveRowId.`,
      )
    })()

    return {
      index,
      node: normalizeRowNode<T>(
        {
          row: entry.row,
          rowId,
          originalIndex: index,
          displayIndex: index,
          state: entry.state,
        },
        index,
      ),
    }
  }

  function applyRows(rows: readonly DataGridDataSourceRowEntry<T>[]) {
    if (rows.length === 0) {
      return
    }
    for (const entry of rows) {
      const normalized = normalizeRowEntry(entry)
      writeRowCache(normalized.index, normalized.node)
    }
    updateTotalFromRows(rows)
  }

  function clearRange(range: DataGridViewportRange) {
    const normalized = normalizeRequestedRange(range)
    const bounded = normalizeViewportRange(normalized, rowCount)
    if (rowCount <= 0) {
      return
    }
    for (let index = bounded.start; index <= bounded.end; index += 1) {
      if (rowCache.delete(index)) {
        diagnostics.invalidatedRows += 1
      }
    }
  }

  function clearAll() {
    diagnostics.invalidatedRows += rowCache.size
    rowCache.clear()
  }

  function abortInFlight() {
    if (!inFlight) {
      return
    }
    if (!inFlight.controller.signal.aborted) {
      inFlight.controller.abort()
      diagnostics.pullAborted += 1
    }
    inFlight = null
    diagnostics.inFlight = false
  }

  async function pullRange(
    range: DataGridViewportRange,
    reason: DataGridDataSourcePullReason,
    priority: DataGridDataSourcePullPriority,
  ): Promise<void> {
    if (disposed) {
      return
    }
    const requestRange = normalizeRequestedRange(range)
    abortInFlight()
    const requestId = requestCounter + 1
    requestCounter = requestId
    const controller = new AbortController()
    inFlight = {
      requestId,
      controller,
    }
    diagnostics.inFlight = true
    diagnostics.pullRequested += 1
    loading = true
    error = null
    emit()

    try {
      const result = await dataSource.pull({
        range: requestRange,
        priority,
        reason,
        signal: controller.signal,
        sortModel,
        filterModel,
      })

      if (disposed || !inFlight || inFlight.requestId !== requestId || controller.signal.aborted) {
        diagnostics.pullDropped += 1
        return
      }

      const nextTotal = normalizeTotal(result.total)
      if (nextTotal != null) {
        rowCount = nextTotal
        pruneRowCacheByRowCount()
      }
      applyRows(result.rows)
      diagnostics.pullCompleted += 1
    } catch (reasonError) {
      if (isAbortError(reasonError)) {
        return
      }
      error = reasonError instanceof Error ? reasonError : new Error(String(reasonError))
    } finally {
      if (inFlight && inFlight.requestId === requestId) {
        inFlight = null
        diagnostics.inFlight = false
      }
      loading = Boolean(inFlight)
      emit()
    }
  }

  function applyPushInvalidation(invalidation: DataGridDataSourceInvalidation) {
    if (invalidation.kind === "all") {
      clearAll()
      if (typeof dataSource.invalidate === "function") {
        void Promise.resolve(dataSource.invalidate(invalidation))
      }
      void pullRange(viewportRange, "push-invalidation", "normal")
      return
    }

    clearRange(invalidation.range)
    if (typeof dataSource.invalidate === "function") {
      void Promise.resolve(dataSource.invalidate(invalidation))
    }
    if (rangesOverlap(normalizeRequestedRange(invalidation.range), viewportRange)) {
      void pullRange(viewportRange, "push-invalidation", "normal")
    } else {
      emit()
    }
  }

  function applyPushEvent(event: DataGridDataSourcePushEvent<T>) {
    if (disposed) {
      return
    }
    diagnostics.pushApplied += 1

    if (event.type === "upsert") {
      applyRows(event.rows)
      const nextTotal = normalizeTotal(event.total)
      if (nextTotal != null) {
        rowCount = nextTotal
        pruneRowCacheByRowCount()
      }
      emit()
      return
    }

    if (event.type === "remove") {
      for (const rawIndex of event.indexes) {
        const index = Number.isFinite(rawIndex) ? Math.max(0, Math.trunc(rawIndex)) : -1
        if (index >= 0) {
          rowCache.delete(index)
        }
      }
      const nextTotal = normalizeTotal(event.total)
      if (nextTotal != null) {
        rowCount = nextTotal
        pruneRowCacheByRowCount()
      }
      emit()
      return
    }

    applyPushInvalidation(event.invalidation)
  }

  return {
    kind: "server",
    dataSource,
    getSnapshot,
    getRowCount() {
      return rowCount
    },
    getRow(index) {
      if (!Number.isFinite(index)) {
        return undefined
      }
      const normalized = Math.max(0, Math.trunc(index))
      if (normalized >= rowCount) {
        return undefined
      }
      return readRowCache(normalized)
    },
    getRowsInRange(range) {
      const normalized = normalizeViewportRange(range, rowCount)
      if (rowCount <= 0) {
        return []
      }
      const rows = []
      for (let index = normalized.start; index <= normalized.end; index += 1) {
        const row = readRowCache(index)
        if (row) {
          rows.push(row)
        }
      }
      return rows
    },
    setViewportRange(range) {
      ensureActive()
      const requested = normalizeRequestedRange(range)
      const nextViewport = rowCount > 0 ? normalizeViewportRange(requested, rowCount) : requested
      const unchanged =
        nextViewport.start === viewportRange.start &&
        nextViewport.end === viewportRange.end
      viewportRange = nextViewport

      if (unchanged) {
        let hasFullRange = true
        for (let index = nextViewport.start; index <= nextViewport.end; index += 1) {
          if (!rowCache.has(index)) {
            hasFullRange = false
            break
          }
        }
        if (hasFullRange) {
          return
        }
      }

      void pullRange(nextViewport, "viewport-change", "critical")
      emit()
    },
    setSortModel(nextSortModel) {
      ensureActive()
      sortModel = Array.isArray(nextSortModel) ? [...nextSortModel] : []
      clearAll()
      void pullRange(viewportRange, "sort-change", "critical")
      emit()
    },
    setFilterModel(nextFilterModel) {
      ensureActive()
      filterModel = nextFilterModel ?? null
      clearAll()
      void pullRange(viewportRange, "filter-change", "critical")
      emit()
    },
    async refresh(reason?: DataGridRowModelRefreshReason) {
      ensureActive()
      if (reason === "reset") {
        clearAll()
        if (typeof dataSource.invalidate === "function") {
          await dataSource.invalidate({ kind: "all", reason: "reset" })
        }
      }
      await pullRange(viewportRange, "refresh", "critical")
    },
    invalidateRange(range) {
      ensureActive()
      const invalidation: DataGridDataSourceInvalidation = { kind: "range", range, reason: "model-range" }
      clearRange(range)
      if (typeof dataSource.invalidate === "function") {
        void Promise.resolve(dataSource.invalidate(invalidation))
      }
      if (rangesOverlap(normalizeRequestedRange(range), viewportRange)) {
        void pullRange(viewportRange, "invalidation", "normal")
      } else {
        emit()
      }
    },
    invalidateAll() {
      ensureActive()
      clearAll()
      if (typeof dataSource.invalidate === "function") {
        void Promise.resolve(dataSource.invalidate({ kind: "all", reason: "model-all" }))
      }
      void pullRange(viewportRange, "invalidation", "normal")
    },
    getBackpressureDiagnostics() {
      return { ...diagnostics }
    },
    subscribe(listener) {
      if (disposed) {
        return () => {}
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      abortInFlight()
      listeners.clear()
      rowCache.clear()
      unsubscribePush?.()
    },
  }
}
