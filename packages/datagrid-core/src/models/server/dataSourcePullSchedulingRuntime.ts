import type { DataGridViewportRange } from "../rowModel.js"
import type {
  DataGridDataSourceBackpressureDiagnostics,
  DataGridDataSourcePullPriority,
  DataGridDataSourcePullReason,
  DataGridDataSourceTreePullContext,
} from "./dataSourceProtocol.js"
import type { DataSourcePullScheduler } from "./dataSourceScheduler.js"
import type {
  DataGridDataSourceInFlightPull,
  DataGridDataSourcePendingPull,
} from "./dataSourceTransportCoordinator.js"

export interface DataSourcePullSchedulingRuntimeOptions {
  readonly scheduler: DataSourcePullScheduler
  readonly diagnostics: Pick<DataGridDataSourceBackpressureDiagnostics, "pullCoalesced" | "pullDeferred">
  readonly isDisposed: () => boolean
  readonly buildRequestKey: (
    range: DataGridViewportRange,
    reason: DataGridDataSourcePullReason,
    priority: DataGridDataSourcePullPriority,
    treeData: DataGridDataSourceTreePullContext | null,
    stateKey: string,
  ) => string
  readonly readLaneInFlight: (priority: DataGridDataSourcePullPriority) => DataGridDataSourceInFlightPull | null
  readonly readPendingPull: (priority: "critical" | "background") => DataGridDataSourcePendingPull | null
  readonly writePendingPull: (priority: "critical" | "background", value: DataGridDataSourcePendingPull | null) => void
  readonly pullRange: (
    range: DataGridViewportRange,
    reason: DataGridDataSourcePullReason,
    priority: DataGridDataSourcePullPriority,
    treeData?: DataGridDataSourceTreePullContext | null,
  ) => Promise<void>
  readonly emit: () => void
}

export function createDataSourcePullSchedulingRuntime(options: DataSourcePullSchedulingRuntimeOptions) {
  let viewportPullSchedulePending = false

  function scheduleViewportPull(
    requestRange: DataGridViewportRange,
    requestStateKey: string,
    treePullContext: DataGridDataSourceTreePullContext | null = null,
  ): void {
    options.scheduler.setScheduledViewport({
      range: requestRange,
      reason: "viewport-change",
      priority: "critical",
      key: options.buildRequestKey(requestRange, "viewport-change", "critical", treePullContext, requestStateKey),
      stateKey: requestStateKey,
      treeData: treePullContext,
    })
    options.diagnostics.pullCoalesced += viewportPullSchedulePending ? 1 : 0
    options.diagnostics.pullDeferred += 1
    if (viewportPullSchedulePending) {
      options.emit()
      return
    }
    viewportPullSchedulePending = true
    queueMicrotask(() => {
      viewportPullSchedulePending = false
      const next = options.scheduler.readScheduledViewport()
      options.scheduler.setScheduledViewport(null)
      if (!next || options.isDisposed()) {
        return
      }
      void options.pullRange(next.range, next.reason, next.priority, next.treeData)
    })
    options.emit()
  }

  async function drainCriticalBackpressureQueue(): Promise<void> {
    while (!options.isDisposed()) {
      const activeCritical = options.readLaneInFlight("critical")?.promise ?? null
      if (activeCritical) {
        await activeCritical.catch(() => {})
        continue
      }
      const nextCritical = options.readPendingPull("critical")
      if (nextCritical) {
        options.writePendingPull("critical", null)
        await options.pullRange(nextCritical.range, nextCritical.reason, nextCritical.priority, nextCritical.treeData)
        continue
      }
      return
    }
  }

  return {
    scheduleViewportPull,
    drainCriticalBackpressureQueue,
    reset() {
      viewportPullSchedulePending = false
    },
  }
}
