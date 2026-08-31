import { describe, expect, expectTypeOf, it } from "vitest"
import {
  AffinoAreaChart,
  AffinoBarChart,
  AffinoChartFrame,
  AffinoChartLegend,
  AffinoHistogram,
  AffinoLineChart,
  AffinoMetricCard,
  AffinoPieChart,
  AffinoScatterChart,
  AffinoTimeSeriesChart,
  createChartsVue,
} from "../index"
import type {
  AffinoAreaChartPointEvent,
  AffinoBarChartBarEvent,
  AffinoChartInteractionPayload,
  AffinoHistogramBinEvent,
  AffinoLineChartPointEvent,
  AffinoPieChartSliceEvent,
  AffinoScatterChartPointEvent,
  AffinoTimeSeriesTooltip,
  ChartAnchorRect,
  ChartInteractionPoint,
  ChartLegendItem,
  ChartLegendOrientation,
  ChartThemeVariant,
} from "../index"
import type {
  AreaChartPointGeometry,
  BarChartBarGeometry,
  ChartDatum,
  HistogramBinGeometry,
  LineChartPointGeometry,
  PieChartSliceGeometry,
  ScatterChartPointGeometry,
} from "@affino/charts-core"

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
      hidden?: boolean
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
    expectTypeOf<AffinoAreaChartPointEvent>().toEqualTypeOf<{
      item: AreaChartPointGeometry
      point: AreaChartPointGeometry
      row: ChartDatum
      index: number
      xValue: number
      yValue: number
      clientPoint: ChartInteractionPoint
      anchorRect: ChartAnchorRect
    }>()
    expectTypeOf<AffinoHistogramBinEvent>().toEqualTypeOf<{
      item: HistogramBinGeometry
      row?: ChartDatum
      bin: HistogramBinGeometry
      index: number
      min: number
      max: number
      count: number
      values: number[]
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
    expectTypeOf<AffinoScatterChartPointEvent>().toEqualTypeOf<{
      item: ScatterChartPointGeometry
      point: ScatterChartPointGeometry
      row: ChartDatum
      index: number
      xValue: number
      yValue: number
      radiusValue: number | null
      clientPoint: ChartInteractionPoint
      anchorRect: ChartAnchorRect
    }>()
  })

  it("exports a clean package entrypoint", async () => {
    const entrypoint = await import("../index")

    expect(Object.keys(entrypoint)).toEqual([
      "AffinoAreaChart",
      "AffinoBarChart",
      "AffinoChartFrame",
      "AffinoChartLegend",
      "AffinoHistogram",
      "AffinoLineChart",
      "AffinoMetricCard",
      "AffinoPieChart",
      "AffinoScatterChart",
      "AffinoTimeSeriesChart",
      "createChartsVue",
    ])
    expect(entrypoint.AffinoAreaChart).toBe(AffinoAreaChart)
    expect(entrypoint.AffinoBarChart).toBe(AffinoBarChart)
    expect(entrypoint.AffinoChartFrame).toBe(AffinoChartFrame)
    expect(entrypoint.AffinoChartLegend).toBe(AffinoChartLegend)
    expect(entrypoint.AffinoHistogram).toBe(AffinoHistogram)
    expect(entrypoint.AffinoLineChart).toBe(AffinoLineChart)
    expect(entrypoint.AffinoMetricCard).toBe(AffinoMetricCard)
    expect(entrypoint.AffinoPieChart).toBe(AffinoPieChart)
    expect(entrypoint.AffinoScatterChart).toBe(AffinoScatterChart)
    expect(entrypoint.AffinoTimeSeriesChart).toBe(AffinoTimeSeriesChart)
    expect(entrypoint.createChartsVue).toBe(createChartsVue)
  })
})
