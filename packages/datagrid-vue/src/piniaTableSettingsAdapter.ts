import type { TableSettingsStore } from "./tableSettingsStore"
import type { UiTableSettingsAdapter } from "@affino/datagrid-core"

export function createPiniaTableSettingsAdapter(store: TableSettingsStore): UiTableSettingsAdapter {
  return {
    setColumnWidth(tableId, columnKey, width) {
      store.setColumnWidth(tableId, columnKey, width)
    },

    getColumnWidth(tableId, columnKey) {
      return store.getColumnWidth(tableId, columnKey)
    },

    setSortState(tableId, state) {
      store.setSortState(tableId, state)
    },

    getSortState(tableId) {
      return store.getSortState(tableId)
    },

    setFilterSnapshot(tableId, snapshot) {
      store.setFilterSnapshot(tableId, snapshot)
    },

    getFilterSnapshot(tableId) {
      return store.getFilterSnapshot(tableId)
    },

    setPinState(tableId, columnKey, position) {
      store.setPinState(tableId, columnKey, position)
    },

    getPinState(tableId) {
      return store.getPinState(tableId)
    },

    setGroupState(tableId, columns, expansion) {
      store.setGroupState(tableId, columns, expansion)
    },

    getGroupState(tableId) {
      return store.getGroupState(tableId)
    },

    clearTable(tableId) {
      store.clearTable(tableId)
    },
  }
}

export const createDataGridSettingsAdapter = createPiniaTableSettingsAdapter
