import type { DataGridDataSourceBackpressureDiagnostics } from "./dataSourceProtocol.js"
import {
  createDataSourceRuntimeLifecycle,
  type DataSourceRuntimeLifecycle,
} from "./dataSourceRuntimeLifecycle.js"
import type { DataGridDataSourcePendingPull } from "./dataSourceTransportCoordinator.js"

export interface DataSourcePullScheduler extends DataSourceRuntimeLifecycle {
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

  function clearPending(): void {
    pendingCriticalPull = null
    pendingBackgroundPull = null
    scheduledViewportPull = null
    updateDiagnostics()
  }

  const lifecycle = createDataSourceRuntimeLifecycle({
    service: "scheduler",
    onAttach: updateDiagnostics,
    onDispose: clearPending,
  })

  return {
    ...lifecycle,
    read(priority) {
      if (lifecycle.isDisposed()) {
        return null
      }
      return priority === "background" ? pendingBackgroundPull : pendingCriticalPull
    },
    write(priority, value) {
      if (lifecycle.isDisposed()) {
        return
      }
      if (priority === "background") {
        pendingBackgroundPull = value
      } else {
        pendingCriticalPull = value
      }
      updateDiagnostics()
    },
    clearBackground(reason = "stale") {
      if (lifecycle.isDisposed()) {
        return null
      }
      const previous = pendingBackgroundPull
      if (previous && reason === "stale") {
        diagnostics.prefetchDroppedStale += 1
      }
      pendingBackgroundPull = null
      updateDiagnostics()
      return previous
    },
    clearScheduledViewport() {
      if (lifecycle.isDisposed()) {
        return null
      }
      const previous = scheduledViewportPull
      if (previous) {
        diagnostics.pullDropped += 1
      }
      scheduledViewportPull = null
      updateDiagnostics()
      return previous
    },
    setScheduledViewport(value) {
      if (lifecycle.isDisposed()) {
        return
      }
      scheduledViewportPull = value
      updateDiagnostics()
    },
    readScheduledViewport() {
      if (lifecycle.isDisposed()) {
        return null
      }
      return scheduledViewportPull
    },
    hasPending() {
      if (lifecycle.isDisposed()) {
        return false
      }
      return Boolean(pendingCriticalPull || pendingBackgroundPull || scheduledViewportPull)
    },
  }
}
