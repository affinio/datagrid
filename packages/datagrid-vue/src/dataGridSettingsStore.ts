import { defineStore } from "pinia"
import type {} from "./types/pinia-persist"
import type {
  DataGridColumnStateSnapshot,
  DataGridGroupState,
  DataGridPinPosition,
  DataGridSettingsAdapter,
} from "@affino/datagrid-core"

type DataGridStoredSortState = Parameters<DataGridSettingsAdapter["setSortState"]>[1]
type DataGridStoredFilterSnapshot = ReturnType<DataGridSettingsAdapter["getFilterSnapshot"]>

interface DataGridSettingsStoreState {
  columnStates: Record<string, DataGridColumnStateSnapshot>
  columnWidths: Record<string, Record<string, number>>
  sortStates: Record<string, DataGridStoredSortState>
  filterSnapshots: Record<string, DataGridStoredFilterSnapshot>
  pinStates: Record<string, Record<string, DataGridPinPosition>>
  groupStates: Record<string, DataGridGroupState>
}

const createMemoryStorage = () => {
  const data = new Map<string, string>()
  return {
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null
    },
    setItem(key: string, value: string) {
      data.set(key, value)
    },
    removeItem(key: string) {
      data.delete(key)
    },
    clear() {
      data.clear()
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null
    },
    get length() {
      return data.size
    },
  }
}

const dataGridSettingsStorage: Storage =
  typeof window !== "undefined" && window.localStorage
    ? window.localStorage
    : (createMemoryStorage() as unknown as Storage)

export const useDataGridSettingsStore = defineStore("dataGridSettingsStore", {
  state: (): DataGridSettingsStoreState => ({
    columnStates: {},
    columnWidths: {},
    sortStates: {},
    filterSnapshots: {},
    pinStates: {},
    groupStates: {},
  }),
  actions: {
    setColumnState(tableId: string, state: DataGridColumnStateSnapshot | null) {
      if (!state) {
        delete this.columnStates[tableId]
        return
      }
      this.columnStates[tableId] = structuredCloneSafe(state)
    },
    getColumnState(tableId: string): DataGridColumnStateSnapshot | null {
      const stored = this.columnStates[tableId]
      if (!stored) {
        return null
      }
      return structuredCloneSafe(stored)
    },
    setColumnWidth(tableId: string, columnKey: string, width: number) {
      if (!this.columnWidths[tableId]) {
        this.columnWidths[tableId] = {}
      }
      this.columnWidths[tableId][columnKey] = width
    },
    getColumnWidth(tableId: string, columnKey: string): number | undefined {
      return this.columnWidths[tableId]?.[columnKey]
    },
    setSortState(tableId: string, state: DataGridStoredSortState) {
      if (!state.length) {
        delete this.sortStates[tableId]
        return
      }
      this.sortStates[tableId] = state.map(item => ({ ...item }))
    },
    getSortState(tableId: string): DataGridStoredSortState | undefined {
      const stored = this.sortStates[tableId]
      return stored ? stored.map(item => ({ ...item })) : undefined
    },
    setFilterSnapshot(tableId: string, snapshot: DataGridStoredFilterSnapshot) {
      const isEmpty = !snapshot ||
        (Object.keys(snapshot.columnFilters ?? {}).length === 0 &&
          Object.keys(snapshot.advancedFilters ?? {}).length === 0)
      if (isEmpty) {
        delete this.filterSnapshots[tableId]
        return
      }
      this.filterSnapshots[tableId] = structuredCloneSafe(snapshot)
    },
    getFilterSnapshot(tableId: string): DataGridStoredFilterSnapshot {
      const stored = this.filterSnapshots[tableId]
      if (!stored) {
        return null
      }
      return structuredCloneSafe(stored)
    },
    setPinState(tableId: string, columnKey: string, position: DataGridPinPosition) {
      if (position === "none") {
        if (this.pinStates[tableId]) {
          delete this.pinStates[tableId][columnKey]
          if (Object.keys(this.pinStates[tableId]).length === 0) {
            delete this.pinStates[tableId]
          }
        }
        return
      }
      if (!this.pinStates[tableId]) {
        this.pinStates[tableId] = {}
      }
      this.pinStates[tableId][columnKey] = position
    },
    getPinState(tableId: string): Record<string, DataGridPinPosition> | null {
      const stored = this.pinStates[tableId]
      if (!stored) {
        return null
      }
      return { ...stored }
    },
    setGroupState(tableId: string, columns: string[], expansion: Record<string, boolean> = {}) {
      const uniqueColumns = Array.from(new Set(
        columns.filter(column => typeof column === "string" && column.length > 0),
      ))
      if (!uniqueColumns.length) {
        delete this.groupStates[tableId]
        return
      }
      const sanitizedExpansion: Record<string, boolean> = {}
      Object.entries(expansion).forEach(([groupKey, expanded]) => {
        if (typeof expanded === "boolean") {
          sanitizedExpansion[groupKey] = expanded
        }
      })
      this.groupStates[tableId] = {
        columns: uniqueColumns,
        expansion: sanitizedExpansion,
      }
    },
    getGroupState(tableId: string): DataGridGroupState | null {
      const stored = this.groupStates[tableId]
      if (!stored) {
        return null
      }
      return {
        columns: [...stored.columns],
        expansion: { ...stored.expansion },
      }
    },
    clearTable(tableId: string) {
      delete this.columnStates[tableId]
      delete this.columnWidths[tableId]
      delete this.sortStates[tableId]
      delete this.filterSnapshots[tableId]
      delete this.pinStates[tableId]
      delete this.groupStates[tableId]
    },
  },
  persist: {
    key: "affino-datagrid-settings",
    storage: dataGridSettingsStorage,
  },
})

export type DataGridSettingsStore = ReturnType<typeof useDataGridSettingsStore>

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value)
    } catch {
      // fall through
    }
  }
  return JSON.parse(JSON.stringify(value)) as T
}
