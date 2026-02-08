import {
  normalizeRowNode,
  normalizeViewportRange,
  withResolvedRowIdentity,
  type DataGridFilterSnapshot,
  type DataGridRowIdResolver,
  type DataGridRowNode,
  type DataGridRowNodeInput,
  type DataGridRowModel,
  type DataGridRowModelListener,
  type DataGridRowModelRefreshReason,
  type DataGridRowModelSnapshot,
  type DataGridSortState,
  type DataGridViewportRange,
} from "./rowModel.js"

export interface CreateClientRowModelOptions<T> {
  rows?: readonly DataGridRowNodeInput<T>[]
  resolveRowId?: DataGridRowIdResolver<T>
  initialSortModel?: readonly DataGridSortState[]
  initialFilterModel?: DataGridFilterSnapshot | null
}

export interface ClientRowModel<T> extends DataGridRowModel<T> {
  setRows(rows: readonly DataGridRowNodeInput<T>[]): void
}

export function createClientRowModel<T>(
  options: CreateClientRowModelOptions<T> = {},
): ClientRowModel<T> {
  const structuredCloneRef = (globalThis as typeof globalThis & {
    structuredClone?: <U>(value: U) => U
  }).structuredClone

  const cloneSortModel = (input: readonly DataGridSortState[]): readonly DataGridSortState[] =>
    input.map(item => ({ ...item }))

  const cloneFilterModel = (
    input: DataGridFilterSnapshot | null,
  ): DataGridFilterSnapshot | null => {
    if (!input) {
      return null
    }
    if (typeof structuredCloneRef === "function") {
      try {
        return structuredCloneRef(input)
      } catch {
        // Fall through to deterministic JS clone for non-cloneable payloads.
      }
    }
    return {
      columnFilters: Object.fromEntries(
        Object.entries(input.columnFilters ?? {}).map(([key, values]) => [key, [...values]]),
      ),
      advancedFilters: Object.fromEntries(
        Object.entries(input.advancedFilters ?? {}).map(([key, condition]) => [
          key,
          {
            ...condition,
            clauses: Array.isArray(condition?.clauses)
              ? condition.clauses.map(clause => ({ ...clause }))
              : [],
          },
        ]),
      ),
    }
  }

  const resolveRowId = options.resolveRowId
  let rows: DataGridRowNode<T>[] = Array.isArray(options.rows)
    ? options.rows.map((row, index) => normalizeRowNode(withResolvedRowIdentity(row, index, resolveRowId), index))
    : []
  let sortModel: readonly DataGridSortState[] = options.initialSortModel ? cloneSortModel(options.initialSortModel) : []
  let filterModel: DataGridFilterSnapshot | null = cloneFilterModel(options.initialFilterModel ?? null)
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
      sortModel: cloneSortModel(sortModel),
      filterModel: cloneFilterModel(filterModel),
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
    setRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      ensureActive()
      rows = Array.isArray(nextRows)
        ? nextRows.map((row, index) => normalizeRowNode(withResolvedRowIdentity(row, index, resolveRowId), index))
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
    setSortModel(nextSortModel: readonly DataGridSortState[]) {
      ensureActive()
      sortModel = Array.isArray(nextSortModel) ? cloneSortModel(nextSortModel) : []
      emit()
    },
    setFilterModel(nextFilterModel: DataGridFilterSnapshot | null) {
      ensureActive()
      filterModel = cloneFilterModel(nextFilterModel ?? null)
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
