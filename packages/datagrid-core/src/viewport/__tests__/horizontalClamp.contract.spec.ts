import { describe, expect, it } from "vitest"
import { clampHorizontalOffset } from "../tableViewportHorizontalClamp"

describe("horizontal clamp contract", () => {
  it("is deterministic and side-effect free for repeated calls", () => {
    const context = {
      totalScrollableWidth: 120_000,
      containerWidthForColumns: 1400,
      pinnedLeftWidth: 120,
      pinnedRightWidth: 180,
      averageColumnWidth: 96,
      nativeScrollLimit: 118_000,
      virtualizationEnabled: true,
      bufferColumns: 2,
    }

    const first = clampHorizontalOffset(75_432.75, context)
    const second = clampHorizontalOffset(75_432.75, context)
    const third = clampHorizontalOffset(75_432.75, context)

    expect(second).toEqual(first)
    expect(third).toEqual(first)
  })

  it("supports stress-scale dimensions (500+ columns wide datasets)", () => {
    const context = {
      totalScrollableWidth: 640_000, // ~500 columns * ~1280px zoomed aggregates
      containerWidthForColumns: 1600,
      pinnedLeftWidth: 160,
      pinnedRightWidth: 240,
      averageColumnWidth: 128,
      nativeScrollLimit: 638_500,
      virtualizationEnabled: true,
      bufferColumns: 2,
    }

    const farRight = clampHorizontalOffset(1_000_000, context)
    const farLeft = clampHorizontalOffset(-1_000, context)
    const middle = clampHorizontalOffset(320_000, context)

    expect(farRight.maxScroll).toBeGreaterThan(0)
    expect(farRight.normalized).toBeLessThanOrEqual(farRight.maxScroll)
    expect(farRight.normalized).toBeGreaterThanOrEqual(0)
    expect(farLeft.normalized).toBe(0)
    expect(middle.normalized).toBeGreaterThan(0)
    expect(middle.normalized).toBeLessThanOrEqual(farRight.maxScroll)
  })

  it("falls back to native limit when virtualization is disabled", () => {
    const result = clampHorizontalOffset(10_000, {
      totalScrollableWidth: 500_000,
      containerWidthForColumns: 1200,
      pinnedLeftWidth: 100,
      pinnedRightWidth: 100,
      averageColumnWidth: 100,
      nativeScrollLimit: 3200,
      virtualizationEnabled: false,
      bufferColumns: 4,
    })

    expect(result.maxScroll).toBe(3200)
    expect(result.normalized).toBe(3200)
  })
})
