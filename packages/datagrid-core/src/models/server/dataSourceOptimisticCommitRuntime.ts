import type { DataGridRowId } from "../rowModel.js"
import type {
  DataGridDataSourceCommitEditsRequest,
  DataGridDataSourceCommitEditsResult,
} from "./dataSourceProtocol.js"
import type { DataSourceOptimisticEditTransaction } from "./dataSourceOptimisticMutationEngine.js"

export interface DataSourceOptimisticCommitRuntimeOptions<T> {
  commitEdits(request: DataGridDataSourceCommitEditsRequest<T>): Promise<DataGridDataSourceCommitEditsResult<T>>
  getDatasetVersion(): string | number | null
  isDisposed(): boolean
  removeTransaction(transactionId: number): void
  rollbackTransaction(transaction: DataSourceOptimisticEditTransaction<T>, rowIds?: readonly DataGridRowId[]): boolean
  settleMutation(transaction: DataSourceOptimisticEditTransaction<T>, status: "committed" | "rejected" | "failed", error?: Error): void
  setError(error: Error | null): void
  applyMutationResult(result: DataGridDataSourceCommitEditsResult<T>): boolean
  shouldRefreshAfterCommit(transaction: DataSourceOptimisticEditTransaction<T>): boolean
  refreshVisibleRows(): Promise<void>
  updateCachedCoverage(): void
  bumpRevision(): void
  emit(): void
}

export function createDataSourceOptimisticCommitRuntime<T>(
  options: DataSourceOptimisticCommitRuntimeOptions<T>,
): (transaction: DataSourceOptimisticEditTransaction<T>) => Promise<void> {
  return async transaction => {
    let optimisticMutationSettled = false
    let serverConfirmed = false
    const settle = (status: "committed" | "rejected" | "failed", error?: Error): void => {
      if (optimisticMutationSettled) return
      optimisticMutationSettled = true
      options.settleMutation(transaction, status, error)
    }

    try {
      const datasetVersion = options.getDatasetVersion()
      const result = await Promise.resolve(options.commitEdits({
        edits: Array.from(transaction.updatesByRowId.entries()).map(([rowId, data]) => ({
          rowId,
          data,
          ...(transaction.previousByRowId.has(rowId) ? { previousData: transaction.previousByRowId.get(rowId) } : {}),
          ...(transaction.revisionsByRowId.has(rowId) ? { revisions: transaction.revisionsByRowId.get(rowId) } : {}),
        })),
        ...(datasetVersion != null ? { revision: datasetVersion } : {}),
      }))

      if (options.isDisposed()) return
      serverConfirmed = true
      const rejectedRowIds = new Set<DataGridRowId>((result.rejected ?? []).map(entry => entry.rowId))
      if (rejectedRowIds.size > 0) {
        console.error("[DataGridDataSource] commitEdits returned rejected rows.", result.rejected)
        const error = new Error(
          (result.rejected ?? [])
            .map(entry => entry.reason)
            .find((reason): reason is string => typeof reason === "string" && reason.length > 0)
          ?? "commitEdits returned rejected rows",
        )
        options.setError(error)
        options.rollbackTransaction(transaction, Array.from(rejectedRowIds))
        settle("rejected", error)
        options.bumpRevision()
        options.emit()
        throw error
      }

      options.removeTransaction(transaction.id)
      settle("committed")
      options.setError(null)
      const changedByMutationResult = options.applyMutationResult(result)
      const hasReturnedRows = (Array.isArray(result.rows) && result.rows.length > 0)
        || (Array.isArray(result.updatedRows) && result.updatedRows.length > 0)
      const needsProjectionRefresh = !result.invalidation && !hasReturnedRows && options.shouldRefreshAfterCommit(transaction)
      if (needsProjectionRefresh) {
        await options.refreshVisibleRows()
      } else {
        options.updateCachedCoverage()
        if (changedByMutationResult) options.bumpRevision()
        options.emit()
      }
    } catch (commitError) {
      if (options.isDisposed()) {
        // A dispatched write has an external outcome. Disposal may suppress
        // local publication, but it must not turn a rejected write into success.
        throw commitError
      }
      console.error(
        serverConfirmed
          ? "[DataGridDataSource] commit was confirmed but local publication or reconciliation failed."
          : "[DataGridDataSource] commitEdits failed.",
        commitError,
      )
      const error = commitError instanceof Error ? commitError : new Error(String(commitError))
      options.setError(error)
      if (!serverConfirmed) {
        options.rollbackTransaction(transaction)
        settle("failed", error)
        options.bumpRevision()
        options.emit()
      } else {
        // The external write is irreversible at this point. Reconcile from
        // the authoritative source instead of restoring a stale local base.
        try {
          await options.refreshVisibleRows()
        } catch (refreshError) {
          throw Object.assign(new Error("[DataGridDataSource] server accepted the write but local reconciliation failed."), {
            errors: [error, refreshError],
          })
        }
      }
      throw error
    }
  }
}
