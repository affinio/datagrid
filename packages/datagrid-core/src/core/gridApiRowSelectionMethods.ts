import type { DataGridRowSelectionSnapshot } from "../selection/rowSelection"
import { dataGridRowSelectionSnapshotsEqual } from "../selection/rowSelection"
import type {
  DataGridRowId,
  DataGridRowModel,
} from "../models/index.js"
import {
  assertRowSelectionCapability,
  type DataGridRowSelectionCapability,
} from "./gridApiCapabilities"
import type { DataGridChangeContext } from "./gridApiContracts"

export interface DataGridApiRowSelectionMethods<TRow = unknown> {
  hasRowSelectionSupport: () => boolean
  getRowSelectionSnapshot: () => DataGridRowSelectionSnapshot | null
  setRowSelectionSnapshot: (snapshot: DataGridRowSelectionSnapshot, context?: DataGridChangeContext) => void
  clearRowSelection: (context?: DataGridChangeContext) => void
  getFocusedRow: () => string | number | null
  setFocusedRow: (rowId: string | number | null, context?: DataGridChangeContext) => void
  getSelectedRows: () => readonly (string | number)[]
  isRowSelected: (rowId: string | number) => boolean
  setRowSelected: (rowId: string | number, selected: boolean, context?: DataGridChangeContext) => void
  selectRows: (rowIds: Iterable<string | number>, context?: DataGridChangeContext) => void
  deselectRows: (rowIds: Iterable<string | number>, context?: DataGridChangeContext) => void
  clearSelectedRows: (context?: DataGridChangeContext) => void
  getSelectedRowData: () => TRow[]
}

export interface CreateDataGridApiRowSelectionMethodsInput<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  getRowSelectionCapability: () => DataGridRowSelectionCapability | null
  onChanged?: (snapshot: DataGridRowSelectionSnapshot | null, context?: DataGridChangeContext) => void
}

export function createDataGridApiRowSelectionMethods<TRow = unknown>(
  input: CreateDataGridApiRowSelectionMethodsInput<TRow>,
): DataGridApiRowSelectionMethods<TRow> {
  const { rowModel, getRowSelectionCapability, onChanged } = input

  const rowIdSignature = (rowId: DataGridRowId): string => `${typeof rowId}:${String(rowId)}`
  const mutate = (operation: (capability: DataGridRowSelectionCapability) => void, context?: DataGridChangeContext): void => {
    const capability = assertRowSelectionCapability(getRowSelectionCapability())
    const previous = capability.getRowSelectionSnapshot()
    operation(capability)
    const next = capability.getRowSelectionSnapshot()
    if (!dataGridRowSelectionSnapshotsEqual(previous, next)) onChanged?.(next, context)
  }

  return {
    hasRowSelectionSupport() {
      return getRowSelectionCapability() !== null
    },
    getRowSelectionSnapshot() {
      return getRowSelectionCapability()?.getRowSelectionSnapshot() ?? null
    },
    setRowSelectionSnapshot(snapshot, context) {
      mutate(capability => capability.setRowSelectionSnapshot(snapshot), context)
    },
    clearRowSelection(context) {
      mutate(capability => capability.clearRowSelection(), context)
    },
    getFocusedRow() {
      return getRowSelectionCapability()?.getFocusedRow() ?? null
    },
    setFocusedRow(rowId, context) {
      mutate(capability => capability.setFocusedRow(rowId), context)
    },
    getSelectedRows() {
      return getRowSelectionCapability()?.getSelectedRows() ?? []
    },
    isRowSelected(rowId) {
      return getRowSelectionCapability()?.isRowSelected(rowId) ?? false
    },
    setRowSelected(rowId, selected, context) {
      mutate(capability => capability.setRowSelected(rowId, selected), context)
    },
    selectRows(rowIds, context) {
      const rowIdsSnapshot = [...rowIds]
      mutate(capability => capability.selectRows(rowIdsSnapshot), context)
    },
    deselectRows(rowIds, context) {
      const rowIdsSnapshot = [...rowIds]
      mutate(capability => capability.deselectRows(rowIdsSnapshot), context)
    },
    clearSelectedRows(context) {
      mutate(capability => capability.clearSelectedRows(), context)
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
