import { describe, expect, it } from "vitest"
import { computeFrameMetrics } from "../../../../../scripts/datagrid-frame-metrics.mjs"

describe("refresh-aware frame metrics", () => {
  it("counts missed 60Hz refresh opportunities independently of legacy 20ms intervals", () => {
    const metrics = computeFrameMetrics([16.6, 16.7, 33.4, 50], 60)
    expect(metrics.refreshRateHz).toBe(60)
    expect(metrics.refreshAwareDroppedFrames).toBe(4)
    expect(metrics.refreshAwareDroppedPct).toBeGreaterThan(0)
    expect(metrics.droppedFrames).toBe(2)
  })

  it("uses the configured 120Hz budget", () => {
    const metrics = computeFrameMetrics([8.3, 16.7, 25], 120)
    expect(metrics.refreshRateHz).toBe(120)
    expect(metrics.refreshAwareDroppedFrames).toBe(2)
  })
})
