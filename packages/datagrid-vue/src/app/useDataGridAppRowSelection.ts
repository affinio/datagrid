import { ref, type Ref } from "vue"
import type { DataGridRowId, DataGridRowSelectionSnapshot } from "@affino/datagrid-core"
import {
  clearDataGridSelectedRows,
  dataGridRowSelectionSnapshotsEqual,
  deselectDataGridRows,
  normalizeDataGridRowSelectionSnapshot,
  reconcileDataGridRowSelectionSnapshot,
  selectDataGridRows,
  setDataGridRowFocused,
  setDataGridRowSelected,
} from "@affino/datagrid-core"
import type { UseDataGridRuntimeOptions, UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"

export interface UseDataGridAppRowSelectionOptions<TRow> {
  resolveRuntime?: () => Pick<UseDataGridRuntimeResult<TRow>, "api"> | null
}

export interface UseDataGridAppRowSelectionResult<TRow> {
  rowSelectionSnapshot: Ref<DataGridRowSelectionSnapshot | null>
  focusedRow: Ref<DataGridRowId | null>
  selectedRows: Ref<Set<DataGridRowId>>
  selectionService: NonNullable<NonNullable<UseDataGridRuntimeOptions<TRow>["services"]>["selection"]>
  runtimeServices: Pick<NonNullable<UseDataGridRuntimeOptions<TRow>["services"]>, "selection">
  syncRowSelectionSnapshotFromRuntime: () => void
  reconcileRowSelectionFromRuntime: () => void
}

function toNullableSnapshot(snapshot: DataGridRowSelectionSnapshot): DataGridRowSelectionSnapshot | null {
  return snapshot.focusedRow == null && snapshot.selectedRows.length === 0
    ? null
    : snapshot
}

export function useDataGridAppRowSelection<TRow>(
  options: UseDataGridAppRowSelectionOptions<TRow>,
): UseDataGridAppRowSelectionResult<TRow> {
  const rowSelectionSnapshot = ref<DataGridRowSelectionSnapshot | null>(null)
  const focusedRow = ref<DataGridRowId | null>(null)
  const selectedRows = ref<Set<DataGridRowId>>(new Set())

  const syncSnapshot = (snapshot: DataGridRowSelectionSnapshot | null): void => {
    const normalized = normalizeDataGridRowSelectionSnapshot(snapshot)
    const nextSnapshot = toNullableSnapshot(normalized)
    if (dataGridRowSelectionSnapshotsEqual(rowSelectionSnapshot.value, nextSnapshot)) {
      return
    }
    rowSelectionSnapshot.value = nextSnapshot
    focusedRow.value = normalized.focusedRow
    selectedRows.value = new Set(normalized.selectedRows)
  }

  const selectionService: NonNullable<NonNullable<UseDataGridRuntimeOptions<TRow>["services"]>["selection"]> = {
    name: "selection",
    getRowSelectionSnapshot: () => rowSelectionSnapshot.value,
    setRowSelectionSnapshot: snapshot => {
      syncSnapshot(snapshot)
    },
    clearRowSelection: () => {
      syncSnapshot(null)
    },
    getFocusedRow: () => focusedRow.value,
    setFocusedRow: rowId => {
      syncSnapshot(toNullableSnapshot(setDataGridRowFocused(rowSelectionSnapshot.value, rowId)))
    },
    getSelectedRows: () => [...selectedRows.value],
    isRowSelected: rowId => selectedRows.value.has(rowId),
    setRowSelected: (rowId, selected) => {
      syncSnapshot(toNullableSnapshot(setDataGridRowSelected(rowSelectionSnapshot.value, rowId, selected)))
    },
    selectRows: rowIds => {
      syncSnapshot(toNullableSnapshot(selectDataGridRows(rowSelectionSnapshot.value, rowIds)))
    },
    deselectRows: rowIds => {
      syncSnapshot(toNullableSnapshot(deselectDataGridRows(rowSelectionSnapshot.value, rowIds)))
    },
    clearSelectedRows: () => {
      syncSnapshot(toNullableSnapshot(clearDataGridSelectedRows(rowSelectionSnapshot.value)))
    },
  }

  const runtimeServices = {
    selection: selectionService,
  }

  const syncRowSelectionSnapshotFromRuntime = (): void => {
    const runtime = options.resolveRuntime?.() ?? null
    syncSnapshot(
      runtime?.api.rowSelection.hasSupport()
        ? runtime.api.rowSelection.getSnapshot()
        : null,
    )
  }

  const reconcileRowSelectionFromRuntime = (): void => {
    const runtime = options.resolveRuntime?.() ?? null
    if (!runtime?.api.rowSelection.hasSupport()) {
      syncSnapshot(null)
      return
    }
    const rowCount = runtime.api.rows.getCount()
    const allowedRowIds: DataGridRowId[] = []
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const rowId = runtime.api.rows.get(rowIndex)?.rowId
      if (rowId == null) {
        continue
      }
      allowedRowIds.push(rowId)
    }
    syncSnapshot(toNullableSnapshot(reconcileDataGridRowSelectionSnapshot(rowSelectionSnapshot.value, allowedRowIds)))
  }

  return {
    rowSelectionSnapshot,
    focusedRow,
    selectedRows,
    selectionService,
    runtimeServices,
    syncRowSelectionSnapshotFromRuntime,
    reconcileRowSelectionFromRuntime,
  }
}