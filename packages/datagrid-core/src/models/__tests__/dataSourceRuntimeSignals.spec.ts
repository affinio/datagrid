import { describe, expect, it } from "vitest"
import { createDataSourceRuntimeSignals } from "../server/dataSourceRuntimeSignals"

describe("createDataSourceRuntimeSignals", () => {
  it("emits typed datasource signals in subscription order", () => {
    const signals = createDataSourceRuntimeSignals()
    const events: string[] = []

    signals.attach()
    signals.subscribe("pullStarted", event => {
      events.push(`first:${event.requestId}:${event.reason}`)
    })
    signals.subscribe("pullStarted", event => {
      events.push(`second:${event.priority}:${event.range.start}-${event.range.end}`)
    })
    signals.subscribe("pullSettled", event => {
      events.push(`settled:${event.status}`)
    })

    signals.emit("pullStarted", {
      requestId: 7,
      range: { start: 3, end: 5 },
      priority: "critical",
      reason: "viewport-change",
    })
    signals.emit("pullSettled", {
      requestId: 7,
      range: { start: 3, end: 5 },
      priority: "critical",
      reason: "viewport-change",
      status: "completed",
    })

    expect(events).toEqual([
      "first:7:viewport-change",
      "second:critical:3-5",
      "settled:completed",
    ])
  })

  it("unsubscribes listeners independently", () => {
    const signals = createDataSourceRuntimeSignals()
    const events: string[] = []

    signals.attach()
    const unsubscribe = signals.subscribe("cacheInvalidated", event => {
      events.push(`${event.kind}:${event.removedRows}`)
    })

    signals.emit("cacheInvalidated", {
      kind: "range",
      removedRows: 2,
      range: { start: 1, end: 2 },
    })
    unsubscribe()
    signals.emit("cacheInvalidated", {
      kind: "all",
      removedRows: 5,
      preserveRange: null,
    })

    expect(events).toEqual(["range:2"])
  })

  it("clears listeners and ignores future emits after dispose", () => {
    const signals = createDataSourceRuntimeSignals()
    const events: string[] = []

    signals.attach()
    signals.subscribe("optimisticMutationStarted", event => {
      events.push(`started:${event.transactionId}`)
    })
    signals.dispose()
    signals.emit("optimisticMutationStarted", {
      transactionId: 1,
      rowIds: [1],
    })
    signals.subscribe("optimisticMutationSettled", event => {
      events.push(`settled:${event.status}`)
    })
    signals.emit("optimisticMutationSettled", {
      transactionId: 1,
      rowIds: [1],
      status: "committed",
    })

    expect(events).toEqual([])
  })

  it("carries viewport coverage payloads without generic event casting", () => {
    const signals = createDataSourceRuntimeSignals()
    let hitRatio = 0
    let blankViewportActive = false

    signals.attach()
    signals.subscribe("viewportCoverageChanged", event => {
      hitRatio = event.hitRatio
      blankViewportActive = event.blankViewportActive
    })

    signals.emit("viewportCoverageChanged", {
      sourceViewport: { start: 10, end: 19 },
      visibleRowCount: 10,
      hitRows: 4,
      missRows: 6,
      hitRatio: 0.4,
      blankViewportActive: false,
    })

    expect(hitRatio).toBe(0.4)
    expect(blankViewportActive).toBe(false)
  })
})
