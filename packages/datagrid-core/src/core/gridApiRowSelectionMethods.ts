import type { DataGridRowSelectionSnapshot } from "../selection/rowSelection"
import {
  assertRowSelectionCapability,
  type DataGridRowSelectionCapability,
} from "./gridApiCapabilities"

export interface DataGridApiRowSelectionMethods {
  hasRowSelectionSupport: () => boolean
  getRowSelectionSnapshot: () => DataGridRowSelectionSnapshot | null
  setRowSelectionSnapshot: (snapshot: DataGridRowSelectionSnapshot) => void
  clearRowSelection: () => void
  getFocusedRow: () => string | number | null
  setFocusedRow: (rowId: string | number | null) => void
  getSelectedRows: () => readonly (string | number)[]
  isRowSelected: (rowId: string | number) => boolean
  setRowSelected: (rowId: string | number, selected: boolean) => void
  selectRows: (rowIds: Iterable<string | number>) => void
  deselectRows: (rowIds: Iterable<string | number>) => void
  clearSelectedRows: () => void
}

export interface CreateDataGridApiRowSelectionMethodsInput {
  getRowSelectionCapability: () => DataGridRowSelectionCapability | null
  onChanged?: (snapshot: DataGridRowSelectionSnapshot | null) => void
}

export function createDataGridApiRowSelectionMethods(
  input: CreateDataGridApiRowSelectionMethodsInput,
): DataGridApiRowSelectionMethods {
  const { getRowSelectionCapability, onChanged } = input

  return {
    hasRowSelectionSupport() {
      return getRowSelectionCapability() !== null
    },
    getRowSelectionSnapshot() {
      return getRowSelectionCapability()?.getRowSelectionSnapshot() ?? null
    },
    setRowSelectionSnapshot(snapshot) {
      const capability = assertRowSelectionCapability(getRowSelectionCapability())
      capability.setRowSelectionSnapshot(snapshot)
      onChanged?.(capability.getRowSelectionSnapshot())
    },
    clearRowSelection() {
      const capability = assertRowSelectionCapability(getRowSelectionCapability())
      capability.clearRowSelection()
      onChanged?.(capability.getRowSelectionSnapshot())
    },
    getFocusedRow() {
      return getRowSelectionCapability()?.getFocusedRow() ?? null
    },
    setFocusedRow(rowId) {
      const capability = assertRowSelectionCapability(getRowSelectionCapability())
      capability.setFocusedRow(rowId)
      onChanged?.(capability.getRowSelectionSnapshot())
    },
    getSelectedRows() {
      return getRowSelectionCapability()?.getSelectedRows() ?? []
    },
    isRowSelected(rowId) {
      return getRowSelectionCapability()?.isRowSelected(rowId) ?? false
    },
    setRowSelected(rowId, selected) {
      const capability = assertRowSelectionCapability(getRowSelectionCapability())
      capability.setRowSelected(rowId, selected)
      onChanged?.(capability.getRowSelectionSnapshot())
    },
    selectRows(rowIds) {
      const capability = assertRowSelectionCapability(getRowSelectionCapability())
      capability.selectRows(rowIds)
      onChanged?.(capability.getRowSelectionSnapshot())
    },
    deselectRows(rowIds) {
      const capability = assertRowSelectionCapability(getRowSelectionCapability())
      capability.deselectRows(rowIds)
      onChanged?.(capability.getRowSelectionSnapshot())
    },
    clearSelectedRows() {
      const capability = assertRowSelectionCapability(getRowSelectionCapability())
      capability.clearSelectedRows()
      onChanged?.(capability.getRowSelectionSnapshot())
    },
  }
}