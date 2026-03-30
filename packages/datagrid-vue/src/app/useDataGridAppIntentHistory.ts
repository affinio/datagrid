import type { DataGridIntentTransactionDescriptor } from "../advanced"
import { useDataGridIntentHistory } from "../advanced"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"

export interface DataGridAppRowSnapshot<TRow> {
  kind: "full" | "partial"
  rows: Array<{ rowId: string | number; row: TRow }>
}

export interface UseDataGridAppIntentHistoryOptions<TRow> {
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api" | "getBodyRowAtIndex" | "resolveBodyRowIndexById">
  cloneRowData: (row: TRow) => TRow
  syncViewport: () => void
}

export interface UseDataGridAppIntentHistoryResult<TRow> {
  captureRowsSnapshot: () => DataGridAppRowSnapshot<TRow>
  captureRowsSnapshotByIds: (rowIds: readonly (string | number)[]) => DataGridAppRowSnapshot<TRow>
  canUndo: ReturnType<typeof useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>>["canUndo"]
  canRedo: ReturnType<typeof useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>>["canRedo"]
  runHistoryAction: ReturnType<typeof useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>>["runHistoryAction"]
  recordIntentTransaction: ReturnType<typeof useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>>["recordIntentTransaction"]
  dispose: ReturnType<typeof useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>>["dispose"]
}

export function useDataGridAppIntentHistory<TRow>(
  options: UseDataGridAppIntentHistoryOptions<TRow>,
): UseDataGridAppIntentHistoryResult<TRow> {
  const resolveRuntimeRowById = (rowId: string | number) => {
    const rowIndex = options.runtime.resolveBodyRowIndexById(rowId)
    if (rowIndex >= 0) {
      return options.runtime.getBodyRowAtIndex(rowIndex) ?? options.runtime.api.rows.get(rowIndex)
    }
    const count = options.runtime.api.rows.getCount()
    for (let candidateIndex = 0; candidateIndex < count; candidateIndex += 1) {
      const candidate = options.runtime.api.rows.get(candidateIndex)
      if (candidate?.rowId === rowId) {
        return candidate
      }
    }
    return null
  }

  const captureRowsSnapshot = (): DataGridAppRowSnapshot<TRow> => {
    const count = options.runtime.api.rows.getCount()
    const snapshotRows: Array<{ rowId: string | number; row: TRow }> = []
    for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
      const node = options.runtime.api.rows.get(rowIndex)
      if (!node || node.rowId == null || node.kind === "group") {
        continue
      }
      snapshotRows.push({
        rowId: node.rowId,
        row: options.cloneRowData(node.data as TRow),
      })
    }
    return { kind: "full", rows: snapshotRows }
  }

  const captureRowsSnapshotByIds = (
    rowIds: readonly (string | number)[],
  ): DataGridAppRowSnapshot<TRow> => {
    const snapshotRows: Array<{ rowId: string | number; row: TRow }> = []
    const seen = new Set<string | number>()
    for (const rowId of rowIds) {
      if (seen.has(rowId)) {
        continue
      }
      seen.add(rowId)
      const node = resolveRuntimeRowById(rowId)
      if (!node || node.rowId == null || node.kind === "group") {
        continue
      }
      snapshotRows.push({
        rowId: node.rowId,
        row: options.cloneRowData(node.data as TRow),
      })
    }
    return { kind: "partial", rows: snapshotRows }
  }

  const intentHistory = useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>({
    captureSnapshot: captureRowsSnapshot,
    applySnapshot: snapshot => {
      if (snapshot.kind === "partial") {
        if (snapshot.rows.length > 0) {
          options.runtime.api.rows.applyEdits(snapshot.rows.map(entry => ({
            rowId: entry.rowId,
            data: options.cloneRowData(entry.row) as Partial<TRow>,
          })))
        }
        options.syncViewport()
        return
      }
      options.runtime.api.rows.setData(snapshot.rows.map((entry, index) => ({
        rowId: entry.rowId,
        originalIndex: index,
        row: options.cloneRowData(entry.row),
      })))
      options.syncViewport()
    },
  })

  const recordIntentTransaction = (
    descriptor: DataGridIntentTransactionDescriptor,
    beforeSnapshot: DataGridAppRowSnapshot<TRow>,
    afterSnapshotOverride?: DataGridAppRowSnapshot<TRow>,
  ): Promise<string | null> => {
    const afterSnapshot = afterSnapshotOverride
      ?? (beforeSnapshot.kind === "partial"
        ? captureRowsSnapshotByIds(beforeSnapshot.rows.map(entry => entry.rowId))
        : captureRowsSnapshot())
    return intentHistory.recordIntentTransaction(descriptor, beforeSnapshot, afterSnapshot)
  }

  return {
    captureRowsSnapshot,
    captureRowsSnapshotByIds,
    canUndo: intentHistory.canUndo,
    canRedo: intentHistory.canRedo,
    runHistoryAction: intentHistory.runHistoryAction,
    recordIntentTransaction,
    dispose: intentHistory.dispose,
  }
}
