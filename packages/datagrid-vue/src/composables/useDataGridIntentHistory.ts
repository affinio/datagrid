import { computed, onBeforeUnmount, ref, type Ref } from "vue"
import type { DataGridCoreTransactionService } from "@affino/datagrid-core"
import {
  useDataGridIntentHistory as useDataGridIntentHistoryCore,
  type DataGridIntentTransactionDescriptor,
  type UseDataGridIntentHistoryOptions,
} from "@affino/datagrid-orchestration"
import type { DataGridTransactionSnapshot } from "@affino/datagrid-core/advanced"

export type {
  DataGridIntentTransactionDescriptor,
  UseDataGridIntentHistoryOptions,
}

export interface UseDataGridIntentHistoryResult<TSnapshot> {
  transactionService: DataGridCoreTransactionService
  transactionSnapshot: Ref<DataGridTransactionSnapshot>
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  recordIntentTransaction: (
    descriptor: DataGridIntentTransactionDescriptor,
    beforeSnapshot: TSnapshot,
  ) => Promise<string | null>
  runHistoryAction: (direction: "undo" | "redo") => Promise<string | null>
  dispose: () => void
}

export function useDataGridIntentHistory<TSnapshot>(
  options: UseDataGridIntentHistoryOptions<TSnapshot>,
): UseDataGridIntentHistoryResult<TSnapshot> {
  const core = useDataGridIntentHistoryCore(options)
  const transactionSnapshot = ref<DataGridTransactionSnapshot>(core.getTransactionSnapshot())

  const unsubscribe = core.subscribeSnapshot(nextSnapshot => {
    transactionSnapshot.value = nextSnapshot
  })

  function dispose() {
    unsubscribe()
    core.dispose()
  }

  onBeforeUnmount(() => {
    dispose()
  })

  return {
    transactionService: core.transactionService,
    transactionSnapshot,
    canUndo: computed(() => core.canUndo()),
    canRedo: computed(() => core.canRedo()),
    recordIntentTransaction: core.recordIntentTransaction,
    runHistoryAction: core.runHistoryAction,
    dispose,
  }
}
