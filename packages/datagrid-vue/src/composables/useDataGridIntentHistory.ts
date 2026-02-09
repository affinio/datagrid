import { computed, ref, type Ref } from "vue"
import type { DataGridCoreTransactionService } from "@affino/datagrid-core"
import {
  createDataGridTransactionService,
  type DataGridTransactionAffectedRange,
  type DataGridTransactionSnapshot,
} from "@affino/datagrid-core/advanced"

export interface DataGridIntentTransactionDescriptor {
  intent: string
  label: string
  affectedRange?: DataGridTransactionAffectedRange | null
}

export interface UseDataGridIntentHistoryOptions<TSnapshot> {
  captureSnapshot: () => TSnapshot
  applySnapshot: (snapshot: TSnapshot) => void
  maxHistoryDepth?: number
  logger?: Pick<Console, "error">
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
  let transactionIntentCounter = 0

  const service = createDataGridTransactionService({
    maxHistoryDepth: options.maxHistoryDepth,
    execute(command, context) {
      if (context.direction === "apply") {
        return
      }
      options.applySnapshot(command.payload as TSnapshot)
    },
  })

  const transactionSnapshot = ref<DataGridTransactionSnapshot>(service.getSnapshot())

  const unsubscribe = service.subscribe(nextSnapshot => {
    transactionSnapshot.value = nextSnapshot
  })

  let disposed = false

  function dispose() {
    if (disposed) {
      return
    }
    disposed = true
    unsubscribe()
    service.dispose()
  }

  const transactionService: DataGridCoreTransactionService = {
    name: "transaction",
    getTransactionSnapshot: service.getSnapshot,
    beginTransactionBatch: service.beginBatch,
    commitTransactionBatch: service.commitBatch,
    rollbackTransactionBatch: service.rollbackBatch,
    applyTransaction: service.applyTransaction,
    canUndoTransaction: service.canUndo,
    canRedoTransaction: service.canRedo,
    undoTransaction: service.undo,
    redoTransaction: service.redo,
    dispose,
  }

  const canUndo = computed(() => transactionSnapshot.value.undoDepth > 0)
  const canRedo = computed(() => transactionSnapshot.value.redoDepth > 0)

  async function recordIntentTransaction(
    descriptor: DataGridIntentTransactionDescriptor,
    beforeSnapshot: TSnapshot,
  ): Promise<string | null> {
    if (disposed) {
      return null
    }
    const afterSnapshot = options.captureSnapshot()
    transactionIntentCounter += 1
    const normalizedIntent = descriptor.intent.trim() || "intent"
    const transactionId = `intent-${normalizedIntent}-${transactionIntentCounter}`
    const meta = {
      intent: normalizedIntent,
      affectedRange: descriptor.affectedRange ?? null,
    }
    try {
      return await service.applyTransaction({
        id: transactionId,
        label: descriptor.label,
        meta,
        commands: [
          {
            type: `grid-state.${normalizedIntent}`,
            payload: afterSnapshot,
            rollbackPayload: beforeSnapshot,
            meta,
          },
        ],
      })
    } catch (error) {
      options.logger?.error?.("[DataGrid] failed to record transaction intent", error)
      return null
    }
  }

  async function runHistoryAction(direction: "undo" | "redo"): Promise<string | null> {
    if (disposed) {
      return null
    }
    if (direction === "undo") {
      return service.undo()
    }
    return service.redo()
  }

  return {
    transactionService,
    transactionSnapshot,
    canUndo,
    canRedo,
    recordIntentTransaction,
    runHistoryAction,
    dispose,
  }
}
