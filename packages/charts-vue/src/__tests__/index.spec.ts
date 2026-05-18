import { describe, expect, expectTypeOf, it } from "vitest"
import { AffinoChartFrame, createChartsVue } from "../index"
import type { ChartAnchorRect, ChartInteractionPoint, ChartThemeVariant } from "../index"

describe("@affino/charts-vue", () => {
  it("returns package metadata", () => {
    expect(createChartsVue()).toEqual({ version: "0.1.0" })
  })

  it("exports public chart-adjacent types", () => {
    expectTypeOf<ChartThemeVariant>().toEqualTypeOf<"default" | "muted" | "success" | "warning" | "danger">()
    expectTypeOf<ChartInteractionPoint>().toEqualTypeOf<{ x: number; y: number }>()
    expectTypeOf<ChartAnchorRect>().toEqualTypeOf<{ x: number; y: number; width: number; height: number }>()
  })

  it("exports a clean package entrypoint", async () => {
    const entrypoint = await import("../index")

    expect(Object.keys(entrypoint)).toEqual(["AffinoChartFrame", "createChartsVue"])
    expect(entrypoint.AffinoChartFrame).toBe(AffinoChartFrame)
    expect(entrypoint.createChartsVue).toBe(createChartsVue)
  })
})
