import type { DataGridRowId, DataGridRowNode } from "../rowModel.js"
import { applyRowDataPatch } from "../clientRowRuntimeUtils.js"
import { collectChangedFieldsFromPatches } from "../mutation/rowPatchAnalyzer.js"
import type { DataGridDataSourceRowEntry } from "./dataSourceProtocol.js"

export type DataGridExternalRowUpdate<T = unknown> =
  | { rowId: DataGridRowId; data: Partial<T> | null; row?: never; index?: number | null }
  | { rowId: DataGridRowId; row: T | null; data?: never; index?: number | null }

export interface DataGridExternalRowUpdateOptions {
  recompute?: boolean | {
    sort?: boolean
    filter?: boolean
    group?: boolean
    pivot?: boolean
    aggregation?: boolean
  }
  signal?: AbortSignal | null
}

export interface DataSourceExternalUpdateRuntimeOptions<T> {
  ensureActive(): void
  findCachedRowById(rowId: DataGridRowId): { index: number; node: DataGridRowNode<T> } | null
  applyRows(rows: readonly DataGridDataSourceRowEntry<T>[]): boolean
  writeRowCache(index: number, row: DataGridRowNode<T>): void
  bumpRevision(): void
  shouldRefresh(changedFields: ReadonlySet<string>, recompute: DataGridExternalRowUpdateOptions["recompute"]): boolean
  refreshVisibleRows(): Promise<void>
  updateCachedCoverage(): void
  emit(): void
}

export function createDataSourceExternalUpdateRuntime<T>(
  options: DataSourceExternalUpdateRuntimeOptions<T>,
): {
  applyExternalUpdates(updates: readonly DataGridExternalRowUpdate<T>[], updateOptions?: DataGridExternalRowUpdateOptions): void | Promise<void>
} {
  return {
    applyExternalUpdates(updates, updateOptions) {
      options.ensureActive()
      if (updateOptions?.signal?.aborted) {
        const abortError = new Error("[DataGridDataSource] applyExternalUpdates aborted.")
        abortError.name = "AbortError"
        throw abortError
      }
      if (!Array.isArray(updates) || updates.length === 0) return

      let changed = false
      const changedRowsById = new Map<DataGridRowId, Partial<T>>()
      for (const update of updates) {
        if (!update || typeof update.rowId !== "string" && typeof update.rowId !== "number") continue
        const hasRow = "row" in update && update.row !== null && typeof update.row !== "undefined"
        const hasData = "data" in update && update.data !== null && typeof update.data !== "undefined"
        if (!hasRow && !hasData) continue

        const hasIndex = Number.isFinite(update.index)
        if (hasRow && hasIndex) {
          changed = options.applyRows([{
            index: Math.max(0, Math.trunc(update.index as number)),
            row: update.row as T,
            rowId: update.rowId,
          }]) || changed
          changedRowsById.set(update.rowId, update.row as Partial<T>)
          continue
        }

        const cached = options.findCachedRowById(update.rowId)
        if (!cached) continue
        const nextRow = hasRow ? update.row as T : applyRowDataPatch(cached.node.row, update.data as Partial<T>)
        if (nextRow === cached.node.row) continue
        options.writeRowCache(cached.index, { ...cached.node, data: nextRow, row: nextRow })
        changedRowsById.set(update.rowId, hasRow ? update.row as Partial<T> : update.data as Partial<T>)
        changed = true
      }

      if (!changed) return
      options.bumpRevision()
      const changedFields = collectChangedFieldsFromPatches(changedRowsById)
      if (options.shouldRefresh(changedFields, updateOptions?.recompute)) return options.refreshVisibleRows()
      options.updateCachedCoverage()
      options.emit()
    },
  }
}
