import type { ServerRowModel } from "../serverRowModel/serverRowModel"
import {
  buildGroupExpansionSnapshot,
  buildPaginationSnapshot,
  cloneGroupBySpec,
  isSameGroupBySpec,
  normalizeRowNode,
  normalizeGroupBySpec,
  normalizePaginationInput,
  normalizeViewportRange,
  toggleGroupExpansionKey,
  type DataGridRowId,
  type DataGridRowIdResolver,
  type DataGridFilterSnapshot,
  type DataGridGroupBySpec,
  type DataGridPaginationInput,
  type DataGridRowNode,
  type DataGridRowModel,
  type DataGridRowModelListener,
  type DataGridRowModelRefreshReason,
  type DataGridRowModelSnapshot,
  type DataGridSortState,
  type DataGridViewportRange,
} from "./rowModel.js"
import { cloneDataGridFilterSnapshot } from "./advancedFilter.js"

export interface CreateServerBackedRowModelOptions<T> {
  source: ServerRowModel<T>
  resolveRowId?: DataGridRowIdResolver<T>
  initialSortModel?: readonly DataGridSortState[]
  initialFilterModel?: DataGridFilterSnapshot | null
  initialGroupBy?: DataGridGroupBySpec | null
  initialPagination?: DataGridPaginationInput | null
  rowCacheLimit?: number
}

export interface ServerBackedRowModel<T> extends DataGridRowModel<T> {
  readonly source: ServerRowModel<T>
  syncFromSource(): void
}

const DEFAULT_ROW_CACHE_LIMIT = 4096

