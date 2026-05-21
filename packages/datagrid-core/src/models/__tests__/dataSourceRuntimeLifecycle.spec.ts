import { describe, expect, it } from "vitest"
import { createDataSourceCacheManager } from "../server/dataSourceCacheManager"
import { createDataSourceOptimisticMutationEngine } from "../server/dataSourceOptimisticMutationEngine"
import { createDataSourceRuntimeLifecycle } from "../server/dataSourceRuntimeLifecycle"
import { createDataSourceTelemetryRuntime } from "../server/dataSourceTelemetryRuntime"
import { createDataSourcePullScheduler } from "../server/dataSourceScheduler"
import type { DataGridDataSourceBackpressureDiagnostics } from "../server/dataSourceProtocol"

function createDiagnostics(): DataGridDataSourceBackpressureDiagnostics {
  return {
    pullRequested: 0,
    pullCompleted: 0,
    pullAborted: 0,
    pullDropped: 0,
    pullCoalesced: 0,
    pullDeferred: 0,
    rowCacheEvicted: 0,
    pushApplied: 0,
    invalidatedRows: 0,
    inFlight: false,
    paused: false,
    hasPendingPull: true,
    rowCacheSize: 0,
    prefetchScheduled: 0,
    prefetchStarted: 0,
    prefetchCompleted: 0,
    prefetchSkippedCached: 0,
    prefetchCoalesced: 0,
    prefetchDroppedStale: 0,
    prefetchAborted: 0,
    cachedAheadRows: 0,
    cachedBehindRows: 0,
    criticalInFlight: false,
    backgroundInFlight: false,
    placeholderExposureActiveRows: 0,
    placeholderExposureEvents: 0,
    placeholderExposureTotalMs: 0,
    placeholderExposureMaxMs: 0,
    placeholderExposureLastMs: 0,
    viewportDataAvailabilityEvents: 0,
    viewportDataAvailabilityTotalMs: 0,
    viewportDataAvailabilityMaxMs: 0,
    viewportDataAvailabilityLastMs: 0,
    viewportCacheHitRows: 0,
    viewportCacheMissRows: 0,
    viewportCacheHitRatio: 1,
    blankViewportActive: false,
    blankViewportEvents: 0,
    pullDurationEvents: 0,
    pullDurationTotalMs: 0,
    pullDurationMaxMs: 0,
    pullDurationLastMs: 0,
  }
}

describe("data source runtime lifecycle", () => {
  it("runs init, attach, suspend, resume, and dispose transitions deterministically", () => {
    const calls: string[] = []
    const lifecycle = createDataSourceRuntimeLifecycle({
      service: "transport-coordinator",
      onInit: () => calls.push("init"),
      onAttach: () => calls.push("attach"),
      onSuspend: () => calls.push("suspend"),
      onResume: () => calls.push("resume"),
      onDispose: () => calls.push("dispose"),
    })

    expect(lifecycle.getLifecycleSnapshot()).toEqual({
      service: "transport-coordinator",
      phase: "created",
    })

    lifecycle.init()
    lifecycle.attach()
    expect(lifecycle.suspend()).toBe(true)
    expect(lifecycle.suspend()).toBe(false)
    expect(lifecycle.resume()).toBe(true)
    lifecycle.dispose()
    lifecycle.attach()

    expect(lifecycle.getLifecycleSnapshot().phase).toBe("disposed")
    expect(calls).toEqual(["init", "attach", "suspend", "resume", "dispose"])
  })

  it("attaches scheduler diagnostics in a deterministic empty state", () => {
    const diagnostics = createDiagnostics()
    const scheduler = createDataSourcePullScheduler(diagnostics)

    scheduler.init()
    scheduler.attach()

    expect(scheduler.getLifecycleSnapshot()).toEqual({
      service: "scheduler",
      phase: "attached",
    })
    expect(diagnostics.hasPendingPull).toBe(false)
    expect(scheduler.hasPending()).toBe(false)
  })

  it("dispose clears scheduler pending pulls and blocks later writes", () => {
    const diagnostics = createDiagnostics()
    const scheduler = createDataSourcePullScheduler(diagnostics)
    const pending = {
      range: { start: 1, end: 2 },
      reason: "viewport-change" as const,
      priority: "critical" as const,
      key: "key",
      stateKey: "state",
      treeData: null,
    }

    scheduler.attach()
    scheduler.write("critical", pending)
    expect(scheduler.hasPending()).toBe(true)

    scheduler.dispose()
    scheduler.write("critical", pending)

    expect(scheduler.hasPending()).toBe(false)
    expect(scheduler.read("critical")).toBeNull()
    expect(diagnostics.hasPendingPull).toBe(false)
  })

  it("attaches cache, telemetry, and optimistic mutation services without residual state", () => {
    const cacheManager = createDataSourceCacheManager<{ id: number }>({
      rowCacheLimit: 4,
      rangeCacheChunkSize: 2,
    })
    const diagnostics = createDiagnostics()
    const telemetry = createDataSourceTelemetryRuntime(diagnostics)
    const optimisticMutationEngine = createDataSourceOptimisticMutationEngine<{ id: number }>()

    cacheManager.rowCache.set(1, {
      kind: "leaf",
      row: { id: 1 },
      data: { id: 1 },
      rowId: 1,
      rowKey: "1",
      sourceIndex: 1,
      originalIndex: 1,
      displayIndex: 1,
      state: {
        selected: false,
        group: false,
        pinned: "none",
        expanded: false,
      },
    })
    cacheManager.staleRetainedRowIndexes.add(1)
    cacheManager.rangeCache.beginLoad({ start: 0, end: 1 })

    cacheManager.attach()
    telemetry.attach()
    optimisticMutationEngine.attach()

    expect(cacheManager.rowCache.size).toBe(0)
    expect(cacheManager.staleRetainedRowIndexes.size).toBe(0)
    expect(telemetry.getLifecycleSnapshot().phase).toBe("attached")
    expect(optimisticMutationEngine.getPendingCount()).toBe(0)
  })
})
