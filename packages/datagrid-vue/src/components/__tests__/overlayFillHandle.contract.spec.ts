import { describe, expect, it } from "vitest"
import type { FillHandleStylePayload } from "@affino/datagrid-core/selection/fillHandleStylePool"
import { resolveOverlayFillHandlePosition } from "../overlayFillHandle"

function createStyle(x: number, y: number): FillHandleStylePayload {
  return {
    x,
    y,
    widthValue: 8,
    heightValue: 8,
  }
}

describe("overlay fill-handle contract", () => {
  it("compensates root scroll-transform drift using transform scroll state", () => {
    const position = resolveOverlayFillHandlePosition(createStyle(170, 117.5), {
      viewportWidth: 640,
      viewportHeight: 360,
      scrollLeft: 75,
      scrollTop: 22.5,
      pinnedLeftTranslateX: 75,
      pinnedRightTranslateX: -120,
    })

    expect(position).toEqual({
      x: 245,
      y: 140,
    })
  })

  it("falls back to style coordinates when transform is missing", () => {
    const position = resolveOverlayFillHandlePosition(createStyle(32, 57), null)
    expect(position).toEqual({
      x: 32,
      y: 57,
    })
  })
})
