import { describe, expect, it } from "vitest"
import { useDataGridAxisAutoScrollDelta } from "../useDataGridAxisAutoScrollDelta"

describe("useDataGridAxisAutoScrollDelta contract", () => {
  it("returns 0 when bounds are invalid", () => {
    const resolver = useDataGridAxisAutoScrollDelta({ edgePx: 36, maxStepPx: 28 })
    expect(resolver.resolveAxisAutoScrollDelta(50, 100, 90)).toBe(0)
  })

  it("returns negative delta near top edge with capped intensity", () => {
    const resolver = useDataGridAxisAutoScrollDelta({ edgePx: 36, maxStepPx: 28 })
    expect(resolver.resolveAxisAutoScrollDelta(101, 100, 500)).toBe(-28)
    expect(resolver.resolveAxisAutoScrollDelta(-200, 100, 500)).toBe(-56)
  })

  it("returns positive delta near bottom edge with capped intensity", () => {
    const resolver = useDataGridAxisAutoScrollDelta({ edgePx: 36, maxStepPx: 28 })
    expect(resolver.resolveAxisAutoScrollDelta(499, 100, 500)).toBe(28)
    expect(resolver.resolveAxisAutoScrollDelta(900, 100, 500)).toBe(56)
  })

  it("returns 0 in the safe center area", () => {
    const resolver = useDataGridAxisAutoScrollDelta({ edgePx: 36, maxStepPx: 28 })
    expect(resolver.resolveAxisAutoScrollDelta(300, 100, 500)).toBe(0)
  })

  it("supports custom intensity cap", () => {
    const resolver = useDataGridAxisAutoScrollDelta({ edgePx: 20, maxStepPx: 10, maxIntensity: 3 })
    expect(resolver.resolveAxisAutoScrollDelta(-100, 100, 300)).toBe(-30)
    expect(resolver.resolveAxisAutoScrollDelta(600, 100, 300)).toBe(30)
  })
})
