import { describe, expect, it } from "vitest"
import {
  computeChartNumericDomain,
  createChartLinearScale,
  normalizeChartValue,
} from "@affino/charts-core"
import type {
  ChartLinearScale,
  ChartNumericDomain,
} from "@affino/charts-core"

describe("chart scale helpers", () => {
  it("ignores invalid values when computing numeric domains", () => {
    expect(computeChartNumericDomain([
      null,
      undefined,
      "10",
      Number.NaN,
      Infinity,
      -Infinity,
      -2,
      6,
    ])).toEqual({ min: -2, max: 6 })
  })

  it("includes zero when requested", () => {
    expect(computeChartNumericDomain([4, 8], { includeZero: true })).toEqual({
      min: 0,
      max: 8,
    })
    expect(computeChartNumericDomain([-8, -4], { includeZero: true })).toEqual({
      min: -8,
      max: 0,
    })
  })

  it("uses fallback for empty valid values", () => {
    expect(computeChartNumericDomain(["1", null], {
      fallback: { min: 10, max: 20 },
    })).toEqual({ min: 10, max: 20 })
    expect(computeChartNumericDomain([])).toEqual({ min: 0, max: 1 })
  })

  it("expands equal min and max to a stable domain", () => {
    expect(computeChartNumericDomain([5, 5])).toEqual({ min: 4, max: 6 })
  })

  it("applies padding ratio after resolving the span", () => {
    expect(computeChartNumericDomain([10, 20], { paddingRatio: 0.1 })).toEqual({
      min: 9,
      max: 21,
    })
  })

  it("normalizes and clamps values", () => {
    const domain: ChartNumericDomain = { min: 10, max: 20 }

    expect(normalizeChartValue(10, domain)).toBe(0)
    expect(normalizeChartValue(15, domain)).toBe(0.5)
    expect(normalizeChartValue(20, domain)).toBe(1)
    expect(normalizeChartValue(5, domain)).toBe(0)
    expect(normalizeChartValue(25, domain)).toBe(1)
    expect(normalizeChartValue(10, { min: 10, max: 10 })).toBe(0.5)
  })

  it("creates a linear scale that maps min, mid, and max", () => {
    const scale: ChartLinearScale = createChartLinearScale(
      { min: 10, max: 20 },
      { min: 100, max: 200 },
    )

    expect(scale.scale(10)).toBe(100)
    expect(scale.scale(15)).toBe(150)
    expect(scale.scale(20)).toBe(200)
  })

  it("supports reversed ranges", () => {
    const scale = createChartLinearScale(
      { min: 0, max: 100 },
      { min: 300, max: 0 },
    )

    expect(scale.scale(0)).toBe(300)
    expect(scale.scale(50)).toBe(150)
    expect(scale.scale(100)).toBe(0)
  })
})
