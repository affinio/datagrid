import { describe, expect, it } from "vitest"
import {
  DEFAULT_CHART_MARGIN,
  resolveChartMargin,
  resolveChartPlotArea,
} from "@affino/charts-core"

describe("chart layout helpers", () => {
  it("merges partial margins with defaults", () => {
    expect(resolveChartMargin({ top: 8, left: 24 })).toEqual({
      ...DEFAULT_CHART_MARGIN,
      top: 8,
      left: 24,
    })
  })

  it("resolves plot area from chart size and margins", () => {
    expect(resolveChartPlotArea(
      { width: 400, height: 300 },
      { top: 10, right: 20, bottom: 30, left: 40 },
    )).toEqual({
      x: 40,
      y: 10,
      width: 340,
      height: 260,
    })
  })

  it("clamps too-small plot areas to zero dimensions", () => {
    expect(resolveChartPlotArea(
      { width: 20, height: 10 },
      { top: 8, right: 16, bottom: 8, left: 16 },
    )).toEqual({
      x: 16,
      y: 8,
      width: 0,
      height: 0,
    })
  })
})
