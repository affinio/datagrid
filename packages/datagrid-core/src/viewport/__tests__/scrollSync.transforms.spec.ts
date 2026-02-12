import { describe, expect, it } from "vitest"
import { applyViewportSyncTransforms, resetViewportSyncTransforms } from "../scrollSync"
import type { ViewportSyncState, ViewportSyncTargets } from "../dataGridViewportTypes"

function createTargets(): ViewportSyncTargets {
  const scrollHost = document.createElement("div")
  const layoutRoot = document.createElement("div")
  const mainViewport = document.createElement("div")
  const bodyLayer = document.createElement("div")
  const headerHost = document.createElement("div")
  const headerLayer = document.createElement("div")
  const pinnedLeftLayer = document.createElement("div")
  const pinnedRightLayer = document.createElement("div")
  const overlayRoot = document.createElement("div")

  headerHost.appendChild(headerLayer)

  return {
    scrollHost,
    mainViewport,
    layoutRoot,
    bodyLayer,
    headerLayer,
    pinnedLeftLayer,
    pinnedRightLayer,
    overlayRoot,
  }
}

function createState(): ViewportSyncState {
  return {
    scrollTop: 0,
    scrollLeft: 0,
    pinnedOffsetLeft: 0,
    pinnedOffsetRight: 0,
  }
}

describe("viewport scroll sync transforms", () => {
  it("updates state even when sync targets are missing", () => {
    const state = createState()

    applyViewportSyncTransforms(null, state, {
      scrollTop: 21,
      scrollLeft: 13,
      pinnedOffsetLeft: 4,
      pinnedOffsetRight: 6,
    })

    expect(state).toEqual({
      scrollTop: 21,
      scrollLeft: 13,
      pinnedOffsetLeft: 4,
      pinnedOffsetRight: 6,
    })
  })

  it("keeps body and overlay transforms aligned across horizontal and vertical scroll", () => {
    const targets = createTargets()
    const state = createState()

    applyViewportSyncTransforms(targets, state, {
      scrollTop: 48,
      scrollLeft: 26,
      pinnedOffsetLeft: 12,
      pinnedOffsetRight: 18,
    })

    expect(targets.bodyLayer?.style.transform).toBe("translate3d(-26px, -48px, 0)")
    expect(targets.overlayRoot?.style.transform).toBe("translate3d(-26px, -48px, 0)")
    expect(targets.headerLayer?.style.transform).toBe("translate3d(-26px, 0px, 0)")
    expect(targets.headerLayer?.scrollLeft).toBe(26)
  })

  it("applies pinned offsets while preserving vertical sync for pinned layers", () => {
    const targets = createTargets()
    const state = createState()

    applyViewportSyncTransforms(targets, state, {
      scrollTop: 32,
      scrollLeft: 20,
      pinnedOffsetLeft: 14,
      pinnedOffsetRight: 22,
    })

    expect(targets.pinnedLeftLayer?.style.transform).toBe("translate3d(14px, -32px, 0)")
    expect(targets.pinnedRightLayer?.style.transform).toBe("translate3d(-22px, -32px, 0)")
    expect(state.scrollTop).toBe(32)
    expect(state.scrollLeft).toBe(20)
    expect(state.pinnedOffsetLeft).toBe(14)
    expect(state.pinnedOffsetRight).toBe(22)
  })

  it("supports adapter overload path for transform application", () => {
    const targets = createTargets()
    const state = createState()

    const adapter = {
      getSyncTargets: () => targets,
      getAppliedState: () => state,
    }

    applyViewportSyncTransforms(adapter, {
      scrollTop: 10,
      scrollLeft: 5,
      pinnedOffsetLeft: 3,
      pinnedOffsetRight: 7,
    })

    expect(targets.bodyLayer?.style.transform).toBe("translate3d(-5px, -10px, 0)")
    expect(targets.pinnedLeftLayer?.style.transform).toBe("translate3d(3px, -10px, 0)")
    expect(state.scrollTop).toBe(10)
    expect(state.scrollLeft).toBe(5)
  })

  it("resets sync transforms back to identity", () => {
    const targets = createTargets()
    const state = createState()

    applyViewportSyncTransforms(targets, state, {
      scrollTop: 16,
      scrollLeft: 9,
      pinnedOffsetLeft: 5,
      pinnedOffsetRight: 7,
    })

    resetViewportSyncTransforms(targets, state)

    expect(targets.bodyLayer?.style.transform).toBe("translate3d(0, 0, 0)")
    expect(targets.headerLayer?.style.transform).toBe("translate3d(0, 0, 0)")
    expect(targets.overlayRoot?.style.transform).toBe("translate3d(0, 0, 0)")
    expect(targets.pinnedLeftLayer?.style.transform).toBe("translate3d(0, 0, 0)")
    expect(targets.pinnedRightLayer?.style.transform).toBe("translate3d(0, 0, 0)")
    expect(state.scrollTop).toBe(0)
    expect(state.scrollLeft).toBe(0)
    expect(state.pinnedOffsetLeft).toBe(0)
    expect(state.pinnedOffsetRight).toBe(0)
  })
})
