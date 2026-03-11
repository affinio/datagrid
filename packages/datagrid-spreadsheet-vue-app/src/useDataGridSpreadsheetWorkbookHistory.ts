import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref, type WatchStopHandle } from "vue"
import type { DataGridSpreadsheetWorkbookModel, DataGridSpreadsheetWorkbookState } from "@affino/datagrid-core"
import type { DataGridTransactionSnapshot } from "@affino/datagrid-core/advanced"
import {
  useDataGridIntentHistory,
  type DataGridIntentTransactionDescriptor,
} from "@affino/datagrid-vue/advanced"

export interface UseDataGridSpreadsheetWorkbookHistoryOptions {
  workbookModel: DataGridSpreadsheetWorkbookModel
}

export interface UseDataGridSpreadsheetWorkbookHistoryResult {
  transactionSnapshot: Ref<DataGridTransactionSnapshot>
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  captureSnapshot: () => DataGridSpreadsheetWorkbookState
  recordIntentTransaction: (
    descriptor: DataGridIntentTransactionDescriptor,
    beforeSnapshot: DataGridSpreadsheetWorkbookState,
  ) => Promise<string | null>
  runHistoryAction: (direction: "undo" | "redo") => Promise<string | null>
  rebindWorkbook: (workbookModel: DataGridSpreadsheetWorkbookModel) => void
  dispose: () => void
}

export function useDataGridSpreadsheetWorkbookHistory(
  options: UseDataGridSpreadsheetWorkbookHistoryOptions,
): UseDataGridSpreadsheetWorkbookHistoryResult {
  let workbookModel = options.workbookModel
  let stopHistoryWatch: WatchStopHandle | null = null

  const transactionSnapshot = ref<DataGridTransactionSnapshot>({
    revision: 0,
    pendingBatch: null,
    undoDepth: 0,
    redoDepth: 0,
    lastCommittedId: null,
  })

  const createHistory = (targetWorkbookModel: DataGridSpreadsheetWorkbookModel) => useDataGridIntentHistory<DataGridSpreadsheetWorkbookState>({
    captureSnapshot: () => targetWorkbookModel.exportState(),
    applySnapshot: snapshot => {
      targetWorkbookModel.restoreState(snapshot)
    },
  })

  let history = createHistory(workbookModel)

  const bindHistory = (): void => {
    stopHistoryWatch?.()
    stopHistoryWatch = watch(
      history.transactionSnapshot,
      nextSnapshot => {
        transactionSnapshot.value = nextSnapshot
      },
      { immediate: true },
    )
  }

  bindHistory()

  const canUndo = computed(() => transactionSnapshot.value.undoDepth > 0)
  const canRedo = computed(() => transactionSnapshot.value.redoDepth > 0)

  const captureSnapshot = (): DataGridSpreadsheetWorkbookState => workbookModel.exportState()

  const rebindWorkbook = (nextWorkbookModel: DataGridSpreadsheetWorkbookModel): void => {
    if (nextWorkbookModel === workbookModel) {
      return
    }
    history.dispose()
    workbookModel = nextWorkbookModel
    history = createHistory(workbookModel)
    bindHistory()
  }

  const dispose = (): void => {
    stopHistoryWatch?.()
    stopHistoryWatch = null
    history.dispose()
  }

  onBeforeUnmount(() => {
    dispose()
  })

  return {
    transactionSnapshot,
    canUndo,
    canRedo,
    captureSnapshot,
    recordIntentTransaction: (descriptor, beforeSnapshot) => history.recordIntentTransaction(
      descriptor,
      beforeSnapshot,
    ),
    runHistoryAction: direction => history.runHistoryAction(direction),
    rebindWorkbook,
    dispose,
  }
}
