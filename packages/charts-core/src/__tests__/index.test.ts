import { describe, expect, it } from "vitest"
import { createChartsCore } from "@affino/charts-core"
import type {
  ChartDatum,
  ChartMargin,
  ChartPoint,
  ChartRect,
  ChartSize,
} from "@affino/charts-core"

describe("charts-core", () => {
  it("creates a versioned core instance", () => {
    expect(createChartsCore()).toEqual({ version: "0.1.0" })
  })

  it("exports public chart types from the package entrypoint", () => {
    const size: ChartSize = { width: 640, height: 360 }
    const margin: ChartMargin = { top: 16, right: 24, bottom: 32, left: 40 }
    const point: ChartPoint = { x: 10, y: 20 }

    expect(size.width).toBe(640)
    expect(margin.left).toBe(40)
    expect(point).toEqual({ x: 10, y: 20 })
  })

  it("type-checks sample chart datum and rect values", () => {
    const datum: ChartDatum = {
      category: "Revenue",
      value: 125,
    }
    const rect: ChartRect = {
      x: 8,
      y: 12,
      width: 200,
      height: 120,
    }

    expect(datum.category).toBe("Revenue")
    expect(rect.width).toBe(200)
  })
})