export function createServerBackedRowModel<T>(
  options: CreateServerBackedRowModelOptions<T>,
): ServerBackedRowModel<T> {
  const { source } = options
  const resolveRowId: DataGridRowIdResolver<T> = options.resolveRowId ?? ((row, index) => {
    const value = (row as { id?: unknown })?.id
    if (typeof value === "string" || typeof value === "number") {
      return value
    }
    throw new Error(
      `[DataGrid] Missing row identity for server row at index ${index}. ` +
      "Provide options.resolveRowId(row, index) or include row.id.",
    )
  })
  let sortModel: readonly DataGridSortState[] = options.initialSortModel ? [...options.initialSortModel] : []
  let filterModel: DataGridFilterSnapshot | null = cloneDataGridFilterSnapshot(options.initialFilterModel ?? null)
  let groupBy: DataGridGroupBySpec | null = normalizeGroupBySpec(options.initialGroupBy ?? null)
  let paginationInput = normalizePaginationInput(options.initialPagination ?? null)
  const toggledGroupKeys = new Set<string>()
  let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, source.getRowCount())
  let disposed = false
  let revision = 0
  let cacheRevision = 0
  let lastRangeCacheKey = ""
  let lastRangeCacheRows: readonly DataGridRowNode<T>[] = []
  const listeners = new Set<DataGridRowModelListener<T>>()
  const rowNodeCache = new Map<number, DataGridRowNode<T> | undefined>()
  const rowCacheLimit =
    Number.isFinite(options.rowCacheLimit) && (options.rowCacheLimit as number) > 0
      ? Math.max(1, Math.trunc(options.rowCacheLimit as number))
      : DEFAULT_ROW_CACHE_LIMIT

  function readRowCache(index: number): DataGridRowNode<T> | undefined {
    if (!rowNodeCache.has(index)) {
      return undefined
    }
    const cached = rowNodeCache.get(index)
    rowNodeCache.delete(index)
    rowNodeCache.set(index, cached)
    return cached
  }

  function writeRowCache(index: number, row: DataGridRowNode<T> | undefined): void {
    if (rowNodeCache.has(index)) {
      rowNodeCache.delete(index)
    }
    rowNodeCache.set(index, row)
    while (rowNodeCache.size > rowCacheLimit) {
      const oldest = rowNodeCache.keys().next().value as number | undefined
      if (typeof oldest === "undefined") {
        break
      }
      rowNodeCache.delete(oldest)
    }
  }

  function ensureActive() {
    if (disposed) {
      throw new Error("ServerBackedRowModel has been disposed")
    }
  }

  function getPaginationSnapshot() {
    return buildPaginationSnapshot(source.getRowCount(), paginationInput)
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
    const normalized = normalizeViewportRange(range, visibleCount)
    if (visibleCount <= 0) {
      return { start: 0, end: 0 }
    }
    return {
      start: toSourceIndex(normalized.start),
      end: toSourceIndex(normalized.end),
    }
  }

  function getSnapshot(): DataGridRowModelSnapshot<T> {
    const pagination = getPaginationSnapshot()
    const rowCount = getVisibleRowCount()
    viewportRange = normalizeViewportRange(viewportRange, rowCount)
    return {
      revision,
      kind: "server",
      rowCount,
      loading: Boolean(source.loading.value),
      error: source.error.value ?? null,
      viewportRange,
      pagination,
      sortModel,
      filterModel: cloneDataGridFilterSnapshot(filterModel),
      groupBy: cloneGroupBySpec(groupBy),
      groupExpansion: buildGroupExpansionSnapshot(groupBy, toggledGroupKeys),
    }
  }

  function invalidateCaches() {
    rowNodeCache.clear()
    cacheRevision += 1
    lastRangeCacheKey = ""
    lastRangeCacheRows = []
    revision += 1
  }

  function invalidateCachesForRange(range: DataGridViewportRange) {
    const normalized = normalizeViewportRange(toSourceRange(range), source.getRowCount())
    for (let index = normalized.start; index <= normalized.end; index += 1) {
      rowNodeCache.delete(index)
    }
    cacheRevision += 1
    lastRangeCacheKey = ""
    lastRangeCacheRows = []
    revision += 1
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

  async function warmViewportRange(range: DataGridViewportRange): Promise<void> {
    const sourceRange = toSourceRange(range)
    const start = Math.max(0, Math.trunc(sourceRange.start))
    const end = Math.max(start, Math.trunc(sourceRange.end))
    await source.fetchBlock(start)
    if (end !== start) {
      await source.fetchBlock(end)
    }
  }

  function toRowNode(index: number): DataGridRowNode<T> | undefined {
    const sourceIndex = toSourceIndex(index)
    if (rowNodeCache.has(sourceIndex)) {
      return readRowCache(sourceIndex)
    }
    const row = source.getRowAt(sourceIndex)
    if (typeof row === "undefined") {
      writeRowCache(sourceIndex, undefined)
      return undefined
    }
    const rowId = resolveRowId(row, sourceIndex) as DataGridRowId
    if (typeof rowId !== "string" && typeof rowId !== "number") {
      throw new Error(`[DataGrid] Invalid row identity returned for index ${sourceIndex}. Expected string|number.`)
    }
    const normalized = normalizeRowNode({
      row,
      rowId,
      originalIndex: sourceIndex,
      displayIndex: index,
    }, sourceIndex)
    writeRowCache(sourceIndex, normalized)
    return normalized
  }

  return {
    kind: "server",
    source,
    getSnapshot,
    getRowCount() {
      return getVisibleRowCount()
    },
    getRow(index) {
      if (!Number.isFinite(index)) {
        return undefined
      }
      const rowCount = getVisibleRowCount()
      const normalized = Math.max(0, Math.trunc(index))
      if (normalized >= rowCount) {
        return undefined
      }
      return toRowNode(normalized)
    },
    getRowsInRange(range) {
      const normalized = normalizeViewportRange(range, getVisibleRowCount())
      const rangeCacheKey = `${normalized.start}:${normalized.end}:${cacheRevision}`
      if (lastRangeCacheKey === rangeCacheKey) {
        return lastRangeCacheRows
      }
      const rows: DataGridRowNode<T>[] = []
      for (let index = normalized.start; index <= normalized.end; index += 1) {
        const row = toRowNode(index)
        if (row) {
          rows.push(row)
        }
      }
      lastRangeCacheKey = rangeCacheKey
      lastRangeCacheRows = Object.freeze(rows.slice())
      return lastRangeCacheRows
    },
    setViewportRange(range) {
      ensureActive()
      const nextRange = normalizeViewportRange(range, getVisibleRowCount())
      if (nextRange.start === viewportRange.start && nextRange.end === viewportRange.end) {
        return
      }
      viewportRange = nextRange
      void warmViewportRange(viewportRange)
        .then(() => {
          invalidateCachesForRange(viewportRange)
          emit()
        })
        .catch(() => {
          invalidateCachesForRange(viewportRange)
          emit()
        })
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
      invalidateCaches()
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
      invalidateCaches()
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
      invalidateCaches()
      emit()
    },
    setSortModel(nextSortModel) {
      ensureActive()
      sortModel = Array.isArray(nextSortModel) ? [...nextSortModel] : []
      invalidateCaches()
      emit()
    },
    setFilterModel(nextFilterModel) {
      ensureActive()
      filterModel = cloneDataGridFilterSnapshot(nextFilterModel ?? null)
      invalidateCaches()
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
      invalidateCaches()
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
      invalidateCaches()
      emit()
    },
    async refresh(reason?: DataGridRowModelRefreshReason) {
      ensureActive()
      if (reason === "reset") {
        source.reset()
      }
      try {
        await warmViewportRange(viewportRange)
        invalidateCachesForRange(viewportRange)
      } finally {
        emit()
      }
    },
    syncFromSource() {
      ensureActive()
      invalidateCaches()
      emit()
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
      listeners.clear()
      rowNodeCache.clear()
      lastRangeCacheRows = []
    },
  }
}
