import { describe, expect, it } from "vitest"
import { resolveVerticalScrollMapping } from "../../virtualization/scrollLimits"

describe("vertical logical/physical scroll mapping contract", () => {
  it("keeps identity mapping when the native extent can represent the logical extent", () => {
    const mapping = resolveVerticalScrollMapping({
      logicalContentHeight: 1_000_000,
      viewportSize: 1_000,
      nativeScrollLimit: 999_000,
    })

    expect(mapping.isScaled).toBe(false)
    expect(mapping.scale).toBe(1)
    expect(mapping.toLogical(123_456.5)).toBe(123_456.5)
    expect(mapping.toPhysical(999_000)).toBe(999_000)
  })

  it("maps a 10M-row logical extent onto a bounded native extent without index drift", () => {
    const rowHeight = 31
    const rowCount = 10_000_000
    const viewportSize = 700
    const mapping = resolveVerticalScrollMapping({
      logicalContentHeight: rowCount * rowHeight,
      viewportSize,
      nativeScrollLimit: 16_000_000,
    })

    expect(mapping.isScaled).toBe(true)
    expect(mapping.toPhysical(mapping.toLogical(0))).toBe(0)
    expect(mapping.toPhysical(mapping.toLogical(mapping.physicalMax))).toBeCloseTo(mapping.physicalMax, 6)
    for (const physicalOffset of [0, 1, 8_000_000.25, mapping.physicalMax]) {
      const roundTrip = mapping.toPhysical(mapping.toLogical(physicalOffset))
      expect(Math.abs(roundTrip - physicalOffset)).toBeLessThan(0.000001)
    }
    expect(mapping.toLogical(mapping.physicalMax)).toBe(mapping.logicalMax)
  })

  it("preserves top/middle/last row reachability across the supported row-height matrix", () => {
    for (const rowCount of [1_000_000, 10_000_000]) {
      for (const rowHeight of [24, 31, 100]) {
        const mapping = resolveVerticalScrollMapping({
          logicalContentHeight: rowCount * rowHeight,
          viewportSize: 620,
          nativeScrollLimit: 16_000_000,
        })
        const logicalMax = (rowCount * rowHeight) - 620
        const logicalOffsets = [0, logicalMax / 2, logicalMax]
        for (const logicalOffset of logicalOffsets) {
          const physicalOffset = mapping.toPhysical(logicalOffset)
          const roundTrip = mapping.toLogical(physicalOffset)
          expect(roundTrip).toBeCloseTo(logicalOffset, 5)
          expect(physicalOffset).toBeGreaterThanOrEqual(0)
          expect(physicalOffset).toBeLessThanOrEqual(mapping.physicalMax)
        }
        expect(mapping.toLogical(mapping.physicalMax)).toBeCloseTo(logicalMax, 5)
      }
    }
  })

  it("fails closed for unknown or invalid native extents", () => {
    const mapping = resolveVerticalScrollMapping({
      logicalContentHeight: 100_000,
      viewportSize: 500,
      nativeScrollLimit: 0,
    })

    expect(mapping.isScaled).toBe(false)
    expect(mapping.toLogical(Number.NaN)).toBe(0)
    expect(mapping.toPhysical(Number.POSITIVE_INFINITY)).toBe(0)
  })
})
