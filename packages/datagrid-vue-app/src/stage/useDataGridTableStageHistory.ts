import type { DataGridAppRowSnapshot } from "@affino/datagrid-vue"
import { useDataGridAppIntentHistory } from "@affino/datagrid-vue"
import type { DataGridCopyRange } from "@affino/datagrid-vue/advanced"

export interface DataGridTableStageHistoryAdapter {
  captureSnapshot: () => unknown
  recordIntentTransaction: (
    descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
    beforeSnapshot: unknown,
  ) => void | Promise<void>
  canUndo: () => boolean
  canRedo: () => boolean
  runHistoryAction: (direction: "undo" | "redo") => Promise<string | null>
}

export interface UseDataGridTableStageHistoryOptions<TRow extends Record<string, unknown>> {
  runtime: Pick<
    import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>,
    "api" | "syncRowsInRange" | "virtualWindow" | "columnSnapshot"
  >
  cloneRowData: (row: TRow) => TRow
  syncViewport: () => void
  history?: DataGridTableStageHistoryAdapter
}

export interface UseDataGridTableStageHistoryResult {
  captureHistorySnapshot: () => unknown
  recordHistoryIntentTransaction: (
    descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
    beforeSnapshot: unknown,
  ) => void
  canUndoHistory: () => boolean
  canRedoHistory: () => boolean
  runHistoryAction: (direction: "undo" | "redo") => Promise<string | null>
  disposeIntentHistory: () => void
}

export function useDataGridTableStageHistory<TRow extends Record<string, unknown>>(
  options: UseDataGridTableStageHistoryOptions<TRow>,
): UseDataGridTableStageHistoryResult {
  const internalIntentHistory = options.history
    ? null
    : useDataGridAppIntentHistory<TRow>({
      runtime: options.runtime as never,
      cloneRowData: options.cloneRowData,
      syncViewport: options.syncViewport,
    })

  const captureHistorySnapshot = (): unknown => {
    if (options.history) {
      return options.history.captureSnapshot()
    }
    return internalIntentHistory?.captureRowsSnapshot() ?? null
  }

  const recordHistoryIntentTransaction = (
    descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
    beforeSnapshot: unknown,
  ): void => {
    if (options.history) {
      void options.history.recordIntentTransaction(descriptor, beforeSnapshot)
      return
    }
    void internalIntentHistory?.recordIntentTransaction(
      descriptor,
      beforeSnapshot as DataGridAppRowSnapshot<TRow>,
    )
  }

  const canUndoHistory = (): boolean => {
    return options.history ? options.history.canUndo() : (internalIntentHistory?.canUndo.value ?? false)
  }

  const canRedoHistory = (): boolean => {
    return options.history ? options.history.canRedo() : (internalIntentHistory?.canRedo.value ?? false)
  }

  const runHistoryAction = (direction: "undo" | "redo"): Promise<string | null> => {
    if (options.history) {
      return options.history.runHistoryAction(direction)
    }
    return internalIntentHistory?.runHistoryAction(direction) ?? Promise.resolve(null)
  }

  const disposeIntentHistory = (): void => {
    internalIntentHistory?.dispose()
  }

  return {
    captureHistorySnapshot,
    recordHistoryIntentTransaction,
    canUndoHistory,
    canRedoHistory,
    runHistoryAction,
    disposeIntentHistory,
  }
}