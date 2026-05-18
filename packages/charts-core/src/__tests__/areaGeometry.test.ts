import { describe, expect, it } from "vitest"
import { createAreaChartGeometry } from "@affino/charts-core"
import type { ChartDatum } from "@affino/charts-core"

describe("area chart geometry", () => {
  it("creates points, linePath, and areaPath in index mode", () => {
    const rows: ChartDatum[] = [
      { value: 0 },
      { value: 10 },
      { value: 20 },
    ]

    const geometry = createAreaChartGeometry({
      rows,
      yField: "value",
      size: { width: 200, height: 100 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    expect(geometry.xDomain).toEqual({ min: 0, max: 2 })
    expect(geometry.yDomain).toEqual({ min: 0, max: 20 })
    expect(geometry.points.map((point) => point.xValue)).toEqual([0, 1, 2])
    expect(geometry.linePath).toBe("M 0 100 L 100 50 L 200 0")
    expect(geometry.areaPath).toBe("M 0 100 L 0 100 L 100 50 L 200 0 L 200 100 Z")
  })

  it("skips invalid y values", () => {
    const geometry = createAreaChartGeometry({
      rows: [
        { value: 10 },
        { value: "20" },
        { value: Number.NaN },
        { value: Infinity },
        { value: 30 },
      ],
      yField: "value",
      size: { width: 100, height: 100 },
    })

    expect(geometry.points.map((point) => point.yValue)).toEqual([10, 30])
    expect(geometry.points.map((point) => point.xValue)).toEqual([0, 1])
  })

  it("uses numeric xField and skips invalid x in number mode", () => {
    const geometry = createAreaChartGeometry({
      rows: [
        { x: 10, y: 100 },
        { x: "20", y: 200 },
        { x: Number.NaN, y: 300 },
        { x: 30, y: 400 },
      ],
      xField: "x",
      yField: "y",
      xScaleType: "number",
      size: { width: 100, height: 100 },
    })

    expect(geometry.xDomain).toEqual({ min: 10, max: 30 })
    expect(geometry.points.map((point) => point.xValue)).toEqual([10, 30])
    expect(geometry.points.map((point) => point.yValue)).toEqual([100, 400])
  })

  it("preserves input order and does not sort numeric x values", () => {
    const rows: ChartDatum[] = [
      { x: 30, y: 3 },
      { x: 10, y: 1 },
      { x: 20, y: 2 },
    ]

    const geometry = createAreaChartGeometry({
      rows,
      xField: "x",
      yField: "y",
      xScaleType: "number",
      size: { width: 100, height: 100 },
    })

    expect(geometry.points.map((point) => point.xValue)).toEqual([30, 10, 20])
    expect(geometry.points.map((point) => point.row)).toEqual(rows)
  })

  it("includes zero in y domain by default", () => {
    const geometry = createAreaChartGeometry({
      rows: [
        { value: 10 },
        { value: 20 },
      ],
      yField: "value",
      size: { width: 100, height: 100 },
    })

    expect(geometry.yDomain).toEqual({ min: 0, max: 20 })
  })

  it("includes baselineValue in y domain", () => {
    const geometry = createAreaChartGeometry({
      rows: [
        { value: 10 },
        { value: 20 },
      ],
      yField: "value",
      includeZeroY: false,
      baselineValue: 5,
      size: { width: 100, height: 100 },
    })

    expect(geometry.baselineValue).toBe(5)
    expect(geometry.yDomain).toEqual({ min: 5, max: 20 })
  })

  it("returns finite baselineY", () => {
    const geometry = createAreaChartGeometry({
      rows: [{ value: 10 }],
      yField: "value",
      baselineValue: Number.NaN,
      size: { width: 0, height: 0 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    expect(geometry.baselineValue).toBe(0)
    expect(Number.isFinite(geometry.baselineY)).toBe(true)
  })

  it("uses deterministic one point behavior", () => {
    const geometry = createAreaChartGeometry({
      rows: [{ value: 10 }],
      yField: "value",
      size: { width: 100, height: 100 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    expect(geometry.points[0]).toMatchObject({
      xValue: 0,
      yValue: 10,
      x: 50,
      y: 0,
    })
    expect(geometry.linePath).toBe("M 50 0")
    expect(geometry.areaPath).toBe("")
  })

  it("returns empty paths for empty input", () => {
    const geometry = createAreaChartGeometry({
      rows: [],
      yField: "value",
      size: { width: 100, height: 100 },
    })

    expect(geometry.points).toEqual([])
    expect(geometry.linePath).toBe("")
    expect(geometry.areaPath).toBe("")
    expect(geometry.xDomain).toEqual({ min: 0, max: 1 })
    expect(geometry.yDomain).toEqual({ min: 0, max: 1 })
  })

  it("does not emit NaN or Infinity geometry values", () => {
    const geometry = createAreaChartGeometry({
      rows: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      xField: "x",
      yField: "y",
      xScaleType: "number",
      size: { width: 0, height: 0 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    expect(Number.isFinite(geometry.baselineY)).toBe(true)
    for (const point of geometry.points) {
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
    }
    expect(geometry.linePath).not.toContain("NaN")
    expect(geometry.areaPath).not.toContain("NaN")
    expect(geometry.linePath).not.toContain("Infinity")
    expect(geometry.areaPath).not.toContain("Infinity")
  })

  it("uses margins to resolve plot area", () => {
    const geometry = createAreaChartGeometry({
      rows: [{ value: 10 }],
      yField: "value",
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
