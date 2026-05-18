import { describe, expect, expectTypeOf, it } from "vitest"
import { AffinoBarChart, AffinoChartFrame, AffinoLineChart, AffinoPieChart, createChartsVue } from "../index"
import type {
  AffinoBarChartBarEvent,
  AffinoLineChartPointEvent,
  AffinoPieChartSliceEvent,
  ChartAnchorRect,
  ChartInteractionPoint,
  ChartThemeVariant,
} from "../index"
import type { BarChartBarGeometry, ChartDatum, LineChartPointGeometry, PieChartSliceGeometry } from "@affino/charts-core"

describe("@affino/charts-vue", () => {
  it("returns package metadata", () => {
    expect(createChartsVue()).toEqual({ version: "0.1.0" })
  })

  it("exports public chart-adjacent types", () => {
    expectTypeOf<ChartThemeVariant>().toEqualTypeOf<"default" | "muted" | "success" | "warning" | "danger">()
    expectTypeOf<ChartInteractionPoint>().toEqualTypeOf<{ x: number; y: number }>()
    expectTypeOf<ChartAnchorRect>().toEqualTypeOf<{ x: number; y: number; width: number; height: number }>()
    expectTypeOf<AffinoBarChartBarEvent>().toEqualTypeOf<{
      bar: BarChartBarGeometry
      row: ChartDatum
      index: number
      category: string
      value: number
      clientPoint?: ChartInteractionPoint
    }>()
    expectTypeOf<AffinoLineChartPointEvent>().toEqualTypeOf<{
      point: LineChartPointGeometry
      row: ChartDatum
      index: number
      xValue: number
      yValue: number
    }>()
    expectTypeOf<AffinoPieChartSliceEvent>().toEqualTypeOf<{
      slice: PieChartSliceGeometry
      row: ChartDatum
      index: number
      category: string
      value: number
      percentage: number
    }>()
  })

  it("exports a clean package entrypoint", async () => {
    const entrypoint = await import("../index")

    expect(Object.keys(entrypoint)).toEqual([
      "AffinoBarChart",
      "AffinoChartFrame",
      "AffinoLineChart",
      "AffinoPieChart",
      "createChartsVue",
    ])
    expect(entrypoint.AffinoBarChart).toBe(AffinoBarChart)
    expect(entrypoint.AffinoChartFrame).toBe(AffinoChartFrame)
    expect(entrypoint.AffinoLineChart).toBe(AffinoLineChart)
    expect(entrypoint.AffinoPieChart).toBe(AffinoPieChart)
    expect(entrypoint.createChartsVue).toBe(createChartsVue)
  })
})
