import {
  clearDataGridSelectedRows,
  deselectDataGridRows,
  isDataGridRowSelected,
  normalizeDataGridRowSelectionSnapshot,
  selectDataGridRows,
  setDataGridRowFocused,
  setDataGridRowSelected,
  type DataGridCoreSelectionService,
  type DataGridRowId,
  type DataGridRowSelectionSnapshot,
  type DataGridSelectionSnapshot,
} from "@affino/datagrid-core"

/** Provides the canonical cell-selection snapshot storage used by Core's API. */
export function createDomSelectionService(enableRowSelection = false): DataGridCoreSelectionService {
  let snapshot: DataGridSelectionSnapshot | null = null
  let rowSelection: DataGridRowSelectionSnapshot | null = null

  return {
    name: "selection",
    getSelectionSnapshot: () => snapshot,
    setSelectionSnapshot: nextSnapshot => {
      snapshot = nextSnapshot
    },
    clearSelection: () => {
      snapshot = null
    },
    ...(enableRowSelection ? {
      getRowSelectionSnapshot: () => rowSelection,
      setRowSelectionSnapshot: (next: DataGridRowSelectionSnapshot) => { rowSelection = normalizeDataGridRowSelectionSnapshot(next) },
      clearRowSelection: () => { rowSelection = null },
      getFocusedRow: () => rowSelection?.focusedRow ?? null,
      setFocusedRow: (rowId: DataGridRowId | null) => { rowSelection = setDataGridRowFocused(rowSelection, rowId) },
      getSelectedRows: () => rowSelection?.selectedRows ?? [],
      isRowSelected: (rowId: DataGridRowId) => isDataGridRowSelected(rowSelection, rowId),
      setRowSelected: (rowId: DataGridRowId, selected: boolean) => { rowSelection = setDataGridRowSelected(rowSelection, rowId, selected) },
      selectRows: (rowIds: Iterable<DataGridRowId>) => { rowSelection = selectDataGridRows(rowSelection, rowIds) },
      deselectRows: (rowIds: Iterable<DataGridRowId>) => { rowSelection = deselectDataGridRows(rowSelection, rowIds) },
      clearSelectedRows: () => { rowSelection = clearDataGridSelectedRows(rowSelection) },
    } : {}),
    dispose: () => {
      snapshot = null
      rowSelection = null
    },
  }
}
