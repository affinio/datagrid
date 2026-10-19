import type { DataGridPivotColumn } from "../rowModel.js"
import type { DataGridDataSourcePushEvent, DataGridDataSourceRowEntry } from "./dataSourceProtocol.js"

export function createDataSourcePushEventRuntime<T>(options: {
  isDisposed: () => boolean
  recordPushApplied: () => void
  updateDatasetVersion: (version: string | number | null | undefined) => boolean
  applyRows: (rows: readonly DataGridDataSourceRowEntry<T>[]) => boolean
  setCursor: (cursor: string | null | undefined) => void
  applyTotal: (total: number | null | undefined) => boolean
  applyPivotColumns: (columns: readonly DataGridPivotColumn[] | undefined) => boolean
  removeIndexes: (indexes: readonly number[]) => boolean
  bumpRevision: () => void
  updateCoverage: () => void
  emit: () => void
  applyInvalidation: (invalidation: Extract<DataGridDataSourcePushEvent<T>, { type: "invalidate" }>['invalidation']) => void
}) {
  function apply(event: DataGridDataSourcePushEvent<T>): void {
    if (options.isDisposed()) return
    options.recordPushApplied()
    const versionChanged = options.updateDatasetVersion(event.datasetVersion)

    if (event.type === "upsert") {
      let changed = options.applyRows(event.rows) || versionChanged
      options.setCursor(event.cursor)
      changed = options.applyTotal(event.total) || changed
      changed = options.applyPivotColumns(event.pivotColumns) || changed
      if (changed) options.bumpRevision()
      options.updateCoverage()
      options.emit()
      return
    }

    if (event.type === "remove") {
      let changed = options.removeIndexes(event.indexes) || versionChanged
      changed = options.applyTotal(event.total) || changed
      if (changed) options.bumpRevision()
      options.updateCoverage()
      options.emit()
      return
    }

    options.applyInvalidation(event.invalidation)
  }

  return { apply }
}
