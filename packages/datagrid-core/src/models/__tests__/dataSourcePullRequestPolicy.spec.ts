import { describe, expect, it } from "vitest"
import type { DataGridDataSourceInFlightPull } from "../server/dataSourceTransportCoordinator"
import { resolveDataSourcePullRequestPolicy } from "../server/dataSourcePullRequestPolicy"

function inFlight(overrides: Partial<DataGridDataSourceInFlightPull> = {}): DataGridDataSourceInFlightPull {
  return {
    requestId: 1,
    controller: new AbortController(),
    key: "request",
    stateKey: "state",
    range: { start: 10, end: 19 },
    promise: Promise.resolve(),
    priority: "normal",
    reason: "refresh",
    affectsLoading: true,
    rangeCacheToken: {} as DataGridDataSourceInFlightPull["rangeCacheToken"],
    ...overrides,
  }
}

function policyInput(overrides: Partial<Parameters<typeof resolveDataSourcePullRequestPolicy>[0]> = {}) {
  return {
    range: { start: 10, end: 19 },
    key: "request",
    stateKey: "state",
    reason: "refresh" as const,
    priority: "normal" as const,
    laneInFlight: null,
    backgroundInFlight: null,
    criticalInFlight: null,
    pendingBackgroundPull: null,
    ...overrides,
  }
}

describe("resolveDataSourcePullRequestPolicy", () => {
  it("coalesces an identical in-flight request in its lane", () => {
    const active = inFlight()
    expect(resolveDataSourcePullRequestPolicy(policyInput({ laneInFlight: active }))).toEqual({
      kind: "coalesce",
      promise: active.promise,
      countPrefetch: false,
    })
  })

  it("coalesces a viewport request covered by a same-state in-flight range", () => {
    const active = inFlight({ key: "other", priority: "critical" })
    expect(resolveDataSourcePullRequestPolicy(policyInput({
      range: { start: 12, end: 14 },
      key: "viewport-request",
      reason: "viewport-change",
      priority: "normal",
      laneInFlight: active,
      criticalInFlight: active,
    }))).toEqual({ kind: "coalesce", promise: active.promise, countPrefetch: false })
  })

  it("queues background pulls behind an active critical pull", () => {
    const active = inFlight({ priority: "critical" })
    expect(resolveDataSourcePullRequestPolicy(policyInput({
      priority: "background",
      laneInFlight: null,
      criticalInFlight: active,
    }))).toEqual({ kind: "queue", priority: "background" })
  })

  it("marks stale background state for removal before starting a foreground pull", () => {
    const stale = inFlight({ stateKey: "old-state", priority: "background" })
    const decision = resolveDataSourcePullRequestPolicy(policyInput({
      backgroundInFlight: stale,
      laneInFlight: null,
    }))
    expect(decision).toEqual({
      kind: "start",
      abortBackground: "stale",
      dropPendingBackground: false,
      abortLane: false,
    })
  })
})
