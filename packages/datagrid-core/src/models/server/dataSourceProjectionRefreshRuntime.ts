import type { DataGridViewportRange } from "../rowModel.js"
import type {
  DataGridDataSourcePullReason,
  DataGridDataSourceTreePullContext,
} from "./dataSourceProtocol.js"

export function createDataSourceProjectionRefreshRuntime(options: {
  resetPaginationCursor: () => void
  clearBackgroundPrefetch: () => void
  clearCache: () => void
  bumpRevision: () => void
  getSourceViewport: () => DataGridViewportRange
  pullRange: (
    range: DataGridViewportRange,
    reason: DataGridDataSourcePullReason,
    treeData: DataGridDataSourceTreePullContext | null,
    replaceCacheOnSuccess: boolean,
  ) => void
  emit: () => void
}) {
  function refresh(
    reason: DataGridDataSourcePullReason,
    treeData: DataGridDataSourceTreePullContext | null = null,
    refreshOptions: { clearCache?: boolean; replaceCacheOnSuccess?: boolean } = {},
  ): void {
    options.resetPaginationCursor()
    options.clearBackgroundPrefetch()
    options.bumpRevision()
    if (refreshOptions.clearCache) options.clearCache()
    options.pullRange(options.getSourceViewport(), reason, treeData, refreshOptions.replaceCacheOnSuccess !== false)
    options.emit()
  }

  return { refresh }
}
