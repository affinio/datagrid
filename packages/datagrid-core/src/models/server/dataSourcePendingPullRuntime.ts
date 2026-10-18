import type { DataGridViewportRange } from "../rowModel.js"
import type {
  DataGridDataSourcePullPriority,
  DataGridDataSourcePullReason,
  DataGridDataSourceTreePullContext,
} from "./dataSourceProtocol.js"
import type {
  DataGridDataSourceInFlightPull,
  DataGridDataSourcePendingPull,
} from "./dataSourceTransportCoordinator.js"
import { rangeContains, rangesOverlap, resolvePriorityRank } from "./dataSourceTransportCoordinator.js"

export interface DataSourcePendingPullDiagnostics {
  pullCoalesced: number
  prefetchCoalesced: number
  prefetchDroppedStale: number
  pullDeferred: number
}

export interface DataSourcePendingPullRuntimeOptions {
  diagnostics: DataSourcePendingPullDiagnostics
  readLaneInFlight(priority: DataGridDataSourcePullPriority): DataGridDataSourceInFlightPull | null
  readPendingPull(priority: DataGridDataSourcePullPriority): DataGridDataSourcePendingPull | null
  writePendingPull(priority: DataGridDataSourcePullPriority, value: DataGridDataSourcePendingPull | null): void
  buildRequestKey(
    range: DataGridViewportRange,
    reason: DataGridDataSourcePullReason,
    priority: DataGridDataSourcePullPriority,
    treeData: DataGridDataSourceTreePullContext | null,
    stateKey: string,
  ): string
  emit(): void
}

export function createDataSourcePendingPullRuntime(options: DataSourcePendingPullRuntimeOptions) {
  return {
    queue(
      requestRange: DataGridViewportRange,
      reason: DataGridDataSourcePullReason,
      priority: DataGridDataSourcePullPriority,
      requestKey: string,
      requestStateKey: string,
      treePullContext: DataGridDataSourceTreePullContext | null,
    ): Promise<void> {
      const active = options.readLaneInFlight(priority)
      const pending = options.readPendingPull(priority)
      if (pending && pending.key === requestKey) {
        options.diagnostics.pullCoalesced += 1
        if (priority === "background") options.diagnostics.prefetchCoalesced += 1
        return active?.promise ?? Promise.resolve()
      }
      if (priority === "background" && pending && pending.stateKey === requestStateKey) {
        if (rangeContains(pending.range, requestRange)) {
          options.diagnostics.pullCoalesced += 1
          options.diagnostics.prefetchCoalesced += 1
          return active?.promise ?? Promise.resolve()
        }
        const adjacentOrOverlapping = rangesOverlap(pending.range, requestRange)
          || pending.range.end + 1 === requestRange.start
          || requestRange.end + 1 === pending.range.start
        if (adjacentOrOverlapping) {
          const range = {
            start: Math.min(pending.range.start, requestRange.start),
            end: Math.max(pending.range.end, requestRange.end),
          }
          options.writePendingPull(priority, {
            range,
            reason,
            priority,
            key: options.buildRequestKey(range, reason, priority, treePullContext, requestStateKey),
            stateKey: requestStateKey,
            treeData: treePullContext,
          })
          options.diagnostics.pullCoalesced += 1
          options.diagnostics.prefetchCoalesced += 1
          options.diagnostics.pullDeferred += 1
          options.emit()
          return active?.promise ?? Promise.resolve()
        }
        options.diagnostics.prefetchDroppedStale += 1
      }
      const pendingRank = pending ? resolvePriorityRank(pending.priority) : -1
      const nextRank = resolvePriorityRank(priority)
      if (nextRank >= pendingRank) {
        options.writePendingPull(priority, {
          range: requestRange,
          reason,
          priority,
          key: requestKey,
          stateKey: requestStateKey,
          treeData: treePullContext,
        })
      }
      options.diagnostics.pullDeferred += 1
      options.emit()
      return active?.promise ?? Promise.resolve()
    },
  }
}
