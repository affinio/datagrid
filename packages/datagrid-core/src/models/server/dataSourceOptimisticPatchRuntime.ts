import type { DataGridRowId, DataGridRowNode } from "../rowModel.js"
import type { DataGridClientRowPatch } from "../advancedClientRowModelContracts.js"
import { applyRowDataPatch, mergeRowPatch } from "../clientRowRuntimeUtils.js"
import type { DataSourceOptimisticMutationEngine, DataSourceOptimisticEditTransaction } from "./dataSourceOptimisticMutationEngine.js"

export interface DataSourceOptimisticPatchRuntimeOptions<T> {
  ensureActive(): void
  mutationEngine: DataSourceOptimisticMutationEngine<T>
  findCachedRowById(rowId: DataGridRowId): { index: number; node: DataGridRowNode<T> } | null
  writeRowCache(index: number, row: DataGridRowNode<T>): void
  onMutationStarted(transaction: DataSourceOptimisticEditTransaction<T>): void
  bumpRevision(): void
  emit(): void
  processCommit(transaction: DataSourceOptimisticEditTransaction<T>): Promise<void>
}

export function createDataSourceOptimisticPatchRuntime<T>(
  options: DataSourceOptimisticPatchRuntimeOptions<T>,
): { patchRows(updates: readonly DataGridClientRowPatch<T>[]): Promise<void> | void } {
  return {
    patchRows(updates) {
      options.ensureActive()
      if (!Array.isArray(updates) || updates.length === 0) return
      const transactionId = options.mutationEngine.nextTransactionId()
      const baselinesByRowId = new Map<DataGridRowId, DataGridRowNode<T>>()
      const updatesByRowId = new Map<DataGridRowId, Partial<T>>()
      const previousByRowId = new Map<DataGridRowId, Partial<T>>()
      const revisionsByRowId = new Map<DataGridRowId, Readonly<Record<string, string | number | null>>>()
      let changed = false

      for (const update of updates) {
        if (!update || typeof update.rowId !== "string" && typeof update.rowId !== "number") continue
        if (typeof update.data === "undefined" || update.data === null) continue
        const existingPatch = updatesByRowId.get(update.rowId)
        updatesByRowId.set(update.rowId, existingPatch ? mergeRowPatch(existingPatch, update.data) : update.data)
        if (update.previousData) {
          const existingPrevious = previousByRowId.get(update.rowId)
          previousByRowId.set(update.rowId, existingPrevious ? mergeRowPatch(existingPrevious, update.previousData) : update.previousData)
        }
        if (update.revisions) {
          revisionsByRowId.set(update.rowId, { ...(revisionsByRowId.get(update.rowId) ?? {}), ...update.revisions })
        } else if (typeof update.revision !== "undefined") {
          const revisionByColumn: Record<string, string | number | null> = { ...(revisionsByRowId.get(update.rowId) ?? {}) }
          for (const columnKey of Object.keys(update.data as Record<string, unknown>)) revisionByColumn[columnKey] = update.revision
          revisionsByRowId.set(update.rowId, revisionByColumn)
        }

        const cached = options.findCachedRowById(update.rowId)
        if (!cached) continue
        if (!baselinesByRowId.has(update.rowId)) baselinesByRowId.set(update.rowId, cached.node)
        const nextRow = applyRowDataPatch(cached.node.row, update.data)
        if (nextRow === cached.node.row) continue
        options.writeRowCache(cached.index, { ...cached.node, data: nextRow, row: nextRow })
        changed = true
      }

      if (updatesByRowId.size === 0) return Promise.resolve()
      const transaction: DataSourceOptimisticEditTransaction<T> = {
        id: transactionId,
        updatesByRowId,
        previousByRowId,
        revisionsByRowId,
        baselinesByRowId,
      }
      options.mutationEngine.register(transaction)
      options.onMutationStarted(transaction)
      if (changed) {
        options.bumpRevision()
        options.emit()
      }
      return options.mutationEngine.enqueueCommit(() => options.processCommit(transaction))
    },
  }
}
