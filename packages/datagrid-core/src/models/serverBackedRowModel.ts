import type { ServerRowModel } from "../serverRowModel/serverRowModel"
import {
  buildGroupExpansionSnapshot,
  buildPaginationSnapshot,
  cloneGroupBySpec,
  isSameGroupExpansionSnapshot,
  isSameGroupBySpec,
  normalizeRowNode,
  normalizeGroupBySpec,
  normalizePaginationInput,
  normalizeViewportRange,
  setGroupExpansionKey,
  toggleGroupExpansionKey,
  type DataGridGroupExpansionSnapshot,
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
  warmupBlockStep?: number
}

export interface ServerBackedRowModel<T> extends DataGridRowModel<T> {
  readonly source: ServerRowModel<T>
  syncFromSource(): void
}

const DEFAULT_ROW_CACHE_LIMIT = 4096

interface InFlightViewportWarmup {
  start: number
  end: number
  step: number
  token: number
  promise: Promise<void>
  cancel: () => void
}

export function createServerBackedRowModel<T>(
  options: CreateServerBackedRowModelOptions<T>,
): ServerBackedRowModel<T> {
  const { source } = options
  type SourceUpdatePayload =
    | DataGridViewportRange
    | {
      start?: number
      end?: number
      range?: {
        start?: number
        end?: number
      }
    }
    | null
    | undefined
  const sourceSubscribe = (source as unknown as {
    subscribe?: (listener: (payload?: SourceUpdatePayload) => void) => (() => void) | void
  }).subscribe
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
  let expansionExpandedByDefault = Boolean(groupBy?.expandedByDefault)
  let paginationInput = normalizePaginationInput(options.initialPagination ?? null)
  const toggledGroupKeys = new Set<string>()
  let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, source.getRowCount())
  let disposed = false
  let revision = 0
  let cacheRevision = 0
  let lastRangeCacheStart = -1
  let lastRangeCacheEnd = -1
  let lastRangeCacheRevision = -1
  const emptyRangeRows = Object.freeze([]) as readonly DataGridRowNode<T>[]
  let lastRangeCacheRows: readonly DataGridRowNode<T>[] = emptyRangeRows
  let inFlightViewportWarmup: InFlightViewportWarmup | null = null
  let warmupToken = 0
  let warming = false
  const listeners = new Set<DataGridRowModelListener<T>>()
  const rowNodeCache = new Map<number, DataGridRowNode<T>>()
  const rowNodeCacheRevision = new Map<number, number>()
  const rowCacheLimit =
    Number.isFinite(options.rowCacheLimit) && (options.rowCacheLimit as number) > 0
      ? Math.max(1, Math.trunc(options.rowCacheLimit as number))
      : DEFAULT_ROW_CACHE_LIMIT
  const unsubscribeSource =
    typeof sourceSubscribe === "function"
      ? sourceSubscribe((payload?: SourceUpdatePayload) => {
          if (disposed) {
            return
          }
          const sourceRange = resolveSourceInvalidationRange(payload)
          if (sourceRange) {
            invalidateCachesForSourceRange(sourceRange)
          } else {
            invalidateCachesForRange(viewportRange)
          }
          emit()
        }) ?? null
      : null

  function readRowCache(index: number): DataGridRowNode<T> | undefined {
    const cached = rowNodeCache.get(index)
    if (!cached) {
      return undefined
    }
    const revision = rowNodeCacheRevision.get(index)
    rowNodeCache.delete(index)
    rowNodeCache.set(index, cached)
    if (typeof revision !== "undefined") {
      rowNodeCacheRevision.delete(index)
      rowNodeCacheRevision.set(index, revision)
    }
    return cached
  }

  function writeRowCache(index: number, row: DataGridRowNode<T>): void {
    if (rowNodeCache.has(index)) {
      rowNodeCache.delete(index)
    }
    rowNodeCache.set(index, row)
    rowNodeCacheRevision.set(index, cacheRevision)
    while (rowNodeCache.size > rowCacheLimit) {
      const oldest = rowNodeCache.keys().next().value as number | undefined
      if (typeof oldest === "undefined") {
        break
      }
      rowNodeCache.delete(oldest)
      rowNodeCacheRevision.delete(oldest)
    }
  }

  function deleteRowCache(index: number): void {
    rowNodeCache.delete(index)
    rowNodeCacheRevision.delete(index)
  }

  function ensureActive() {
    if (disposed) {
      throw new Error("ServerBackedRowModel has been disposed")
    }
  }

  function setWarming(next: boolean): boolean {
    if (warming === next) {
      return false
    }
    warming = next
    revision += 1
    return true
  }

  function normalizeSourceRange(startValue: unknown, endValue: unknown): DataGridViewportRange | null {
    if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) {
      return null
    }
    const rawStart = Math.trunc(startValue as number)
    const rawEnd = Math.trunc(endValue as number)
    const start = Math.max(0, Math.min(rawStart, rawEnd))
    const end = Math.max(start, Math.max(rawStart, rawEnd))
    return { start, end }
  }

  function resolveSourceInvalidationRange(payload: SourceUpdatePayload): DataGridViewportRange | null {
    if (!payload || typeof payload !== "object") {
      return null
    }
    const nestedRange = (payload as { range?: { start?: unknown; end?: unknown } }).range
    if (nestedRange && typeof nestedRange === "object") {
      const normalizedNested = normalizeSourceRange(nestedRange.start, nestedRange.end)
      if (normalizedNested) {
        return normalizedNested
      }
    }
    return normalizeSourceRange(
      (payload as { start?: unknown }).start,
      (payload as { end?: unknown }).end,
    )
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
      warming,
      error: source.error.value ?? null,
      viewportRange,
      pagination,
      sortModel,
      filterModel: cloneDataGridFilterSnapshot(filterModel),
      groupBy: cloneGroupBySpec(groupBy),
      groupExpansion: buildGroupExpansionSnapshot(getExpansionSpec(), toggledGroupKeys),
    }
  }

  function getExpansionSpec(): DataGridGroupBySpec | null {
    if (!groupBy) {
      return null
    }
    return {
      fields: groupBy.fields,
      expandedByDefault: expansionExpandedByDefault,
    }
  }

  function applyGroupExpansion(nextExpansion: DataGridGroupExpansionSnapshot | null): boolean {
    const expansionSpec = getExpansionSpec()
    if (!expansionSpec) {
      return false
    }
    const normalizedSnapshot = buildGroupExpansionSnapshot(
      {
        fields: expansionSpec.fields,
        expandedByDefault: nextExpansion?.expandedByDefault ?? expansionSpec.expandedByDefault,
      },
      nextExpansion?.toggledGroupKeys ?? [],
    )
    const currentSnapshot = buildGroupExpansionSnapshot(expansionSpec, toggledGroupKeys)
    if (isSameGroupExpansionSnapshot(currentSnapshot, normalizedSnapshot)) {
      return false
    }
    expansionExpandedByDefault = normalizedSnapshot.expandedByDefault
    toggledGroupKeys.clear()
    for (const groupKey of normalizedSnapshot.toggledGroupKeys) {
      toggledGroupKeys.add(groupKey)
    }
    return true
  }

  function invalidateCaches() {
    rowNodeCache.clear()
    rowNodeCacheRevision.clear()
    cacheRevision += 1
    warmupToken += 1
    lastRangeCacheStart = -1
    lastRangeCacheEnd = -1
    lastRangeCacheRevision = -1
    lastRangeCacheRows = emptyRangeRows
    revision += 1
  }

  function clearLastRangeCache(): void {
    lastRangeCacheStart = -1
    lastRangeCacheEnd = -1
    lastRangeCacheRevision = -1
    lastRangeCacheRows = emptyRangeRows
  }

  function invalidateRowCacheForSourceRange(sourceRange: DataGridViewportRange): void {
    if (rowNodeCache.size === 0) {
      return
    }
    for (const sourceIndex of rowNodeCache.keys()) {
      if (sourceIndex < sourceRange.start || sourceIndex > sourceRange.end) {
        continue
      }
      deleteRowCache(sourceIndex)
    }
  }

  function invalidateCachesForSourceRange(sourceRange: DataGridViewportRange): void {
    invalidateRowCacheForSourceRange(sourceRange)
    if (lastRangeCacheStart >= 0 && lastRangeCacheEnd >= lastRangeCacheStart) {
      const lastSourceStart = toSourceIndex(lastRangeCacheStart)
      const lastSourceEnd = toSourceIndex(lastRangeCacheEnd)
      const intersects =
        sourceRange.start <= lastSourceEnd &&
        sourceRange.end >= lastSourceStart
      if (intersects) {
        clearLastRangeCache()
      }
    } else {
      clearLastRangeCache()
    }
    revision += 1
  }

  function invalidateCachesForRange(range: DataGridViewportRange) {
    const rowCount = getVisibleRowCount()
    if (rowCount <= 0) {
      clearLastRangeCache()
      revision += 1
      return
    }
    const sourceRange = toSourceRange(range)
    invalidateCachesForSourceRange(sourceRange)
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

  function resolveWarmupBlockStep(): number {
    const configuredStep = options.warmupBlockStep
    if (Number.isFinite(configuredStep) && (configuredStep as number) > 0) {
      return Math.max(1, Math.trunc(configuredStep as number))
    }

    for (const loadedRange of source.loadedRanges.value) {
      if (
        loadedRange &&
        Number.isFinite(loadedRange.start) &&
        Number.isFinite(loadedRange.end) &&
        loadedRange.end >= loadedRange.start
      ) {
        const span = Math.max(1, Math.trunc(loadedRange.end - loadedRange.start + 1))
        if (span > 0) {
          return span
        }
      }
    }

    for (const rows of source.blocks.value.values()) {
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.length
      }
    }

    return 300
  }

  function buildWarmupStarts(start: number, end: number, step: number): readonly number[] {
    const normalizedStep = Math.max(1, Math.trunc(step))
    const starts = new Set<number>()
    const alignedStart = Math.max(0, Math.floor(start / normalizedStep) * normalizedStep)
    const alignedEnd = Math.max(alignedStart, Math.floor(end / normalizedStep) * normalizedStep)
    for (let cursor = alignedStart; cursor <= alignedEnd; cursor += normalizedStep) {
      starts.add(cursor)
    }
    if (starts.size === 0) {
      starts.add(alignedStart)
    }
    return Array.from(starts).sort((left, right) => left - right)
  }

  function warmViewportRange(range: DataGridViewportRange): InFlightViewportWarmup {
    const sourceRange = toSourceRange(range)
    const start = Math.max(0, Math.trunc(sourceRange.start))
    const end = Math.max(start, Math.trunc(sourceRange.end))
    const step = resolveWarmupBlockStep()
    if (
      inFlightViewportWarmup &&
      inFlightViewportWarmup.start === start &&
      inFlightViewportWarmup.end === end &&
      inFlightViewportWarmup.step === step
    ) {
      return inFlightViewportWarmup
    }
    if (inFlightViewportWarmup) {
      inFlightViewportWarmup.cancel()
    }
    const token = ++warmupToken
    let cancelled = false
    let resolved = false
    let resolvePromise: (() => void) | null = null
    const promise = new Promise<void>(resolve => {
      resolvePromise = () => {
        if (resolved) {
          return
        }
        resolved = true
        resolve()
      }
    })
    const warmupStarts = buildWarmupStarts(start, end, step)
    const firstStart = warmupStarts[0]
    const shouldContinue = () => !resolved && !cancelled && !disposed && token === warmupToken
    const finalize = () => {
      resolvePromise?.()
    }
    let remainingStarted = false
    const startRemaining = () => {
      if (remainingStarted) {
        return
      }
      remainingStarted = true
      if (!shouldContinue()) {
        finalize()
        return
      }
      let index = 1
      const step = () => {
        if (!shouldContinue()) {
          finalize()
          return
        }
        if (index >= warmupStarts.length) {
          finalize()
          return
        }
        const warmupStart = warmupStarts[index]
        index += 1
        if (typeof warmupStart !== "number") {
          step()
          return
        }
        Promise.resolve(source.fetchBlock(warmupStart))
          .then(step)
          .catch(step)
      }
      step()
    }
    if (typeof firstStart !== "number") {
      finalize()
    } else {
      const firstPromise = Promise.resolve(source.fetchBlock(firstStart))
      const advance = () => {
        if (!shouldContinue()) {
          finalize()
          return
        }
        startRemaining()
      }
      firstPromise.then(advance).catch(advance)
    }
    inFlightViewportWarmup = {
      start,
      end,
      step,
      token,
      promise,
      cancel: () => {
        if (cancelled) {
          return
        }
        cancelled = true
        resolvePromise?.()
      },
    }
    void promise.finally(() => {
      if (inFlightViewportWarmup?.promise === promise) {
        inFlightViewportWarmup = null
      }
    })
    return inFlightViewportWarmup
  }

  function markCachesStale(): void {
    cacheRevision += 1
    clearLastRangeCache()
    revision += 1
  }

  function toRowNode(index: number): DataGridRowNode<T> | undefined {
    const sourceIndex = toSourceIndex(index)
    const cached = readRowCache(sourceIndex)
    if (cached && rowNodeCacheRevision.get(sourceIndex) === cacheRevision) {
      return cached
    }

    const row = source.getRowAt(sourceIndex)
    if (typeof row === "undefined") {
      deleteRowCache(sourceIndex)
      return undefined
    }
    const rowId = resolveRowId(row, sourceIndex) as DataGridRowId
    if (typeof rowId !== "string" && typeof rowId !== "number") {
      throw new Error(`[DataGrid] Invalid row identity returned for index ${sourceIndex}. Expected string|number.`)
    }

    if (cached) {
      if (
        cached.row !== row ||
        cached.data !== row ||
        cached.rowId !== rowId ||
        cached.rowKey !== rowId ||
        cached.sourceIndex !== sourceIndex ||
        cached.originalIndex !== sourceIndex ||
        cached.displayIndex !== index
      ) {
        cached.row = row
        cached.data = row
        cached.rowId = rowId
        cached.rowKey = rowId
        cached.sourceIndex = sourceIndex
        cached.originalIndex = sourceIndex
        cached.displayIndex = index
      }
      writeRowCache(sourceIndex, cached)
      return cached
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
      if (
        lastRangeCacheRevision === cacheRevision &&
        lastRangeCacheStart === normalized.start &&
        lastRangeCacheEnd === normalized.end
      ) {
        return lastRangeCacheRows
      }
      if (normalized.end < normalized.start) {
        lastRangeCacheStart = normalized.start
        lastRangeCacheEnd = normalized.end
        lastRangeCacheRevision = cacheRevision
        lastRangeCacheRows = emptyRangeRows
        return lastRangeCacheRows
      }
      const rows: DataGridRowNode<T>[] = []
      for (let index = normalized.start; index <= normalized.end; index += 1) {
        const row = toRowNode(index)
        if (row) {
          rows.push(row)
        }
      }
      lastRangeCacheStart = normalized.start
      lastRangeCacheEnd = normalized.end
      lastRangeCacheRevision = cacheRevision
      lastRangeCacheRows = rows.length > 0 ? Object.freeze(rows) : emptyRangeRows
      return lastRangeCacheRows
    },
    setViewportRange(range) {
      ensureActive()
      const nextRange = normalizeViewportRange(range, getVisibleRowCount())
      if (nextRange.start === viewportRange.start && nextRange.end === viewportRange.end) {
        return
      }
      viewportRange = nextRange
      const warmedRange = nextRange
      const warmup = warmViewportRange(warmedRange)
      setWarming(true)
      emit()
      void warmup.promise
        .then(() => {
          if (disposed || warmup.token !== warmupToken) {
            return
          }
          setWarming(false)
          invalidateCachesForRange(warmedRange)
          emit()
        })
        .catch(() => {
          if (disposed || warmup.token !== warmupToken) {
            return
          }
          setWarming(false)
          invalidateCachesForRange(warmedRange)
          emit()
        })
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
      expansionExpandedByDefault = Boolean(normalized?.expandedByDefault)
      toggledGroupKeys.clear()
      invalidateCaches()
      emit()
    },
    setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null) {
      ensureActive()
      if (!applyGroupExpansion(expansion)) {
        return
      }
      invalidateCaches()
      emit()
    },
    toggleGroup(groupKey: string) {
      ensureActive()
      if (!getExpansionSpec()) {
        return
      }
      if (!toggleGroupExpansionKey(toggledGroupKeys, groupKey)) {
        return
      }
      invalidateCaches()
      emit()
    },
    expandGroup(groupKey: string) {
      ensureActive()
      if (!getExpansionSpec()) {
        return
      }
      if (!setGroupExpansionKey(toggledGroupKeys, groupKey, expansionExpandedByDefault, true)) {
        return
      }
      invalidateCaches()
      emit()
    },
    collapseGroup(groupKey: string) {
      ensureActive()
      if (!getExpansionSpec()) {
        return
      }
      if (!setGroupExpansionKey(toggledGroupKeys, groupKey, expansionExpandedByDefault, false)) {
        return
      }
      invalidateCaches()
      emit()
    },
    expandAllGroups() {
      ensureActive()
      if (!getExpansionSpec()) {
        return
      }
      if (expansionExpandedByDefault && toggledGroupKeys.size === 0) {
        return
      }
      expansionExpandedByDefault = true
      toggledGroupKeys.clear()
      invalidateCaches()
      emit()
    },
    collapseAllGroups() {
      ensureActive()
      if (!getExpansionSpec()) {
        return
      }
      if (!expansionExpandedByDefault && toggledGroupKeys.size === 0) {
        return
      }
      expansionExpandedByDefault = false
      toggledGroupKeys.clear()
      invalidateCaches()
      emit()
    },
    async refresh(reason?: DataGridRowModelRefreshReason) {
      ensureActive()
      if (reason === "reset") {
        source.reset()
      }
      const warmup = warmViewportRange(viewportRange)
      setWarming(true)
      try {
        await warmup.promise
        if (disposed || warmup.token !== warmupToken) {
          return
        }
        setWarming(false)
        markCachesStale()
      } finally {
        if (disposed || warmup.token !== warmupToken) {
          return
        }
        setWarming(false)
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
      warmupToken += 1
      unsubscribeSource?.()
      inFlightViewportWarmup = null
      warming = false
      listeners.clear()
      rowNodeCache.clear()
      rowNodeCacheRevision.clear()
      lastRangeCacheRows = emptyRangeRows
    },
  }
}
