import { describe, expect, it } from "vitest"
import {
  buildSelectionOverlayTransform,
  buildSelectionOverlayTransformFromSnapshot,
} from "../selectionOverlayTransform"

describe("selection overlay transform contract", () => {
  it("builds deterministic transform from viewport state and pinned offsets", () => {
    const transform = buildSelectionOverlayTransform(
      {
        width: 1280,
        height: 720,
        scrollLeft: 240,
        scrollTop: 80,
      },
      0,
      400,
    )

    expect(transform).toEqual({
      viewportWidth: 1280,
      viewportHeight: 720,
      scrollLeft: 240,
      scrollTop: 80,
      pinnedLeftTranslateX: 240,
      pinnedRightTranslateX: -160,
    })
  })

  it("derives transform from overlay scroll snapshot without losing scroll state", () => {
    const transform = buildSelectionOverlayTransformFromSnapshot({
      viewportWidth: 1024,
      viewportHeight: 640,
      scrollLeft: 512,
      scrollTop: 144,
      pinnedOffsetLeft: 0,
      pinnedOffsetRight: 700,
    })

    expect(transform.scrollLeft).toBe(512)
    expect(transform.scrollTop).toBe(144)
    expect(transform.pinnedLeftTranslateX).toBe(512)
    expect(transform.pinnedRightTranslateX).toBe(-188)
  })
})
