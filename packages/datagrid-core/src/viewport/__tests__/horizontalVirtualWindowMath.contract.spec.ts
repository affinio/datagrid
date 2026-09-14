import { describe, expect, it } from "vitest"
import {
  resolveFirstColumnIndexAfterOffset,
  resolveFirstColumnIndexAfterPrefixOffset,
  resolveLastColumnIndexBeforeOffset,
  resolveLastColumnIndexBeforePrefixOffset,
} from "../../virtualization/columnSizing"
import {
  computeHorizontalScrollClamp,
  computeHorizontalVirtualWindowRange,
} from "../../virtualization/horizontalVirtualWindowMath"

describe("horizontal virtual window math contract", () => {
  const metrics = {
    widths: [120, 140, 100, 180, 160],
    offsets: [0, 120, 260, 360, 540],
    totalWidth: 700,
  }

  const meta = {
    metrics,
    pinnedLeftWidth: 120,
    pinnedRightWidth: 80,
    containerWidthForColumns: 960,
    nativeScrollLimit: 600,
    zoom: 1,
    buffer: 2,
    isRTL: false,
  }

  it("shares offset-to-column boundary math across metrics and prefix callers", () => {
    const widths = [100, 50, 200]
    const offsets = [0, 100, 150]
    const prefix = [0, 100, 150, 350]

    expect(resolveFirstColumnIndexAfterOffset(100, widths, offsets)).toBe(0)
    expect(resolveLastColumnIndexBeforeOffset(100, widths, offsets)).toBe(1)
    expect(resolveFirstColumnIndexAfterPrefixOffset(100, prefix, 350)).toBe(1)
    expect(resolveLastColumnIndexBeforePrefixOffset(100, prefix)).toBe(0)
    expect(resolveFirstColumnIndexAfterPrefixOffset(350, prefix, 350)).toBe(3)
    expect(resolveLastColumnIndexBeforePrefixOffset(0, prefix)).toBe(-1)
  })

  it("computes virtual range from metrics-only contract", () => {
    const result = computeHorizontalVirtualWindowRange({
      offset: 260,
      totalCount: metrics.widths.length,
      virtualizationEnabled: true,
      overscanLeading: 2,
      overscanTrailing: 2,
      scrollVelocity: 0,
      meta,
    })

    expect(result.start).toBeGreaterThanOrEqual(0)
    expect(result.end).toBeLessThanOrEqual(metrics.widths.length)
    expect(result.end).toBeGreaterThan(result.start)
    expect(result.payload.visibleStart).toBeGreaterThanOrEqual(result.start)
    expect(result.payload.visibleEnd).toBeLessThanOrEqual(result.end)
    expect(result.payload.effectiveViewport).toBe(760)
  })

  it("returns full range when virtualization is disabled", () => {
    const result = computeHorizontalVirtualWindowRange({
      offset: 0,
      totalCount: metrics.widths.length,
      virtualizationEnabled: false,
      overscanLeading: 1,
      overscanTrailing: 1,
      scrollVelocity: 0,
      meta,
    })

    expect(result.start).toBe(0)
    expect(result.end).toBe(metrics.widths.length)
    expect(result.payload.visibleStart).toBe(0)
    expect(result.payload.visibleEnd).toBe(metrics.widths.length)
  })

  it("clamps scroll offset deterministically against virtual envelope", () => {
    const first = computeHorizontalScrollClamp({
      value: 99_999,
      virtualizationEnabled: true,
      overscanLeading: 2,
      overscanTrailing: 2,
      meta,
    })
    const second = computeHorizontalScrollClamp({
      value: 99_999,
      virtualizationEnabled: true,
      overscanLeading: 2,
      overscanTrailing: 2,
      meta,
    })

    expect(first).toBe(second)
    expect(first).toBeGreaterThanOrEqual(0)
  })
})
