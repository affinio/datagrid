import { describe, expect, it } from "vitest"
import type { ViewportSyncState, ViewportSyncTargets } from "../dataGridViewportTypes"
import { createDataGridViewportRenderSyncService } from "../dataGridViewportRenderSyncService"

function createTargets(): ViewportSyncTargets {
  return {
    scrollHost: document.createElement("div"),
    mainViewport: document.createElement("div"),
    layoutRoot: document.createElement("div"),
    bodyLayer: document.createElement("div"),
    headerLayer: document.createElement("div"),
    pinnedLeftLayer: document.createElement("div"),
    pinnedRightLayer: document.createElement("div"),
    overlayRoot: document.createElement("div"),
  }
}

describe("table viewport render sync service", () => {
  it("applies sync targets and keeps deterministic reapply semantics", () => {
    const state: ViewportSyncState = {
      scrollTop: 0,
      scrollLeft: 0,
      pinnedOffsetLeft: 0,
      pinnedOffsetRight: 0,
    }
    const targets = createTargets()
    const service = createDataGridViewportRenderSyncService({
      syncState: state,
      resolveNextState: () => ({
        scrollTop: 24,
        scrollLeft: 64,
        pinnedOffsetLeft: state.pinnedOffsetLeft,
        pinnedOffsetRight: state.pinnedOffsetRight,
      }),
    })

    service.setTargets(targets)

    expect(service.getTargets()).toBe(targets)
    expect(service.getLatestTargets()).toBe(targets)
    expect(targets.overlayRoot?.parentElement).toBe(targets.scrollHost)
    expect(state.scrollTop).toBe(24)
    expect(state.scrollLeft).toBe(64)

    service.clearCurrentTargets()
    expect(service.getTargets()).toBeNull()
    expect(service.getLatestTargets()).toBe(targets)

    service.reapplyLatestTargets()
    expect(service.getTargets()).toBe(targets)
    expect(state.scrollLeft).toBe(64)

    service.dispose()
    expect(service.getTargets()).toBeNull()
    expect(service.getLatestTargets()).toBeNull()
  })

  it("updates pinned offsets through render-sync boundary", () => {
    const state: ViewportSyncState = {
      scrollTop: 0,
      scrollLeft: 0,
      pinnedOffsetLeft: 0,
      pinnedOffsetRight: 0,
    }
    const service = createDataGridViewportRenderSyncService({
      syncState: state,
      resolveNextState: overrides => ({
        scrollTop: overrides?.scrollTop ?? 0,
        scrollLeft: overrides?.scrollLeft ?? 0,
        pinnedOffsetLeft: overrides?.pinnedOffsetLeft ?? state.pinnedOffsetLeft,
        pinnedOffsetRight: overrides?.pinnedOffsetRight ?? state.pinnedOffsetRight,
      }),
    })

    service.updatePinnedOffsets({ left: 48, right: 120 })
    expect(state.pinnedOffsetLeft).toBe(48)
    expect(state.pinnedOffsetRight).toBe(120)

    service.updatePinnedOffsets({ left: 48, right: 120 })
    expect(state.pinnedOffsetLeft).toBe(48)
    expect(state.pinnedOffsetRight).toBe(120)
  })
})
