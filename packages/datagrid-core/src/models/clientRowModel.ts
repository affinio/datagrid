import type {
  UiTableFilterSnapshot,
  UiTableSortState,
  VisibleRow,
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

export interface CreateClientRowModelOptions<T> {
  rows?: readonly VisibleRow<T>[]
  initialSortModel?: readonly UiTableSortState[]
  initialFilterModel?: UiTableFilterSnapshot | null
}

export interface ClientRowModel<T> extends DataGridRowModel<T> {
  setRows(rows: readonly VisibleRow<T>[]): void
}

export function createClientRowModel<T>(
  options: CreateClientRowModelOptions<T> = {},
): ClientRowModel<T> {
  let rows: DataGridRowNode<T>[] = Array.isArray(options.rows)
    ? options.rows.map((row, index) => normalizeRowNode(row, index))
    : []
  let sortModel: readonly UiTableSortState[] = options.initialSortModel ? [...options.initialSortModel] : []
  let filterModel: UiTableFilterSnapshot | null = options.initialFilterModel ?? null
  let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, rows.length)
  let disposed = false
  const listeners = new Set<DataGridRowModelListener<T>>()

  function ensureActive() {
    if (disposed) {
      throw new Error("ClientRowModel has been disposed")
    }
  }

  function getSnapshot(): DataGridRowModelSnapshot<T> {
    viewportRange = normalizeViewportRange(viewportRange, rows.length)
    return {
      kind: "client",
      rowCount: rows.length,
      loading: false,
      error: null,
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

  return {
    kind: "client",
    getSnapshot,
    getRowCount() {
      return rows.length
    },
    getRow(index: number) {
      if (!Number.isFinite(index)) {
        return undefined
      }
      return rows[Math.max(0, Math.trunc(index))]
    },
    getRowsInRange(range: DataGridViewportRange) {
      const normalized = normalizeViewportRange(range, rows.length)
      if (rows.length === 0) {
        return []
      }
      return rows.slice(normalized.start, normalized.end + 1)
    },
    setRows(nextRows: readonly VisibleRow<T>[]) {
      ensureActive()
      rows = Array.isArray(nextRows)
        ? nextRows.map((row, index) => normalizeRowNode(row, index))
        : []
      viewportRange = normalizeViewportRange(viewportRange, rows.length)
      emit()
    },
    setViewportRange(range: DataGridViewportRange) {
      ensureActive()
      const nextRange = normalizeViewportRange(range, rows.length)
      if (nextRange.start === viewportRange.start && nextRange.end === viewportRange.end) {
        return
      }
      viewportRange = nextRange
      emit()
    },
    setSortModel(nextSortModel: readonly UiTableSortState[]) {
      ensureActive()
      sortModel = Array.isArray(nextSortModel) ? [...nextSortModel] : []
      emit()
    },
    setFilterModel(nextFilterModel: UiTableFilterSnapshot | null) {
      ensureActive()
      filterModel = nextFilterModel ?? null
      emit()
    },
    refresh(_reason?: DataGridRowModelRefreshReason) {
      ensureActive()
      emit()
    },
    subscribe(listener: DataGridRowModelListener<T>) {
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
      rows = []
    },
  }
}
