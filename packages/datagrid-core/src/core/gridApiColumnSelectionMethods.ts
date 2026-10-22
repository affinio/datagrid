import type { DataGridColumnSelectionSnapshot } from "../selection/columnSelection.js"
import {
  dataGridColumnSelectionSnapshotsEqual,
  deselectDataGridColumns,
  normalizeDataGridColumnSelectionSnapshot,
  selectDataGridColumns,
  setDataGridColumnSelected,
} from "../selection/columnSelection.js"
import type { DataGridChangeContext, DataGridApiColumnSelectionNamespace } from "./gridApiContracts.js"
import {
  assertColumnSelectionCapability,
  type DataGridColumnSelectionCapability,
} from "./gridApiCapabilities.js"

export interface DataGridApiColumnSelectionMethods {
  hasColumnSelectionSupport: DataGridApiColumnSelectionNamespace["hasSupport"]
  getColumnSelectionSnapshot: DataGridApiColumnSelectionNamespace["getSnapshot"]
  setColumnSelectionSnapshot: DataGridApiColumnSelectionNamespace["setSnapshot"]
  clearColumnSelection: DataGridApiColumnSelectionNamespace["clear"]
  getSelectedColumns: DataGridApiColumnSelectionNamespace["getSelectedColumns"]
  isColumnSelected: DataGridApiColumnSelectionNamespace["isSelected"]
  setColumnSelected: DataGridApiColumnSelectionNamespace["setSelected"]
  selectColumns: DataGridApiColumnSelectionNamespace["selectColumns"]
  deselectColumns: DataGridApiColumnSelectionNamespace["deselectColumns"]
  clearSelectedColumns: DataGridApiColumnSelectionNamespace["clearSelectedColumns"]
}

export interface CreateDataGridApiColumnSelectionMethodsInput {
  getColumnSelectionCapability: () => DataGridColumnSelectionCapability | null
  onChanged?: (snapshot: DataGridColumnSelectionSnapshot | null, context?: DataGridChangeContext) => void
}

export function createDataGridApiColumnSelectionMethods(
  input: CreateDataGridApiColumnSelectionMethodsInput,
): DataGridApiColumnSelectionMethods {
  const { getColumnSelectionCapability, onChanged } = input

  const mutate = (
    next: (snapshot: DataGridColumnSelectionSnapshot | null) => DataGridColumnSelectionSnapshot,
    context?: DataGridChangeContext,
  ): void => {
    const capability = assertColumnSelectionCapability(getColumnSelectionCapability())
    const previous = capability.getColumnSelectionSnapshot()
    const normalized = next(previous)
    if (dataGridColumnSelectionSnapshotsEqual(previous, normalized)) return
    capability.setColumnSelectionSnapshot(normalized)
    onChanged?.(normalizeDataGridColumnSelectionSnapshot(capability.getColumnSelectionSnapshot()), context)
  }

  return {
    hasColumnSelectionSupport() {
      return getColumnSelectionCapability() !== null
    },
    getColumnSelectionSnapshot() {
      const snapshot = getColumnSelectionCapability()?.getColumnSelectionSnapshot() ?? null
      return snapshot ? normalizeDataGridColumnSelectionSnapshot(snapshot) : null
    },
    setColumnSelectionSnapshot(snapshot, context) {
      mutate(() => normalizeDataGridColumnSelectionSnapshot(snapshot), context)
    },
    clearColumnSelection(context) {
      const capability = assertColumnSelectionCapability(getColumnSelectionCapability())
      const previous = capability.getColumnSelectionSnapshot()
      if (previous == null || previous.selectedColumnKeys.length === 0) return
      capability.clearColumnSelection()
      onChanged?.(capability.getColumnSelectionSnapshot(), context)
    },
    getSelectedColumns() {
      const snapshot = getColumnSelectionCapability()?.getColumnSelectionSnapshot() ?? null
      return snapshot ? normalizeDataGridColumnSelectionSnapshot(snapshot).selectedColumnKeys : []
    },
    isColumnSelected(columnKey) {
      return getColumnSelectionCapability()?.getColumnSelectionSnapshot()?.selectedColumnKeys.includes(columnKey) ?? false
    },
    setColumnSelected(columnKey, selected, context) {
      mutate(snapshot => setDataGridColumnSelected(snapshot, columnKey, selected), context)
    },
    selectColumns(columnKeys, context) {
      const keys = [...columnKeys]
      mutate(snapshot => selectDataGridColumns(snapshot, keys), context)
    },
    deselectColumns(columnKeys, context) {
      const keys = [...columnKeys]
      mutate(snapshot => deselectDataGridColumns(snapshot, keys), context)
    },
    clearSelectedColumns(context) {
      const capability = assertColumnSelectionCapability(getColumnSelectionCapability())
      const previous = capability.getColumnSelectionSnapshot()
      if (previous == null || previous.selectedColumnKeys.length === 0) return
      capability.clearColumnSelection()
      onChanged?.(capability.getColumnSelectionSnapshot(), context)
    },
  }
}
