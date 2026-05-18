import { describe, expect, expectTypeOf, it } from "vitest"
import { AffinoBarChart, AffinoChartFrame, createChartsVue } from "../index"
import type {
  AffinoBarChartBarEvent,
  ChartAnchorRect,
  ChartInteractionPoint,
  ChartThemeVariant,
} from "../index"
import type { BarChartBarGeometry, ChartDatum } from "@affino/charts-core"

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
  })

  it("exports a clean package entrypoint", async () => {
    const entrypoint = await import("../index")

    expect(Object.keys(entrypoint)).toEqual(["AffinoBarChart", "AffinoChartFrame", "createChartsVue"])
    expect(entrypoint.AffinoBarChart).toBe(AffinoBarChart)
    expect(entrypoint.AffinoChartFrame).toBe(AffinoChartFrame)
    expect(entrypoint.createChartsVue).toBe(createChartsVue)
  })
})
