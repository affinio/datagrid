import type { DataGridViewportRange } from "../rowModel.js"
import type {
  DataGridDataSourcePullReason,
  DataGridDataSourceTreePullContext,
} from "./dataSourceProtocol.js"

export function createDataSourceProjectionRefreshRuntime(options: {
  resetPaginationCursor: () => void
  clearBackgroundPrefetch: () => void
  bumpRevision: () => void
  getSourceViewport: () => DataGridViewportRange
  pullRange: (
    range: DataGridViewportRange,
    reason: DataGridDataSourcePullReason,
    treeData: DataGridDataSourceTreePullContext | null,
  ) => void
  emit: () => void
}) {
  function refresh(
    reason: DataGridDataSourcePullReason,
    treeData: DataGridDataSourceTreePullContext | null = null,
  ): void {
    options.resetPaginationCursor()
    options.clearBackgroundPrefetch()
    options.bumpRevision()
    options.pullRange(options.getSourceViewport(), reason, treeData)
    options.emit()
  }

  return { refresh }
}
