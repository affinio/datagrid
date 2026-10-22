import { shallowRef } from "vue"
import type { DataGridColumnSelectionSnapshot, DataGridCoreSelectionService } from "@affino/datagrid-core"
import {
  dataGridColumnSelectionSnapshotsEqual,
  normalizeDataGridColumnSelectionSnapshot,
} from "@affino/datagrid-core"

export function useDataGridAppColumnSelection() {
  const snapshot = shallowRef<DataGridColumnSelectionSnapshot | null>(null)
  const syncSnapshot = (value: DataGridColumnSelectionSnapshot | null): void => {
    const normalized = normalizeDataGridColumnSelectionSnapshot(value)
    const next = normalized.selectedColumnKeys.length === 0 ? null : normalized
    if (dataGridColumnSelectionSnapshotsEqual(snapshot.value, next)) {
      return
    }
    snapshot.value = next
  }

  const selectionService: DataGridCoreSelectionService = {
    name: "selection",
    getColumnSelectionSnapshot: () => snapshot.value,
    setColumnSelectionSnapshot: value => syncSnapshot(value),
    clearColumnSelection: () => syncSnapshot(null),
  }

  return { snapshot, selectionService }
}
