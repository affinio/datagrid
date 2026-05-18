import { describe, expect, expectTypeOf, it } from "vitest"
import {
  AffinoBarChart,
  AffinoChartFrame,
  AffinoChartLegend,
  AffinoLineChart,
  AffinoPieChart,
  createChartsVue,
} from "../index"
import type {
  AffinoBarChartBarEvent,
  AffinoChartInteractionPayload,
  AffinoLineChartPointEvent,
  AffinoPieChartSliceEvent,
  ChartAnchorRect,
  ChartInteractionPoint,
  ChartLegendItem,
  ChartLegendOrientation,
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
    expectTypeOf<ChartLegendItem>().toEqualTypeOf<{
      id: string
      label: string
      color?: string
      value?: string | number
      disabled?: boolean
    }>()
    expectTypeOf<ChartLegendOrientation>().toEqualTypeOf<"horizontal" | "vertical">()
    expectTypeOf<AffinoChartInteractionPayload<BarChartBarGeometry>>().toEqualTypeOf<{
      item: BarChartBarGeometry
      row?: ChartDatum
      index: number
      clientPoint: ChartInteractionPoint
      anchorRect: ChartAnchorRect
    }>()
    expectTypeOf<AffinoBarChartBarEvent>().toEqualTypeOf<{
      item: BarChartBarGeometry
      bar: BarChartBarGeometry
      row: ChartDatum
      index: number
      category: string
      value: number
      clientPoint: ChartInteractionPoint
      anchorRect: ChartAnchorRect
    }>()
    expectTypeOf<AffinoLineChartPointEvent>().toEqualTypeOf<{
      item: LineChartPointGeometry
      point: LineChartPointGeometry
      row: ChartDatum
      index: number
      xValue: number
      yValue: number
      clientPoint: ChartInteractionPoint
      anchorRect: ChartAnchorRect
    }>()
    expectTypeOf<AffinoPieChartSliceEvent>().toEqualTypeOf<{
      item: PieChartSliceGeometry
      slice: PieChartSliceGeometry
      row: ChartDatum
      index: number
      category: string
      value: number
      percentage: number
      clientPoint: ChartInteractionPoint
      anchorRect: ChartAnchorRect
    }>()
  })

  it("exports a clean package entrypoint", async () => {
    const entrypoint = await import("../index")

    expect(Object.keys(entrypoint)).toEqual([
      "AffinoBarChart",
      "AffinoChartFrame",
      "AffinoChartLegend",
      "AffinoLineChart",
      "AffinoPieChart",
      "createChartsVue",
    ])
    expect(entrypoint.AffinoBarChart).toBe(AffinoBarChart)
    expect(entrypoint.AffinoChartFrame).toBe(AffinoChartFrame)
    expect(entrypoint.AffinoChartLegend).toBe(AffinoChartLegend)
    expect(entrypoint.AffinoLineChart).toBe(AffinoLineChart)
    expect(entrypoint.AffinoPieChart).toBe(AffinoPieChart)
    expect(entrypoint.createChartsVue).toBe(createChartsVue)
  })
})
