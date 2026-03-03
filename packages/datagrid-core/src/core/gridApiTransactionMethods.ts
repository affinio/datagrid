import type { DataGridApiMutationControlOptions } from "./gridApiContracts"
import type { DataGridTransactionInput, DataGridTransactionSnapshot } from "./transactionService"
import {
  assertTransactionCapability,
  type DataGridTransactionCapability,
} from "./gridApiCapabilities"

export interface DataGridApiTransactionMethods {
  hasTransactionSupport: () => boolean
  getTransactionSnapshot: () => DataGridTransactionSnapshot | null
  beginTransactionBatch: (label?: string) => string
  commitTransactionBatch: (batchId?: string) => Promise<readonly string[]>
  rollbackTransactionBatch: (batchId?: string) => readonly string[]
  applyTransaction: (
    transactionInput: DataGridTransactionInput,
    options?: DataGridApiMutationControlOptions,
  ) => Promise<string>
  canUndoTransaction: () => boolean
  canRedoTransaction: () => boolean
  undoTransaction: () => Promise<string | null>
  redoTransaction: () => Promise<string | null>
}

export interface CreateDataGridApiTransactionMethodsInput {
  getTransactionCapability: () => DataGridTransactionCapability | null
  onChanged?: (snapshot: DataGridTransactionSnapshot | null) => void
}

function createAbortError(operation: string): Error {
  const error = new Error(`[DataGridApi] ${operation} aborted.`)
  error.name = "AbortError"
  return error
}

function assertNotAborted(signal: AbortSignal | null | undefined, operation: string): void {
  if (signal?.aborted) {
    throw createAbortError(operation)
  }
}

export function createDataGridApiTransactionMethods(
  input: CreateDataGridApiTransactionMethodsInput,
): DataGridApiTransactionMethods {
  const { getTransactionCapability, onChanged } = input

  return {
    hasTransactionSupport() {
      return getTransactionCapability() !== null
    },
    getTransactionSnapshot() {
      const transactionCapability = getTransactionCapability()
      if (!transactionCapability) {
        return null
      }
      return transactionCapability.getTransactionSnapshot()
    },
    beginTransactionBatch(label?: string) {
      const transaction = assertTransactionCapability(getTransactionCapability())
      const batchId = transaction.beginTransactionBatch(label)
      onChanged?.(transaction.getTransactionSnapshot())
      return batchId
    },
    commitTransactionBatch(batchId?: string) {
      const transaction = assertTransactionCapability(getTransactionCapability())
      return transaction.commitTransactionBatch(batchId).then((committed) => {
        onChanged?.(transaction.getTransactionSnapshot())
        return committed
      })
    },
    rollbackTransactionBatch(batchId?: string) {
      const transaction = assertTransactionCapability(getTransactionCapability())
      const rolledBack = transaction.rollbackTransactionBatch(batchId)
      onChanged?.(transaction.getTransactionSnapshot())
      return rolledBack
    },
    applyTransaction(transactionInput: DataGridTransactionInput, options?: DataGridApiMutationControlOptions) {
      assertNotAborted(options?.signal, "transaction.apply")
      const transaction = assertTransactionCapability(getTransactionCapability())
      return transaction.applyTransaction(transactionInput).then((transactionId) => {
        onChanged?.(transaction.getTransactionSnapshot())
        return transactionId
      })
    },
    canUndoTransaction() {
      const transactionCapability = getTransactionCapability()
      if (!transactionCapability) {
        return false
      }
      return transactionCapability.canUndoTransaction()
    },
    canRedoTransaction() {
      const transactionCapability = getTransactionCapability()
      if (!transactionCapability) {
        return false
      }
      return transactionCapability.canRedoTransaction()
    },
    undoTransaction() {
      const transaction = assertTransactionCapability(getTransactionCapability())
      return transaction.undoTransaction().then((transactionId) => {
        onChanged?.(transaction.getTransactionSnapshot())
        return transactionId
      })
    },
    redoTransaction() {
      const transaction = assertTransactionCapability(getTransactionCapability())
      return transaction.redoTransaction().then((transactionId) => {
        onChanged?.(transaction.getTransactionSnapshot())
        return transactionId
      })
    },
  }
}
