import type { ServerRowModel } from "../serverRowModel/serverRowModel"
import {
  buildGroupExpansionSnapshot,
  cloneGroupBySpec,
  isSameGroupBySpec,
  normalizeRowNode,
  normalizeGroupBySpec,
  normalizeViewportRange,
  toggleGroupExpansionKey,
  type DataGridRowId,
  type DataGridRowIdResolver,
  type DataGridFilterSnapshot,
  type DataGridGroupBySpec,
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
}

export interface ServerBackedRowModel<T> extends DataGridRowModel<T> {
  readonly source: ServerRowModel<T>
  syncFromSource(): void
}

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
  const toggledGroupKeys = new Set<string>()
  let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, source.getRowCount())
  let disposed = false
  let cacheRevision = 0
  let lastRangeCacheKey = ""
  let lastRangeCacheRows: readonly DataGridRowNode<T>[] = []
  const listeners = new Set<DataGridRowModelListener<T>>()
  const rowNodeCache = new Map<number, DataGridRowNode<T> | undefined>()

  function ensureActive() {
    if (disposed) {
      throw new Error("ServerBackedRowModel has been disposed")
    }
  }

  function getSnapshot(): DataGridRowModelSnapshot<T> {
    const rowCount = source.getRowCount()
    viewportRange = normalizeViewportRange(viewportRange, rowCount)
    return {
      kind: "server",
      rowCount,
      loading: Boolean(source.loading.value),
      error: source.error.value ?? null,
      viewportRange,
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
  }

  function invalidateCachesForRange(range: DataGridViewportRange) {
    const normalized = normalizeViewportRange(range, source.getRowCount())
    for (let index = normalized.start; index <= normalized.end; index += 1) {
      rowNodeCache.delete(index)
    }
    cacheRevision += 1
    lastRangeCacheKey = ""
    lastRangeCacheRows = []
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
    const start = Math.max(0, Math.trunc(range.start))
    const end = Math.max(start, Math.trunc(range.end))
    await source.fetchBlock(start)
    if (end !== start) {
      await source.fetchBlock(end)
    }
  }

  function toRowNode(index: number): DataGridRowNode<T> | undefined {
    if (rowNodeCache.has(index)) {
      return rowNodeCache.get(index)
    }
    const row = source.getRowAt(index)
    if (typeof row === "undefined") {
      rowNodeCache.set(index, undefined)
      return undefined
    }
    const rowId = resolveRowId(row, index) as DataGridRowId
    if (typeof rowId !== "string" && typeof rowId !== "number") {
      throw new Error(`[DataGrid] Invalid row identity returned for index ${index}. Expected string|number.`)
    }
    const normalized = normalizeRowNode({
      row,
      rowId,
      originalIndex: index,
      displayIndex: index,
    }, index)
    rowNodeCache.set(index, normalized)
    return normalized
  }

  return {
    kind: "server",
    source,
    getSnapshot,
    getRowCount() {
      return source.getRowCount()
    },
    getRow(index) {
      if (!Number.isFinite(index)) {
        return undefined
      }
      const rowCount = source.getRowCount()
      const normalized = Math.max(0, Math.trunc(index))
      if (normalized >= rowCount) {
        return undefined
      }
      return toRowNode(normalized)
    },
    getRowsInRange(range) {
      const normalized = normalizeViewportRange(range, source.getRowCount())
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
      const nextRange = normalizeViewportRange(range, source.getRowCount())
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
