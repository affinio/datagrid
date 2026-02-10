import {
  buildGroupExpansionSnapshot,
  buildPaginationSnapshot,
  cloneGroupBySpec,
  isSameGroupBySpec,
  normalizePaginationInput,
  normalizeGroupBySpec,
  normalizeRowNode,
  normalizeViewportRange,
  toggleGroupExpansionKey,
  type DataGridPaginationInput,
  type DataGridFilterSnapshot,
  type DataGridGroupBySpec,
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
import { cloneDataGridFilterSnapshot } from "./advancedFilter.js"
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
  initialGroupBy?: DataGridGroupBySpec | null
  initialPagination?: DataGridPaginationInput | null
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
  key: string
  stateKey: string
  range: DataGridViewportRange
  promise: Promise<void>
  priority: DataGridDataSourcePullPriority
}

interface PendingPull {
  range: DataGridViewportRange
  reason: DataGridDataSourcePullReason
  priority: DataGridDataSourcePullPriority
  key: string
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

function rangeContains(container: DataGridViewportRange, target: DataGridViewportRange): boolean {
  return container.start <= target.start && container.end >= target.end
}

function normalizeTotal(total: number | null | undefined): number | null {
  if (!Number.isFinite(total)) {
    return null
  }
  return Math.max(0, Math.trunc(total as number))
}

function serializePullState(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ""
  } catch {
    return ""
  }
}

function resolvePriorityRank(priority: DataGridDataSourcePullPriority): number {
  switch (priority) {
    case "critical":
      return 3
    case "normal":
      return 2
    case "background":
      return 1
    default:
      return 0
  }
}

