import { useDataGridIntentHistory } from "../advanced"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"

export interface DataGridAppRowSnapshot<TRow> {
  rows: Array<{ rowId: string | number; row: TRow }>
}

export interface UseDataGridAppIntentHistoryOptions<TRow> {
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api">
  cloneRowData: (row: TRow) => TRow
  syncViewport: () => void
}

export interface UseDataGridAppIntentHistoryResult<TRow> {
  captureRowsSnapshot: () => DataGridAppRowSnapshot<TRow>
  canUndo: ReturnType<typeof useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>>["canUndo"]
  canRedo: ReturnType<typeof useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>>["canRedo"]
  runHistoryAction: ReturnType<typeof useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>>["runHistoryAction"]
  recordIntentTransaction: ReturnType<typeof useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>>["recordIntentTransaction"]
  dispose: ReturnType<typeof useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>>["dispose"]
}

export function useDataGridAppIntentHistory<TRow>(
  options: UseDataGridAppIntentHistoryOptions<TRow>,
): UseDataGridAppIntentHistoryResult<TRow> {
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
    return { rows: snapshotRows }
  }

  const intentHistory = useDataGridIntentHistory<DataGridAppRowSnapshot<TRow>>({
    captureSnapshot: captureRowsSnapshot,
    applySnapshot: snapshot => {
      options.runtime.api.rows.setData(snapshot.rows.map((entry, index) => ({
        rowId: entry.rowId,
        originalIndex: index,
        row: options.cloneRowData(entry.row),
      })))
      options.syncViewport()
    },
  })

  return {
    captureRowsSnapshot,
    canUndo: intentHistory.canUndo,
    canRedo: intentHistory.canRedo,
    runHistoryAction: intentHistory.runHistoryAction,
    recordIntentTransaction: intentHistory.recordIntentTransaction,
    dispose: intentHistory.dispose,
  }
}
