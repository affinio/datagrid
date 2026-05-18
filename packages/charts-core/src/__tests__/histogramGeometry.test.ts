import { describe, expect, it } from "vitest"
import { createHistogramGeometry } from "@affino/charts-core"

describe("histogram geometry", () => {
  it("creates the expected number of bins", () => {
    const geometry = createHistogramGeometry({
      rows: [{ value: 0 }, { value: 10 }],
      valueField: "value",
      binCount: 5,
      size: { width: 100, height: 100 },
    })

    expect(geometry.bins).toHaveLength(5)
  })

  it("counts values into bins", () => {
    const geometry = createHistogramGeometry({
      rows: [{ value: 0 }, { value: 1 }, { value: 2 }, { value: 3 }],
      valueField: "value",
      binCount: 2,
      valueMin: 0,
      valueMax: 4,
      size: { width: 100, height: 100 },
    })

    expect(geometry.bins.map((bin) => bin.count)).toEqual([2, 2])
    expect(geometry.bins.map((bin) => bin.values)).toEqual([[0, 1], [2, 3]])
    expect(geometry.totalCount).toBe(4)
  })

  it("includes max value in the final bin", () => {
    const geometry = createHistogramGeometry({
      rows: [{ value: 0 }, { value: 5 }, { value: 10 }],
      valueField: "value",
      binCount: 2,
      valueMin: 0,
      valueMax: 10,
      size: { width: 100, height: 100 },
    })

    expect(geometry.bins[1]?.values).toEqual([5, 10])
  })

  it("ignores invalid values", () => {
    const geometry = createHistogramGeometry({
      rows: [
        { value: 1 },
        { value: "2" },
        { value: Number.NaN },
        { value: Infinity },
        { value: 3 },
      ],
      valueField: "value",
      binCount: 2,
      valueMin: 0,
      valueMax: 4,
      size: { width: 100, height: 100 },
    })

    expect(geometry.totalCount).toBe(2)
    expect(geometry.bins.flatMap((bin) => bin.values)).toEqual([1, 3])
  })

  it("clamps binCount", () => {
    expect(createHistogramGeometry({
      rows: [{ value: 1 }],
      valueField: "value",
      binCount: 0,
      size: { width: 100, height: 100 },
    }).bins).toHaveLength(1)
    expect(createHistogramGeometry({
      rows: [{ value: 1 }],
      valueField: "value",
      binCount: 150,
      size: { width: 100, height: 100 },
    }).bins).toHaveLength(100)
  })

  it("uses provided valueMin and valueMax as domain", () => {
    const geometry = createHistogramGeometry({
      rows: [{ value: 2 }, { value: 4 }],
      valueField: "value",
      valueMin: 0,
      valueMax: 10,
      binCount: 2,
      size: { width: 100, height: 100 },
    })

    expect(geometry.valueDomain).toEqual({ min: 0, max: 10 })
    expect(geometry.bins.map((bin) => [bin.min, bin.max])).toEqual([[0, 5], [5, 10]])
  })

  it("ignores out-of-range values by default", () => {
    const geometry = createHistogramGeometry({
      rows: [{ value: -1 }, { value: 1 }, { value: 11 }],
      valueField: "value",
      valueMin: 0,
      valueMax: 10,
      binCount: 2,
      size: { width: 100, height: 100 },
    })

    expect(geometry.totalCount).toBe(1)
    expect(geometry.bins.flatMap((bin) => bin.values)).toEqual([1])
  })

  it("clamps out-of-range values into edge bins when requested", () => {
    const geometry = createHistogramGeometry({
      rows: [{ value: -1 }, { value: 1 }, { value: 11 }],
      valueField: "value",
      valueMin: 0,
      valueMax: 10,
      includeOutOfRange: true,
      binCount: 2,
      size: { width: 100, height: 100 },
    })

    expect(geometry.totalCount).toBe(3)
    expect(geometry.bins.map((bin) => bin.values)).toEqual([[-1, 1], [11]])
  })

  it("returns zero-count bins and fallback domain for empty input", () => {
    const geometry = createHistogramGeometry({
      rows: [],
      valueField: "value",
      binCount: 3,
      size: { width: 100, height: 100 },
    })

    expect(geometry.valueDomain).toEqual({ min: 0, max: 1 })
    expect(geometry.countDomain).toEqual({ min: 0, max: 1 })
    expect(geometry.totalCount).toBe(0)
    expect(geometry.bins.map((bin) => bin.count)).toEqual([0, 0, 0])
  })

  it("expands stable min=max domains", () => {
    const geometry = createHistogramGeometry({
      rows: [{ value: 5 }, { value: 5 }],
      valueField: "value",
      binCount: 2,
      valueMin: 5,
      valueMax: 5,
      size: { width: 100, height: 100 },
    })

    expect(geometry.valueDomain).toEqual({ min: 4, max: 6 })
  })

  it("does not emit NaN or Infinity geometry values", () => {
    const geometry = createHistogramGeometry({
      rows: [{ value: 0 }, { value: 10 }],
      valueField: "value",
      binCount: 2,
      size: { width: 0, height: 0 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    for (const bin of geometry.bins) {
      expect(Number.isFinite(bin.min)).toBe(true)
      expect(Number.isFinite(bin.max)).toBe(true)
      expect(Number.isFinite(bin.x)).toBe(true)
      expect(Number.isFinite(bin.y)).toBe(true)
      expect(Number.isFinite(bin.width)).toBe(true)
      expect(Number.isFinite(bin.height)).toBe(true)
      expect(bin.width).toBeGreaterThanOrEqual(0)
      expect(bin.height).toBeGreaterThanOrEqual(0)
    }
  })

  it("uses margins to resolve plot area", () => {
    const geometry = createHistogramGeometry({
      rows: [{ value: 1 }],
      valueField: "value",
      size: { width: 300, height: 200 },
      margin: { top: 10, right: 20, bottom: 30, left: 40 },
    })

    expect(geometry.plotArea).toEqual({
      x: 40,
      y: 10,
      width: 240,
      height: 160,
    })
  })
})
