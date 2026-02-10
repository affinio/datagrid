import type { DataGridSettingsAdapter } from "@affino/datagrid-core"
import type { DataGridSettingsStore } from "./dataGridSettingsStore"

export function createDataGridSettingsAdapter(
  store: DataGridSettingsStore,
): DataGridSettingsAdapter {
  return {
    setColumnState(tableId, state) {
      store.setColumnState(tableId, state)
    },
    getColumnState(tableId) {
      return store.getColumnState(tableId)
    },
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
