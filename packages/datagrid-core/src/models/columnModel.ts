import type { UiTableColumn } from "../types"

export type DataGridColumnPin = "left" | "right" | "none"

export interface DataGridColumnSnapshot {
  key: string
  visible: boolean
  pin: DataGridColumnPin
  width: number | null
  column: UiTableColumn
}

export interface DataGridColumnModelSnapshot {
  columns: readonly DataGridColumnSnapshot[]
  order: readonly string[]
  visibleColumns: readonly DataGridColumnSnapshot[]
}

export type DataGridColumnModelListener = (snapshot: DataGridColumnModelSnapshot) => void

export interface DataGridColumnModel {
  getSnapshot(): DataGridColumnModelSnapshot
  getColumn(key: string): DataGridColumnSnapshot | undefined
  setColumns(columns: readonly UiTableColumn[]): void
  setColumnOrder(keys: readonly string[]): void
  setColumnVisibility(key: string, visible: boolean): void
  setColumnWidth(key: string, width: number | null): void
  setColumnPin(key: string, pin: DataGridColumnPin): void
  subscribe(listener: DataGridColumnModelListener): () => void
  dispose(): void
}

export interface CreateDataGridColumnModelOptions {
  columns?: readonly UiTableColumn[]
}

interface MutableColumnState {
  column: UiTableColumn
  visible: boolean
  pin: DataGridColumnPin
  width: number | null
}

function normalizePin(pin: UiTableColumn["pin"] | DataGridColumnPin | undefined): DataGridColumnPin {
  if (pin === "left" || pin === "right") {
    return pin
  }
  return "none"
}

function normalizeWidth(width: number | undefined | null): number | null {
  if (!Number.isFinite(width)) {
    return null
  }
  return Math.max(0, Math.trunc(width as number))
}

export function createDataGridColumnModel(
  options: CreateDataGridColumnModelOptions = {},
): DataGridColumnModel {
  let disposed = false
  const listeners = new Set<DataGridColumnModelListener>()
  const columnsByKey = new Map<string, MutableColumnState>()
  let order: string[] = []

  function ensureActive() {
    if (disposed) {
      throw new Error("DataGridColumnModel has been disposed")
    }
  }

  function materializeSnapshot(): DataGridColumnModelSnapshot {
    const columns = order
      .map(key => {
        const state = columnsByKey.get(key)
        if (!state) {
          return null
        }
        return {
          key,
          visible: state.visible,
          pin: state.pin,
          width: state.width,
          column: state.column,
        } satisfies DataGridColumnSnapshot
      })
      .filter((entry): entry is DataGridColumnSnapshot => entry !== null)

    return {
      columns,
      order: [...order],
      visibleColumns: columns.filter(column => column.visible),
    }
  }

  function emit() {
    if (disposed || listeners.size === 0) {
      return
    }
    const snapshot = materializeSnapshot()
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  function setColumnsValue(columns: readonly UiTableColumn[]) {
    columnsByKey.clear()
    order = []
    for (const column of columns) {
      if (!column || typeof column.key !== "string" || column.key.length === 0) {
        continue
      }
      columnsByKey.set(column.key, {
        column,
        visible: column.visible !== false,
        pin: normalizePin(column.pin),
        width: normalizeWidth(column.width),
      })
      order.push(column.key)
    }
    emit()
  }

  setColumnsValue(Array.isArray(options.columns) ? options.columns : [])

  return {
    getSnapshot() {
      return materializeSnapshot()
    },
    getColumn(key: string) {
      const state = columnsByKey.get(key)
      if (!state) {
        return undefined
      }
      return {
        key,
        visible: state.visible,
        pin: state.pin,
        width: state.width,
        column: state.column,
      }
    },
    setColumns(columns: readonly UiTableColumn[]) {
      ensureActive()
      setColumnsValue(Array.isArray(columns) ? columns : [])
    },
    setColumnOrder(keys: readonly string[]) {
      ensureActive()
      const nextOrder: string[] = []
      const seen = new Set<string>()

      for (const key of keys) {
        if (!columnsByKey.has(key) || seen.has(key)) {
          continue
        }
        seen.add(key)
        nextOrder.push(key)
      }

      for (const key of order) {
        if (seen.has(key)) {
          continue
        }
        seen.add(key)
        nextOrder.push(key)
      }

      order = nextOrder
      emit()
    },
    setColumnVisibility(key: string, visible: boolean) {
      ensureActive()
      const state = columnsByKey.get(key)
      if (!state || state.visible === visible) {
        return
      }
      state.visible = visible
      emit()
    },
    setColumnWidth(key: string, width: number | null) {
      ensureActive()
      const state = columnsByKey.get(key)
      if (!state) {
        return
      }
      const nextWidth = normalizeWidth(width)
      if (state.width === nextWidth) {
        return
      }
      state.width = nextWidth
      emit()
    },
    setColumnPin(key: string, pin: DataGridColumnPin) {
      ensureActive()
      const state = columnsByKey.get(key)
      if (!state) {
        return
      }
      const nextPin = normalizePin(pin)
      if (state.pin === nextPin) {
        return
      }
      state.pin = nextPin
      emit()
    },
    subscribe(listener: DataGridColumnModelListener) {
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
      columnsByKey.clear()
      order = []
    },
  }
}
