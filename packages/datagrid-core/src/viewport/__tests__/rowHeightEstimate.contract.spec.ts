import { describe, expect, it } from "vitest"
import { normalizeAutoMeasuredHeight, resolveAutoRowHeightEstimate } from "../dataGridViewportRowHeightEstimate.js"

describe("viewport row height estimate policy", () => {
  it("normalizes measurements by a valid layout scale", () => {
    expect(normalizeAutoMeasuredHeight(40, 2)).toBe(20)
    expect(normalizeAutoMeasuredHeight(40, 0)).toBe(40)
    expect(normalizeAutoMeasuredHeight(Number.NaN, 1)).toBeNull()
  })

  it("smooths meaningful cached estimate changes and rounds to tenths", () => {
    expect(resolveAutoRowHeightEstimate({ currentEstimate: 30, cachedEstimate: 35.04 })).toBe(32.5)
    expect(resolveAutoRowHeightEstimate({ currentEstimate: 30, cachedEstimate: 30.5 })).toBeNull()
  })

  it("keeps the requested lower bound when estimates are preserved", () => {
    expect(resolveAutoRowHeightEstimate({ currentEstimate: 30, cachedEstimate: 20, preserveLowerBound: 36 })).toBe(33)
  })
})
