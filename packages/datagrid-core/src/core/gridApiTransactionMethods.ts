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
  applyTransaction: (transactionInput: DataGridTransactionInput) => Promise<string>
  canUndoTransaction: () => boolean
  canRedoTransaction: () => boolean
  undoTransaction: () => Promise<string | null>
  redoTransaction: () => Promise<string | null>
}

export interface CreateDataGridApiTransactionMethodsInput {
  getTransactionCapability: () => DataGridTransactionCapability | null
}

export function createDataGridApiTransactionMethods(
  input: CreateDataGridApiTransactionMethodsInput,
): DataGridApiTransactionMethods {
  const { getTransactionCapability } = input

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
      return transaction.beginTransactionBatch(label)
    },
    commitTransactionBatch(batchId?: string) {
      const transaction = assertTransactionCapability(getTransactionCapability())
      return transaction.commitTransactionBatch(batchId)
    },
    rollbackTransactionBatch(batchId?: string) {
      const transaction = assertTransactionCapability(getTransactionCapability())
      return transaction.rollbackTransactionBatch(batchId)
    },
    applyTransaction(transactionInput: DataGridTransactionInput) {
      const transaction = assertTransactionCapability(getTransactionCapability())
      return transaction.applyTransaction(transactionInput)
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
      return transaction.undoTransaction()
    },
    redoTransaction() {
      const transaction = assertTransactionCapability(getTransactionCapability())
      return transaction.redoTransaction()
    },
  }
}