export function createDataSourceBackedRowModel<T = unknown>(
  options: CreateDataSourceBackedRowModelOptions<T>,
): DataSourceBackedRowModel<T> {
  const dataSource = options.dataSource
  const resolveRowId = options.resolveRowId
  let sortModel: readonly DataGridSortState[] = options.initialSortModel ? [...options.initialSortModel] : []
  let filterModel: DataGridFilterSnapshot | null = cloneDataGridFilterSnapshot(options.initialFilterModel ?? null)
  let groupBy: DataGridGroupBySpec | null = normalizeGroupBySpec(options.initialGroupBy ?? null)
  let paginationInput = normalizePaginationInput(options.initialPagination ?? null)
  const toggledGroupKeys = new Set<string>()
  let rowCount = Math.max(0, Math.trunc(options.initialTotal ?? 0))
  let loading = false
  let error: Error | null = null
  let disposed = false
  let revision = 0
  let requestCounter = 0
  let inFlight: InFlightPull | null = null
  let pendingPull: PendingPull | null = null
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
    pullCoalesced: 0,
    pullDeferred: 0,
    rowCacheEvicted: 0,
    pushApplied: 0,
    invalidatedRows: 0,
    inFlight: false,
    hasPendingPull: false,
    rowCacheSize: 0,
    rowCacheLimit,
  }

  const unsubscribePush = typeof dataSource.subscribe === "function"
    ? dataSource.subscribe(event => {
        applyPushEvent(event)
      })
    : null

  function enforceRowCacheLimit() {
    const protectedRange = toSourceRange(viewportRange)
    while (rowCache.size > rowCacheLimit) {
      let evictIndex: number | undefined
      for (const cachedIndex of rowCache.keys()) {
        if (cachedIndex < protectedRange.start || cachedIndex > protectedRange.end) {
          evictIndex = cachedIndex
          break
        }
      }
      if (typeof evictIndex === "undefined") {
        evictIndex = rowCache.keys().next().value as number | undefined
      }
      if (typeof evictIndex === "undefined") {
        break
      }
      if (rowCache.delete(evictIndex)) {
        diagnostics.rowCacheEvicted += 1
      }
    }
    diagnostics.rowCacheSize = rowCache.size
  }

  function bumpRevision() {
    revision += 1
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
    diagnostics.rowCacheSize = rowCache.size
  }

  function pruneRowCacheByRowCount() {
    for (const index of rowCache.keys()) {
      if (index >= rowCount) {
        rowCache.delete(index)
      }
    }
    diagnostics.rowCacheSize = rowCache.size
  }

  function ensureActive() {
    if (disposed) {
      throw new Error("DataSourceBackedRowModel has been disposed")
    }
  }

  function getPaginationSnapshot() {
    return buildPaginationSnapshot(rowCount, paginationInput)
  }

  function getVisibleRowCount() {
    const pagination = getPaginationSnapshot()
    if (!pagination.enabled) {
      return pagination.totalRowCount
    }
    if (pagination.startIndex < 0 || pagination.endIndex < pagination.startIndex) {
      return 0
    }
    return pagination.endIndex - pagination.startIndex + 1
  }

  function toSourceIndex(index: number): number {
    const pagination = getPaginationSnapshot()
    if (!pagination.enabled || pagination.startIndex < 0) {
      return index
    }
    return pagination.startIndex + index
  }

  function toSourceRange(range: DataGridViewportRange): DataGridViewportRange {
    const visibleCount = getVisibleRowCount()
    if (visibleCount <= 0) {
      return { start: 0, end: 0 }
    }
    const normalized = normalizeViewportRange(range, visibleCount)
    return {
      start: toSourceIndex(normalized.start),
      end: toSourceIndex(normalized.end),
    }
  }

  function getSnapshot(): DataGridRowModelSnapshot<T> {
    const pagination = getPaginationSnapshot()
    const visibleCount = getVisibleRowCount()
    viewportRange = normalizeViewportRange(viewportRange, visibleCount)
    return {
      revision,
      kind: "server",
      rowCount: visibleCount,
      loading,
      error,
      viewportRange,
      pagination,
      sortModel,
      filterModel: cloneDataGridFilterSnapshot(filterModel),
      groupBy: cloneGroupBySpec(groupBy),
      groupExpansion: buildGroupExpansionSnapshot(groupBy, toggledGroupKeys),
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

  function applyRows(rows: readonly DataGridDataSourceRowEntry<T>[]): boolean {
    if (rows.length === 0) {
      return false
    }
    for (const entry of rows) {
      const normalized = normalizeRowEntry(entry)
      writeRowCache(normalized.index, normalized.node)
    }
    updateTotalFromRows(rows)
    return true
  }

  function clearRange(range: DataGridViewportRange) {
    const normalized = normalizeRequestedRange(range)
    const bounded = normalizeViewportRange(normalized, rowCount)
    if (rowCount <= 0) {
      return
    }
    let changed = false
    for (let index = bounded.start; index <= bounded.end; index += 1) {
      if (rowCache.delete(index)) {
        diagnostics.invalidatedRows += 1
        changed = true
      }
    }
    if (changed) {
      bumpRevision()
    }
    diagnostics.rowCacheSize = rowCache.size
  }

  function clearAll() {
    if (rowCache.size > 0) {
      bumpRevision()
    }
    diagnostics.invalidatedRows += rowCache.size
    rowCache.clear()
    diagnostics.rowCacheSize = rowCache.size
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
    const requestStateKey = serializePullState({
      sortModel,
      filterModel,
      groupBy,
      groupExpansion: buildGroupExpansionSnapshot(groupBy, toggledGroupKeys),
    })
    const requestKey = serializePullState({
      range: requestRange,
      reason,
      priority,
      state: requestStateKey,
    })

    if (inFlight && !inFlight.controller.signal.aborted && inFlight.key === requestKey) {
      diagnostics.pullCoalesced += 1
      return inFlight.promise
    }

    if (
      reason === "viewport-change" &&
      inFlight &&
      !inFlight.controller.signal.aborted &&
      inFlight.stateKey === requestStateKey &&
      resolvePriorityRank(inFlight.priority) >= resolvePriorityRank(priority) &&
      rangeContains(inFlight.range, requestRange)
    ) {
      diagnostics.pullCoalesced += 1
      return inFlight.promise
    }

    if (inFlight && !inFlight.controller.signal.aborted) {
      const nextRank = resolvePriorityRank(priority)
      const activeRank = resolvePriorityRank(inFlight.priority)
      if (nextRank < activeRank) {
        if (pendingPull && pendingPull.key === requestKey) {
          diagnostics.pullCoalesced += 1
          return inFlight.promise
        }
        const pendingRank = pendingPull ? resolvePriorityRank(pendingPull.priority) : -1
        if (nextRank >= pendingRank) {
          pendingPull = {
            range: requestRange,
            reason,
            priority,
            key: requestKey,
          }
          diagnostics.hasPendingPull = true
        }
        diagnostics.pullDeferred += 1
        return inFlight.promise
      }
    }

    abortInFlight()
    const requestId = requestCounter + 1
    requestCounter = requestId
    const controller = new AbortController()
    const requestPromise = (async () => {
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
          groupBy: cloneGroupBySpec(groupBy),
          groupExpansion: buildGroupExpansionSnapshot(groupBy, toggledGroupKeys),
        })

        if (disposed || !inFlight || inFlight.requestId !== requestId || controller.signal.aborted) {
          diagnostics.pullDropped += 1
          return
        }

        let changed = false
        const previousRowCount = rowCount
        const nextTotal = normalizeTotal(result.total)
        if (nextTotal != null) {
          rowCount = nextTotal
          pruneRowCacheByRowCount()
          changed = changed || rowCount !== previousRowCount
          viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount())
        }
        changed = applyRows(result.rows) || changed
        if (changed) {
          bumpRevision()
        }
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
          if (!disposed && pendingPull) {
            const next = pendingPull
            pendingPull = null
            diagnostics.hasPendingPull = false
            void pullRange(next.range, next.reason, next.priority)
          }
        }
        loading = Boolean(inFlight)
        emit()
      }
    })()

    inFlight = {
      requestId,
      controller,
      key: requestKey,
      stateKey: requestStateKey,
      range: requestRange,
      promise: requestPromise,
      priority,
    }

    return requestPromise
  }

  function applyPushInvalidation(invalidation: DataGridDataSourceInvalidation) {
    if (invalidation.kind === "all") {
      clearAll()
      if (typeof dataSource.invalidate === "function") {
        void Promise.resolve(dataSource.invalidate(invalidation))
      }
      void pullRange(toSourceRange(viewportRange), "push-invalidation", "normal")
      return
    }

    clearRange(invalidation.range)
    if (typeof dataSource.invalidate === "function") {
      void Promise.resolve(dataSource.invalidate(invalidation))
    }
    if (rangesOverlap(normalizeRequestedRange(invalidation.range), toSourceRange(viewportRange))) {
      void pullRange(toSourceRange(viewportRange), "push-invalidation", "normal")
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
      let changed = applyRows(event.rows)
      const previousRowCount = rowCount
      const nextTotal = normalizeTotal(event.total)
      if (nextTotal != null) {
        rowCount = nextTotal
        pruneRowCacheByRowCount()
        changed = changed || rowCount !== previousRowCount
        viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount())
      }
      if (changed) {
        bumpRevision()
      }
      emit()
      return
    }

    if (event.type === "remove") {
      let changed = false
      for (const rawIndex of event.indexes) {
        const index = Number.isFinite(rawIndex) ? Math.max(0, Math.trunc(rawIndex)) : -1
        if (index >= 0) {
          changed = rowCache.delete(index) || changed
        }
      }
      diagnostics.rowCacheSize = rowCache.size
      const previousRowCount = rowCount
      const nextTotal = normalizeTotal(event.total)
      if (nextTotal != null) {
        rowCount = nextTotal
        pruneRowCacheByRowCount()
        changed = changed || rowCount !== previousRowCount
        viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount())
      }
      if (changed) {
        bumpRevision()
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
      return getVisibleRowCount()
    },
    getRow(index) {
      if (!Number.isFinite(index)) {
        return undefined
      }
      const normalized = Math.max(0, Math.trunc(index))
      const visibleCount = getVisibleRowCount()
      if (normalized >= visibleCount) {
        return undefined
      }
      return readRowCache(toSourceIndex(normalized))
    },
    getRowsInRange(range) {
      const visibleCount = getVisibleRowCount()
      const normalized = normalizeViewportRange(range, visibleCount)
      if (visibleCount <= 0) {
        return []
      }
      const rows = []
      for (let index = normalized.start; index <= normalized.end; index += 1) {
        const row = readRowCache(toSourceIndex(index))
        if (row) {
          rows.push(row)
        }
      }
      return rows
    },
    setViewportRange(range) {
      ensureActive()
      const requested = normalizeRequestedRange(range)
      const visibleCount = getVisibleRowCount()
      const nextViewport = visibleCount > 0 ? normalizeViewportRange(requested, visibleCount) : requested
      const unchanged =
        nextViewport.start === viewportRange.start &&
        nextViewport.end === viewportRange.end
      viewportRange = nextViewport

      if (unchanged) {
        const sourceViewport = toSourceRange(nextViewport)
        let hasFullRange = true
        for (let index = sourceViewport.start; index <= sourceViewport.end; index += 1) {
          if (!rowCache.has(index)) {
            hasFullRange = false
            break
          }
        }
        if (hasFullRange) {
          return
        }
      }

      void pullRange(toSourceRange(nextViewport), "viewport-change", "critical")
      emit()
    },
    setPagination(nextPagination: DataGridPaginationInput | null) {
      ensureActive()
      const normalized = normalizePaginationInput(nextPagination)
      if (
        normalized.pageSize === paginationInput.pageSize &&
        normalized.currentPage === paginationInput.currentPage
      ) {
        return
      }
      paginationInput = normalized
      viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount())
      bumpRevision()
      emit()
    },
    setPageSize(pageSize: number | null) {
      ensureActive()
      const normalizedPageSize = normalizePaginationInput({ pageSize: pageSize ?? 0, currentPage: 0 }).pageSize
      if (normalizedPageSize === paginationInput.pageSize) {
        return
      }
      paginationInput = {
        pageSize: normalizedPageSize,
        currentPage: 0,
      }
      viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount())
      bumpRevision()
      emit()
    },
    setCurrentPage(page: number) {
      ensureActive()
      const normalizedPage = normalizePaginationInput({
        pageSize: paginationInput.pageSize,
        currentPage: page,
      }).currentPage
      if (normalizedPage === paginationInput.currentPage) {
        return
      }
      paginationInput = {
        ...paginationInput,
        currentPage: normalizedPage,
      }
      viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount())
      bumpRevision()
      emit()
    },
    setSortModel(nextSortModel) {
      ensureActive()
      sortModel = Array.isArray(nextSortModel) ? [...nextSortModel] : []
      bumpRevision()
      clearAll()
      void pullRange(toSourceRange(viewportRange), "sort-change", "critical")
      emit()
    },
    setFilterModel(nextFilterModel) {
      ensureActive()
      filterModel = cloneDataGridFilterSnapshot(nextFilterModel ?? null)
      bumpRevision()
      clearAll()
      void pullRange(toSourceRange(viewportRange), "filter-change", "critical")
      emit()
    },
    setGroupBy(nextGroupBy) {
      ensureActive()
      const normalized = normalizeGroupBySpec(nextGroupBy)
      if (isSameGroupBySpec(groupBy, normalized)) {
        return
      }
      groupBy = normalized
      toggledGroupKeys.clear()
      bumpRevision()
      clearAll()
      void pullRange(toSourceRange(viewportRange), "group-change", "critical")
      emit()
    },
    toggleGroup(groupKey: string) {
      ensureActive()
      if (!groupBy) {
        return
      }
      if (!toggleGroupExpansionKey(toggledGroupKeys, groupKey)) {
        return
      }
      bumpRevision()
      clearAll()
      void pullRange(toSourceRange(viewportRange), "group-change", "critical")
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
      await pullRange(toSourceRange(viewportRange), "refresh", "critical")
    },
    invalidateRange(range) {
      ensureActive()
      const sourceRange = toSourceRange(range)
      const invalidation: DataGridDataSourceInvalidation = { kind: "range", range: sourceRange, reason: "model-range" }
      clearRange(sourceRange)
      if (typeof dataSource.invalidate === "function") {
        void Promise.resolve(dataSource.invalidate(invalidation))
      }
      if (rangesOverlap(normalizeRequestedRange(sourceRange), toSourceRange(viewportRange))) {
        void pullRange(toSourceRange(viewportRange), "invalidation", "normal")
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
      void pullRange(toSourceRange(viewportRange), "invalidation", "normal")
    },
    getBackpressureDiagnostics() {
      diagnostics.inFlight = Boolean(inFlight)
      diagnostics.hasPendingPull = Boolean(pendingPull)
      diagnostics.rowCacheSize = rowCache.size
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
      pendingPull = null
      diagnostics.inFlight = false
      diagnostics.hasPendingPull = false
      diagnostics.rowCacheSize = 0
      unsubscribePush?.()
    },
  }
}
