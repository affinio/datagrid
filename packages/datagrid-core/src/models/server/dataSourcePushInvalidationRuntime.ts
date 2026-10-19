import type { DataGridViewportRange } from "../rowModel.js"
import type { DataGridDataSourceInvalidation } from "./dataSourceProtocol.js"

export function createDataSourcePushInvalidationRuntime(options: {
  invalidateDataSource: (invalidation: DataGridDataSourceInvalidation) => void
  getSourceViewport: () => DataGridViewportRange
  clearAll: (options: { preserveRange: DataGridViewportRange }) => void
  clearRange: (range: DataGridViewportRange, options?: { preserveRange?: DataGridViewportRange }) => void
  invalidateRows: (rowIds: readonly (string | number)[]) => void
  resolveVisibleRange: (range: DataGridViewportRange, viewport: DataGridViewportRange) => DataGridViewportRange | null
  isBackgroundRangeOverlapping: (range: DataGridViewportRange) => boolean
  clearBackgroundPrefetch: () => void
  pullRange: (range: DataGridViewportRange, projectionRefresh: boolean) => void
  emit: () => void
}) {
  function notifyDataSource(invalidation: DataGridDataSourceInvalidation): void {
    options.invalidateDataSource(invalidation)
  }

  function apply(invalidation: DataGridDataSourceInvalidation): void {
    if (invalidation.kind === "all") {
      const sourceViewport = options.getSourceViewport()
      options.clearAll({ preserveRange: sourceViewport })
      options.clearBackgroundPrefetch()
      notifyDataSource(invalidation)
      options.pullRange(sourceViewport, false)
      return
    }

    if (invalidation.kind === "rows") {
      options.invalidateRows(invalidation.rowIds)
      notifyDataSource(invalidation)
      return
    }

    const sourceViewport = options.getSourceViewport()
    const visibleRefreshRange = options.resolveVisibleRange(invalidation.range, sourceViewport)
    options.clearRange(invalidation.range, visibleRefreshRange ? { preserveRange: sourceViewport } : {})
    if (options.isBackgroundRangeOverlapping(invalidation.range)) {
      options.clearBackgroundPrefetch()
    }
    notifyDataSource(invalidation)
    if (visibleRefreshRange) {
      options.pullRange(visibleRefreshRange, true)
    } else {
      options.emit()
    }
  }

  return { apply }
}
