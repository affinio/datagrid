import { describe, expect, it, vi } from "vitest"
import { createDataSourcePrefetchRuntime } from "../server/dataSourcePrefetchPolicy"

const policy = {
  enabled: true,
  triggerViewportFactor: 1,
  windowViewportFactor: 2,
  minBatchSize: 1,
  maxBatchSize: 20,
  directionalBias: "forward" as const,
}

function diagnostics() {
  return {
    cachedAheadRows: 0,
    cachedBehindRows: 0,
    prefetchSkippedCached: 0,
    prefetchScheduled: 0,
  }
}

describe("createDataSourcePrefetchRuntime", () => {
  it("updates coverage and schedules a missing forward range", () => {
    const stats = diagnostics()
    const updateCoverage = vi.fn()
    const pullRange = vi.fn(() => Promise.resolve())
    const runtime = createDataSourcePrefetchRuntime({
      policy,
      diagnostics: stats,
      isDisposed: () => false,
      getVisibleRowCount: () => 10,
      getRowCount: () => 100,
      getSourceViewport: () => ({ start: 20, end: 29 }),
      getLastViewportDirection: () => 1,
      updateCoverage,
      countCachedForward: () => 0,
      countCachedBackward: () => 0,
      isRangeFullyCached: () => false,
      pullRange,
    })

    runtime.schedule()

    expect(updateCoverage).toHaveBeenCalledWith({ start: 20, end: 29 })
    expect(stats.prefetchScheduled).toBe(1)
    expect(pullRange).toHaveBeenCalledWith({ start: 30, end: 49 }, "prefetch", "background")
  })

  it("resets coverage for an empty model and skips unavailable candidates", () => {
    const stats = diagnostics()
    const runtime = createDataSourcePrefetchRuntime({
      policy,
      diagnostics: stats,
      isDisposed: () => false,
      getVisibleRowCount: () => 0,
      getRowCount: () => 0,
      getSourceViewport: () => ({ start: 0, end: 0 }),
      getLastViewportDirection: () => 0,
      updateCoverage: () => {},
      countCachedForward: () => 0,
      countCachedBackward: () => 0,
      isRangeFullyCached: () => false,
      pullRange: () => Promise.resolve(),
    })
    stats.cachedAheadRows = 9
    stats.cachedBehindRows = 3
    runtime.schedule()
    expect(stats.cachedAheadRows).toBe(0)
    expect(stats.cachedBehindRows).toBe(0)
    expect(stats.prefetchSkippedCached).toBe(0)
  })
})
