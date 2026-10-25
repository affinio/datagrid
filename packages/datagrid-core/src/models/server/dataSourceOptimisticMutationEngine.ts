import type { DataGridRowId, DataGridRowNode } from "../rowModel.js"
import {
  createDataSourceRuntimeLifecycle,
  type DataSourceRuntimeLifecycle,
} from "./dataSourceRuntimeLifecycle.js"

export interface DataSourceOptimisticEditTransaction<T> {
  id: number
  updatesByRowId: Map<DataGridRowId, Partial<T>>
  previousByRowId: Map<DataGridRowId, Partial<T>>
  revisionsByRowId: Map<DataGridRowId, Readonly<Record<string, string | number | null>>>
  baselinesByRowId: Map<DataGridRowId, DataGridRowNode<T>>
}

export interface DataSourceOptimisticMutationEngine<T> extends DataSourceRuntimeLifecycle {
  nextTransactionId(): number
  register(transaction: DataSourceOptimisticEditTransaction<T>): void
  remove(transactionId: number): void
  getPendingCount(): number
  applyPendingEditsToNode(
    node: DataGridRowNode<T>,
    applyPatch: (row: T, patch: Partial<T>) => T,
    excludeTransactionId?: number,
  ): DataGridRowNode<T>
  enqueueCommit(task: () => Promise<void>): Promise<void>
}

export function createDataSourceOptimisticMutationEngine<T>(): DataSourceOptimisticMutationEngine<T> {
  let transactionCounter = 0
  let commitRunning = false
  let commitScheduled = false
  const commitQueue: Array<{
    task: () => Promise<void>
    resolve: () => void
    reject: (error: unknown) => void
  }> = []
  const transactions = new Map<number, DataSourceOptimisticEditTransaction<T>>()
  const transactionOrder: number[] = []

  const cancelQueuedCommits = (): void => {
    const error = new Error("[DataGridDataSource] optimistic commit was cancelled before dispatch because the model is disposed.")
    while (commitQueue.length > 0) {
      commitQueue.shift()?.reject(error)
    }
  }

  const scheduleNextCommit = (): void => {
    if (lifecycle.isDisposed() || commitRunning || commitScheduled || commitQueue.length === 0) {
      return
    }
    commitScheduled = true
    queueMicrotask(() => {
      commitScheduled = false
      if (lifecycle.isDisposed()) {
        cancelQueuedCommits()
        return
      }
      const next = commitQueue.shift()
      if (!next) return
      commitRunning = true
      Promise.resolve()
        .then(next.task)
        .then(next.resolve, next.reject)
        .finally(() => {
          commitRunning = false
          scheduleNextCommit()
        })
    })
  }

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

  function clearTransactions(): void {
    transactions.clear()
    transactionOrder.splice(0)
  }

  const lifecycle = createDataSourceRuntimeLifecycle({
    service: "optimistic-mutation-engine",
    onAttach: clearTransactions,
    onDispose() {
      clearTransactions()
      cancelQueuedCommits()
    },
  })

  return {
    ...lifecycle,
    nextTransactionId() {
      if (lifecycle.isDisposed()) {
        return transactionCounter
      }
      transactionCounter += 1
      return transactionCounter
    },
    register(transaction) {
      if (lifecycle.isDisposed()) {
        return
      }
      transactions.set(transaction.id, transaction)
      transactionOrder.push(transaction.id)
    },
    remove(transactionId) {
      if (lifecycle.isDisposed()) {
        return
      }
      if (!transactions.delete(transactionId)) {
        return
      }
      const orderIndex = transactionOrder.indexOf(transactionId)
      if (orderIndex >= 0) {
        transactionOrder.splice(orderIndex, 1)
      }
    },
    getPendingCount() {
      if (lifecycle.isDisposed()) {
        return 0
      }
      return transactions.size
    },
    applyPendingEditsToNode(node, applyPatch, excludeTransactionId) {
      if (lifecycle.isDisposed()) {
        return node
      }
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
      if (lifecycle.isDisposed()) {
        return Promise.reject(new Error("[DataGridDataSource] optimistic commit engine is disposed."))
      }
      const commitTask = new Promise<void>((resolve, reject) => {
        commitQueue.push({ task, resolve, reject })
      })
      scheduleNextCommit()
      return commitTask
    },
  }
}
