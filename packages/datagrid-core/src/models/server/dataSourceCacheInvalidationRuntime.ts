import type { DataGridRowNode, DataGridViewportRange } from "../rowModel.js"
import type { DataGridDataSourceBackpressureDiagnostics } from "./dataSourceProtocol.js"
import type { DataSourceRuntimeSignalPayloads } from "./dataSourceRuntimeSignals.js"
import { normalizeRequestedRange } from "./dataSourceTransportCoordinator.js"
import { normalizeViewportRange } from "../rowModel.js"

export function createDataSourceCacheInvalidationRuntime<T>(options: {
  getRowCache: () => Map<number, DataGridRowNode<T>>
  getStaleRetainedRowIndexes: () => Set<number>
  getCacheStateKeyByIndex: () => Map<number, string>
  getRangeCache: () => { deleteRow(index: number): boolean; reset(): void }
  diagnostics: Pick<DataGridDataSourceBackpressureDiagnostics, "invalidatedRows" | "rowCacheSize">
  getRowCount: () => number
  bumpRevision: () => void
  emitCacheInvalidated: (payload: DataSourceRuntimeSignalPayloads["cacheInvalidated"]) => void
  updateLoadingState: () => void
  updateViewportCoverage: () => void
  resetViewportDataAvailability: () => void
}) {
  function clearRange(
    range: DataGridViewportRange,
    clearOptions: { preserveRange?: DataGridViewportRange | null } = {},
  ): void {
    const rowCache = options.getRowCache()
    const staleRetainedRowIndexes = options.getStaleRetainedRowIndexes()
    const rangeCache = options.getRangeCache()
    const rowCount = options.getRowCount()
    if (rowCount <= 0) {
      return
    }
    const normalized = normalizeRequestedRange(range)
    const bounded = normalizeViewportRange(normalized, rowCount)
    const preserveRange = clearOptions.preserveRange
      ? normalizeRequestedRange(clearOptions.preserveRange)
      : null
    let changed = false
    let removedRows = 0
    for (let index = bounded.start; index <= bounded.end; index += 1) {
      if (preserveRange && index >= preserveRange.start && index <= preserveRange.end) {
        continue
      }
      if (rowCache.delete(index)) {
        staleRetainedRowIndexes.delete(index)
        rangeCache.deleteRow(index)
        options.diagnostics.invalidatedRows += 1
        removedRows += 1
        changed = true
      }
    }
    if (changed) {
      options.bumpRevision()
      options.emitCacheInvalidated({
        kind: "range",
        removedRows,
        range: bounded,
        preserveRange,
        reason: "range-clear",
      })
    }
    options.diagnostics.rowCacheSize = rowCache.size
    options.updateLoadingState()
  }

  function clearAll(clearOptions: { preserveRange?: DataGridViewportRange | null } = {}): void {
    const rowCache = options.getRowCache()
    const staleRetainedRowIndexes = options.getStaleRetainedRowIndexes()
    const cacheStateKeyByIndex = options.getCacheStateKeyByIndex()
    const rangeCache = options.getRangeCache()
    const preserveRange = clearOptions.preserveRange
      ? normalizeRequestedRange(clearOptions.preserveRange)
      : null
    if (preserveRange) {
      if (rowCache.size > 0) {
        options.bumpRevision()
      }
      let removedRows = 0
      for (const index of Array.from(rowCache.keys())) {
        if (index >= preserveRange.start && index <= preserveRange.end) {
          continue
        }
        if (rowCache.delete(index)) {
          staleRetainedRowIndexes.delete(index)
          rangeCache.deleteRow(index)
          removedRows += 1
        }
      }
      options.diagnostics.invalidatedRows += removedRows
      if (removedRows > 0) {
        options.emitCacheInvalidated({
          kind: "all",
          removedRows,
          preserveRange,
          reason: "clear-all-preserve-range",
        })
      }
      options.diagnostics.rowCacheSize = rowCache.size
      options.updateLoadingState()
      options.updateViewportCoverage()
      return
    }

    if (rowCache.size > 0) {
      options.bumpRevision()
    }
    const removedRows = rowCache.size
    options.diagnostics.invalidatedRows += removedRows
    if (removedRows > 0) {
      options.emitCacheInvalidated({
        kind: "all",
        removedRows,
        preserveRange: null,
        reason: "clear-all",
      })
    }
    rowCache.clear()
    cacheStateKeyByIndex.clear()
    staleRetainedRowIndexes.clear()
    rangeCache.reset()
    options.diagnostics.rowCacheSize = rowCache.size
    options.resetViewportDataAvailability()
    options.updateLoadingState()
  }

  return { clearRange, clearAll }
}
