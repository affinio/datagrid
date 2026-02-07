import type { ServerRowModel } from "../serverRowModel/serverRowModel"
import type {
  UiTableFilterSnapshot,
  UiTableSortState,
} from "../types"
import {
  normalizeRowNode,
  normalizeViewportRange,
  type DataGridRowNode,
  type DataGridRowModel,
  type DataGridRowModelListener,
  type DataGridRowModelRefreshReason,
  type DataGridRowModelSnapshot,
  type DataGridViewportRange,
} from "./rowModel"

export interface CreateServerBackedRowModelOptions<T> {
  source: ServerRowModel<T>
  initialSortModel?: readonly UiTableSortState[]
  initialFilterModel?: UiTableFilterSnapshot | null
}

export interface ServerBackedRowModel<T> extends DataGridRowModel<T> {
  readonly source: ServerRowModel<T>
  syncFromSource(): void
}

export function createServerBackedRowModel<T>(
  options: CreateServerBackedRowModelOptions<T>,
): ServerBackedRowModel<T> {
  const { source } = options
  let sortModel: readonly UiTableSortState[] = options.initialSortModel ? [...options.initialSortModel] : []
  let filterModel: UiTableFilterSnapshot | null = options.initialFilterModel ?? null
  let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, source.getRowCount())
  let disposed = false
  const listeners = new Set<DataGridRowModelListener<T>>()

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

  async function warmViewportRange(range: DataGridViewportRange): Promise<void> {
    const start = Math.max(0, Math.trunc(range.start))
    const end = Math.max(start, Math.trunc(range.end))
    await source.fetchBlock(start)
    if (end !== start) {
      await source.fetchBlock(end)
    }
  }

  function toVisibleRow(index: number): DataGridRowNode<T> | undefined {
    const row = source.getRowAt(index)
    if (typeof row === "undefined") {
      return undefined
    }
    return normalizeRowNode({
      row,
      rowId: index,
      originalIndex: index,
      displayIndex: index,
    }, index)
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
      const normalized = Math.max(0, Math.trunc(index))
      return toVisibleRow(normalized)
    },
    getRowsInRange(range) {
      const normalized = normalizeViewportRange(range, source.getRowCount())
      const rows: DataGridRowNode<T>[] = []
      for (let index = normalized.start; index <= normalized.end; index += 1) {
        const row = toVisibleRow(index)
        if (row) {
          rows.push(row)
        }
      }
      return rows
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
          emit()
        })
        .catch(() => {
          emit()
        })
      emit()
    },
    setSortModel(nextSortModel) {
      ensureActive()
      sortModel = Array.isArray(nextSortModel) ? [...nextSortModel] : []
      emit()
    },
    setFilterModel(nextFilterModel) {
      ensureActive()
      filterModel = nextFilterModel ?? null
      emit()
    },
    async refresh(reason?: DataGridRowModelRefreshReason) {
      ensureActive()
      if (reason === "reset") {
        source.reset()
      }
      try {
        await warmViewportRange(viewportRange)
      } finally {
        emit()
      }
    },
    syncFromSource() {
      ensureActive()
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
    },
  }
}
