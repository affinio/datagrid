import { describe, expect, it } from "vitest"

import {
  resolveDeviceAlignedCanvasLineWidth,
  resolveDeviceAlignedCanvasStrokeCenter,
} from "../dataGridChromeCanvasMath"

describe("dataGridChromeCanvasMath", () => {
  it("keeps css pixel lines unchanged on integer device pixel ratios", () => {
    expect(resolveDeviceAlignedCanvasLineWidth(1, 1)).toBe(1)
    expect(resolveDeviceAlignedCanvasLineWidth(1, 2)).toBe(1)
    expect(resolveDeviceAlignedCanvasStrokeCenter(72, 1, 1)).toBe(71.5)
    expect(resolveDeviceAlignedCanvasStrokeCenter(72, 1, 2)).toBe(71.5)
  })

  it("snaps canvas strokes to physical pixels on fractional device pixel ratios", () => {
    expect(resolveDeviceAlignedCanvasLineWidth(1, 1.25)).toBeCloseTo(0.8)
    expect(resolveDeviceAlignedCanvasStrokeCenter(72, 1, 1.25)).toBeCloseTo(71.6)
    expect(resolveDeviceAlignedCanvasStrokeCenter(31, 1, 1.25)).toBeCloseTo(30.8)
  })

  it("falls back safely for invalid ratios and widths", () => {
    expect(resolveDeviceAlignedCanvasLineWidth(0, 1.25)).toBe(0)
    expect(resolveDeviceAlignedCanvasLineWidth(1, Number.NaN)).toBe(1)
    expect(resolveDeviceAlignedCanvasStrokeCenter(40, 1, Number.NaN)).toBe(39.5)
  })
})