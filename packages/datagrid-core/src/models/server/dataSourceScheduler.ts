import type { DataGridDataSourceBackpressureDiagnostics } from "./dataSourceProtocol.js"
import type { DataGridDataSourcePendingPull } from "./dataSourceTransportCoordinator.js"

export interface DataSourcePullScheduler {
  read(priority: "critical" | "background"): DataGridDataSourcePendingPull | null
  write(priority: "critical" | "background", value: DataGridDataSourcePendingPull | null): void
  clearBackground(reason?: "stale" | "reset"): DataGridDataSourcePendingPull | null
  clearScheduledViewport(): DataGridDataSourcePendingPull | null
  setScheduledViewport(value: DataGridDataSourcePendingPull | null): void
  readScheduledViewport(): DataGridDataSourcePendingPull | null
  hasPending(): boolean
}

export function createDataSourcePullScheduler(
  diagnostics: Pick<
    DataGridDataSourceBackpressureDiagnostics,
    "hasPendingPull" | "prefetchDroppedStale" | "pullDropped"
  >,
): DataSourcePullScheduler {
  let pendingCriticalPull: DataGridDataSourcePendingPull | null = null
  let pendingBackgroundPull: DataGridDataSourcePendingPull | null = null
  let scheduledViewportPull: DataGridDataSourcePendingPull | null = null

  function updateDiagnostics(): void {
    diagnostics.hasPendingPull = Boolean(pendingCriticalPull || pendingBackgroundPull || scheduledViewportPull)
  }

  return {
    read(priority) {
      return priority === "background" ? pendingBackgroundPull : pendingCriticalPull
    },
    write(priority, value) {
      if (priority === "background") {
        pendingBackgroundPull = value
      } else {
        pendingCriticalPull = value
      }
      updateDiagnostics()
    },
    clearBackground(reason = "stale") {
      const previous = pendingBackgroundPull
      if (previous && reason === "stale") {
        diagnostics.prefetchDroppedStale += 1
      }
      pendingBackgroundPull = null
      updateDiagnostics()
      return previous
    },
    clearScheduledViewport() {
      const previous = scheduledViewportPull
      if (previous) {
        diagnostics.pullDropped += 1
      }
      scheduledViewportPull = null
      updateDiagnostics()
      return previous
    },
    setScheduledViewport(value) {
      scheduledViewportPull = value
      updateDiagnostics()
    },
    readScheduledViewport() {
      return scheduledViewportPull
    },
    hasPending() {
      return Boolean(pendingCriticalPull || pendingBackgroundPull || scheduledViewportPull)
    },
  }
}
