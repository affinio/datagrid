import type { DataGridAppRowSnapshot } from "@affino/datagrid-vue/app"
import { useDataGridAppIntentHistory } from "@affino/datagrid-vue/app"
import type { DataGridCopyRange } from "@affino/datagrid-vue/advanced"
import type { DataGridHistoryController } from "../dataGridHistory"

export interface DataGridTableStageHistoryAdapter {
  captureSnapshot: () => unknown
  captureSnapshotForRowIds?: (rowIds: readonly (string | number)[]) => unknown
  recordIntentTransaction: (
    descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
    beforeSnapshot: unknown,
    afterSnapshotOverride?: unknown,
  ) => void | Promise<void>
  canUndo: () => boolean
  canRedo: () => boolean
  runHistoryAction: (direction: "undo" | "redo") => Promise<string | null>
}

export interface UseDataGridTableStageHistoryOptions<TRow extends Record<string, unknown>> {
  runtime: Pick<
    import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>,
    "api" | "getBodyRowAtIndex" | "resolveBodyRowIndexById"
  >
  cloneRowData: (row: TRow) => TRow
  syncViewport: () => void
  enabled?: boolean
  maxHistoryDepth?: number
  history?: DataGridTableStageHistoryAdapter
}

export interface UseDataGridTableStageHistoryResult extends DataGridHistoryController {
  captureHistorySnapshot: () => unknown
  captureHistorySnapshotForRowIds: (rowIds: readonly (string | number)[]) => unknown
  recordHistoryIntentTransaction: (
    descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
    beforeSnapshot: unknown,
    afterSnapshotOverride?: unknown,
  ) => void
  canUndoHistory: () => boolean
  canRedoHistory: () => boolean
  runHistoryAction: (direction: "undo" | "redo") => Promise<string | null>
  disposeIntentHistory: () => void
}

export function useDataGridTableStageHistory<TRow extends Record<string, unknown>>(
  options: UseDataGridTableStageHistoryOptions<TRow>,
): UseDataGridTableStageHistoryResult {
  const internalIntentHistory = options.enabled === false || options.history
    ? null
    : useDataGridAppIntentHistory<TRow>({
      runtime: options.runtime,
      cloneRowData: options.cloneRowData,
      syncViewport: options.syncViewport,
      maxHistoryDepth: options.maxHistoryDepth,
    })

  const captureHistorySnapshot = (): unknown => {
    if (options.enabled === false) {
      return null
    }
    if (options.history) {
      return options.history.captureSnapshot()
    }
    return internalIntentHistory?.captureRowsSnapshot() ?? null
  }

  const captureHistorySnapshotForRowIds = (
    rowIds: readonly (string | number)[],
  ): unknown => {
    if (options.enabled === false) {
      return null
    }
    if (options.history) {
      return options.history.captureSnapshotForRowIds?.(rowIds) ?? options.history.captureSnapshot()
    }
    return internalIntentHistory?.captureRowsSnapshotByIds(rowIds) ?? null
  }

  const recordHistoryIntentTransaction = (
    descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
    beforeSnapshot: unknown,
    afterSnapshotOverride?: unknown,
  ): void => {
    if (options.enabled === false) {
      return
    }
    if (options.history) {
      void options.history.recordIntentTransaction(descriptor, beforeSnapshot, afterSnapshotOverride)
      return
    }
    void internalIntentHistory?.recordIntentTransaction(
      descriptor,
      beforeSnapshot as DataGridAppRowSnapshot<TRow>,
      afterSnapshotOverride as DataGridAppRowSnapshot<TRow> | undefined,
    )
  }

  const canUndoHistory = (): boolean => {
    if (options.enabled === false) {
      return false
    }
    return options.history ? options.history.canUndo() : (internalIntentHistory?.canUndo.value ?? false)
  }

  const canRedoHistory = (): boolean => {
    if (options.enabled === false) {
      return false
    }
    return options.history ? options.history.canRedo() : (internalIntentHistory?.canRedo.value ?? false)
  }

  const runHistoryAction = (direction: "undo" | "redo"): Promise<string | null> => {
    if (options.enabled === false) {
      return Promise.resolve(null)
    }
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
    captureHistorySnapshotForRowIds,
    recordHistoryIntentTransaction,
    canUndoHistory,
    canRedoHistory,
    canUndo: canUndoHistory,
    canRedo: canRedoHistory,
    runHistoryAction,
    disposeIntentHistory,
  }
}
