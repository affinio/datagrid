import type { DataGridRowId, DataGridRowNode } from "../rowModel.js"

export interface DataSourceOptimisticEditTransaction<T> {
  id: number
  updatesByRowId: Map<DataGridRowId, Partial<T>>
  previousByRowId: Map<DataGridRowId, Partial<T>>
  revisionsByRowId: Map<DataGridRowId, Readonly<Record<string, string | number | null>>>
  baselinesByRowId: Map<DataGridRowId, DataGridRowNode<T>>
}

export interface DataSourceOptimisticMutationEngine<T> {
  nextTransactionId(): number
  register(transaction: DataSourceOptimisticEditTransaction<T>): void
  remove(transactionId: number): void
  applyPendingEditsToNode(
    node: DataGridRowNode<T>,
    applyPatch: (row: T, patch: Partial<T>) => T,
    excludeTransactionId?: number,
  ): DataGridRowNode<T>
  enqueueCommit(task: () => Promise<void>): Promise<void>
}

export function createDataSourceOptimisticMutationEngine<T>(): DataSourceOptimisticMutationEngine<T> {
  let transactionCounter = 0
  let commitQueue: Promise<void> = Promise.resolve()
  const transactions = new Map<number, DataSourceOptimisticEditTransaction<T>>()
  const transactionOrder: number[] = []

  function pendingTransactionsForRow(rowId: DataGridRowId): DataSourceOptimisticEditTransaction<T>[] {
    const pending: DataSourceOptimisticEditTransaction<T>[] = []
    for (const transactionId of transactionOrder) {
      const transaction = transactions.get(transactionId)
      if (!transaction || !transaction.updatesByRowId.has(rowId)) {
        continue
      }
      pending.push(transaction)
    }
    return pending
  }

  return {
    nextTransactionId() {
      transactionCounter += 1
      return transactionCounter
    },
    register(transaction) {
      transactions.set(transaction.id, transaction)
      transactionOrder.push(transaction.id)
    },
    remove(transactionId) {
      if (!transactions.delete(transactionId)) {
        return
      }
      const orderIndex = transactionOrder.indexOf(transactionId)
      if (orderIndex >= 0) {
        transactionOrder.splice(orderIndex, 1)
      }
    },
    applyPendingEditsToNode(node, applyPatch, excludeTransactionId) {
      let nextNode = node
      for (const transaction of pendingTransactionsForRow(node.rowId)) {
        if (transaction.id === excludeTransactionId) {
          continue
        }
        const patch = transaction.updatesByRowId.get(node.rowId)
        if (!patch) {
          continue
        }
        const nextRow = applyPatch(nextNode.row, patch)
        if (nextRow === nextNode.row) {
          continue
        }
        nextNode = {
          ...nextNode,
          data: nextRow,
          row: nextRow,
        }
      }
      return nextNode
    },
    enqueueCommit(task) {
      const commitTask = commitQueue.then(task)
      commitQueue = commitTask.then(() => undefined, () => undefined)
      return commitTask
    },
  }
}
