import { describe, expect, it } from "vitest"
import { createChartBandScale } from "@affino/charts-core"
import type {
  ChartBandScale,
  ChartBandScaleOptions,
} from "@affino/charts-core"

describe("chart band scale helpers", () => {
  it("creates positions for ordered categories", () => {
    const scale = createChartBandScale({
      categories: ["A", "B", "C"],
      range: { min: 0, max: 300 },
    })

    expect(scale.categories).toEqual(["A", "B", "C"])
    expect(scale.step).toBe(100)
    expect(scale.bandwidth).toBe(90)
    expect(scale.scale("A")).toBe(5)
    expect(scale.scale("B")).toBe(105)
    expect(scale.scale("C")).toBeCloseTo(205)
  })

  it("de-duplicates categories by first appearance", () => {
    const scale = createChartBandScale({
      categories: ["A", "B", "A", "C", "B"],
      range: { min: 0, max: 300 },
    })

    expect(scale.categories).toEqual(["A", "B", "C"])
    expect(scale.scale("A")).toBe(5)
    expect(scale.scale("B")).toBe(105)
    expect(scale.scale("C")).toBeCloseTo(205)
  })

  it("returns null for unknown categories", () => {
    const scale = createChartBandScale({
      categories: ["A"],
      range: { min: 0, max: 100 },
    })

    expect(scale.scale("B")).toBeNull()
  })

  it("returns zero bandwidth and step for empty categories", () => {
    const scale: ChartBandScale = createChartBandScale({
      categories: [],
      range: { min: 0, max: 100 },
    })

    expect(scale.categories).toEqual([])
    expect(scale.bandwidth).toBe(0)
    expect(scale.step).toBe(0)
    expect(scale.scale("A")).toBeNull()
  })

  it("uses paddingInner to reduce bandwidth", () => {
    const noInnerPadding = createChartBandScale({
      categories: ["A", "B"],
      range: { min: 0, max: 200 },
      paddingInner: 0,
      paddingOuter: 0,
    })
    const innerPadding = createChartBandScale({
      categories: ["A", "B"],
      range: { min: 0, max: 200 },
      paddingInner: 0.5,
      paddingOuter: 0,
    })

    expect(noInnerPadding.bandwidth).toBe(100)
    expect(innerPadding.bandwidth).toBeCloseTo(66.6666666667)
    expect(innerPadding.bandwidth).toBeLessThan(noInnerPadding.bandwidth)
  })

  it("uses paddingOuter to offset the first position", () => {
    const noOuterPadding = createChartBandScale({
      categories: ["A", "B"],
      range: { min: 0, max: 200 },
      paddingInner: 0,
      paddingOuter: 0,
    })
    const outerPadding = createChartBandScale({
      categories: ["A", "B"],
      range: { min: 0, max: 200 },
      paddingInner: 0,
      paddingOuter: 0.5,
    })

    expect(noOuterPadding.scale("A")).toBe(0)
    expect(outerPadding.scale("A")).toBeCloseTo(33.3333333333)
  })

  it("clamps invalid padding values", () => {
    const options: ChartBandScaleOptions = {
      categories: ["A", "B"],
      range: { min: 0, max: 200 },
      paddingInner: 2,
      paddingOuter: -1,
    }
    const scale = createChartBandScale(options)

    expect(scale.step).toBeCloseTo(190.4761904762)
    expect(scale.bandwidth).toBeCloseTo(9.5238095238)
    expect(scale.scale("A")).toBe(0)
  })

  it("supports reversed ranges predictably", () => {
    const scale = createChartBandScale({
      categories: ["A", "B", "C"],
      range: { min: 300, max: 0 },
    })

    expect(scale.step).toBe(100)
    expect(scale.bandwidth).toBe(90)
    expect(scale.scale("A")).toBe(295)
    expect(scale.scale("B")).toBe(195)
    expect(scale.scale("C")).toBeCloseTo(95)
  })

  it("supports one category with usable centered bandwidth", () => {
    const scale = createChartBandScale({
      categories: ["A"],
      range: { min: 0, max: 100 },
      paddingInner: 0.1,
      paddingOuter: 0.05,
    })

    expect(scale.step).toBe(100)
    expect(scale.bandwidth).toBe(90)
    expect(scale.scale("A")).toBe(5)
  })
})
