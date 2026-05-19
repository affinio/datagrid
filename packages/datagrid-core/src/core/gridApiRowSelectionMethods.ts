import type { DataGridRowSelectionSnapshot } from "../selection/rowSelection"
import type {
  DataGridRowId,
  DataGridRowModel,
} from "../models/index.js"
import {
  assertRowSelectionCapability,
  type DataGridRowSelectionCapability,
} from "./gridApiCapabilities"

export interface DataGridApiRowSelectionMethods<TRow = unknown> {
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
  getSelectedRowData: () => TRow[]
}

export interface CreateDataGridApiRowSelectionMethodsInput<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  getRowSelectionCapability: () => DataGridRowSelectionCapability | null
  onChanged?: (snapshot: DataGridRowSelectionSnapshot | null) => void
}

export function createDataGridApiRowSelectionMethods<TRow = unknown>(
  input: CreateDataGridApiRowSelectionMethodsInput<TRow>,
): DataGridApiRowSelectionMethods<TRow> {
  const { rowModel, getRowSelectionCapability, onChanged } = input

  const rowIdSignature = (rowId: DataGridRowId): string => `${typeof rowId}:${String(rowId)}`

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
    getSelectedRowData() {
      const snapshot = getRowSelectionCapability()?.getRowSelectionSnapshot() ?? null
      if (!snapshot) {
        return []
      }

      const rows: TRow[] = []
      if (snapshot.mode === "all") {
        const excluded = new Set(snapshot.excludedRows?.map(rowIdSignature) ?? [])
        for (let index = 0; index < rowModel.getRowCount(); index += 1) {
          const rowNode = rowModel.getRow(index)
          if (rowNode?.kind === "leaf" && !excluded.has(rowIdSignature(rowNode.rowId))) {
            rows.push(rowNode.data)
          }
        }
        return rows
      }

      const selected = new Set(snapshot.selectedRows.map(rowIdSignature))
      const emitted = new Set<string>()
      for (let index = 0; index < rowModel.getRowCount(); index += 1) {
        const rowNode = rowModel.getRow(index)
        if (rowNode?.kind !== "leaf") {
          continue
        }
        const signature = rowIdSignature(rowNode.rowId)
        if (!selected.has(signature) || emitted.has(signature)) {
          continue
        }
        emitted.add(signature)
        rows.push(rowNode.data)
      }
      return rows
    },
  }
}
