import type {
  DataGridRowId,
} from "../rowModel.js"
import type {
  ApplyComputedFieldsToSourceRowsOptions,
  ApplyComputedFieldsToSourceRowsResult,
} from "./clientRowComputedExecutionRuntime.js"

export interface CreateClientRowComputedApplyRuntimeOptions<T> {
  executeComputedFields: (
    options?: ApplyComputedFieldsToSourceRowsOptions,
  ) => ApplyComputedFieldsToSourceRowsResult<T>
  syncComputedSnapshotFields: () => boolean
  applyComputedUpdates: (updates: ReadonlyMap<DataGridRowId, Partial<T>>) => boolean
  refreshMaterializedSourceRows: (rowIds?: readonly DataGridRowId[]) => void
}

export interface ClientRowComputedApplyRuntime<T> {
  applyComputedFieldsToSourceRows(
    options?: ApplyComputedFieldsToSourceRowsOptions,
  ): ApplyComputedFieldsToSourceRowsResult<T>
}

export function createClientRowComputedApplyRuntime<T>(
  options: CreateClientRowComputedApplyRuntimeOptions<T>,
): ClientRowComputedApplyRuntime<T> {
  return {
    applyComputedFieldsToSourceRows(applyOptions = {}) {
      const result = options.executeComputedFields(applyOptions)
      const fieldsChanged = options.syncComputedSnapshotFields()
      const snapshotChanged = options.applyComputedUpdates(result.computedUpdatesByRowId)
      if (fieldsChanged) {
        options.refreshMaterializedSourceRows()
      } else if (snapshotChanged || result.changed) {
        const changedRowIds = result.changedRowIds.length > 0
          ? result.changedRowIds
          : Array.from(result.computedUpdatesByRowId.keys())
        options.refreshMaterializedSourceRows(changedRowIds)
      }
      return result
    },
  }
}
