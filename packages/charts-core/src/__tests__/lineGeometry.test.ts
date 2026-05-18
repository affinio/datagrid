import { describe, expect, it } from "vitest"
import { createLineChartGeometry } from "@affino/charts-core"
import type { ChartDatum } from "@affino/charts-core"

describe("line chart geometry", () => {
  it("creates points and path in index mode", () => {
    const rows: ChartDatum[] = [
      { value: 10 },
      { value: 20 },
      { value: 30 },
    ]

    const geometry = createLineChartGeometry({
      rows,
      yField: "value",
      size: { width: 200, height: 100 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    expect(geometry.xDomain).toEqual({ min: 0, max: 2 })
    expect(geometry.yDomain).toEqual({ min: 10, max: 30 })
    expect(geometry.points.map((point) => point.xValue)).toEqual([0, 1, 2])
    expect(geometry.points.map((point) => point.yValue)).toEqual([10, 20, 30])
    expect(geometry.path).toBe("M 0 100 L 100 50 L 200 0")
  })

  it("skips invalid y values", () => {
    const geometry = createLineChartGeometry({
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

  it("uses numeric xField in number mode", () => {
    const geometry = createLineChartGeometry({
      rows: [
        { x: 10, y: 100 },
        { x: 20, y: 200 },
      ],
      xField: "x",
      yField: "y",
      xScaleType: "number",
      size: { width: 100, height: 100 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    expect(geometry.xDomain).toEqual({ min: 10, max: 20 })
    expect(geometry.points.map((point) => point.xValue)).toEqual([10, 20])
    expect(geometry.path).toBe("M 0 100 L 100 0")
  })

  it("skips invalid x values in number mode", () => {
    const geometry = createLineChartGeometry({
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

    expect(geometry.points.map((point) => point.xValue)).toEqual([10, 30])
    expect(geometry.points.map((point) => point.yValue)).toEqual([100, 400])
  })

  it("preserves input order and does not sort numeric x values", () => {
    const rows: ChartDatum[] = [
      { x: 30, y: 3 },
      { x: 10, y: 1 },
      { x: 20, y: 2 },
    ]

    const geometry = createLineChartGeometry({
      rows,
      xField: "x",
      yField: "y",
      xScaleType: "number",
      size: { width: 100, height: 100 },
    })

    expect(geometry.points.map((point) => point.xValue)).toEqual([30, 10, 20])
    expect(geometry.points.map((point) => point.row)).toEqual(rows)
  })

  it("includes zero in y domain when requested", () => {
    const geometry = createLineChartGeometry({
      rows: [
        { value: 10 },
        { value: 20 },
      ],
      yField: "value",
      includeZeroY: true,
      size: { width: 100, height: 100 },
    })

    expect(geometry.yDomain).toEqual({ min: 0, max: 20 })
  })

  it("returns empty geometry for empty input", () => {
    const geometry = createLineChartGeometry({
      rows: [],
      yField: "value",
      size: { width: 100, height: 100 },
    })

    expect(geometry.points).toEqual([])
    expect(geometry.path).toBe("")
    expect(geometry.xDomain).toEqual({ min: 0, max: 1 })
    expect(geometry.yDomain).toEqual({ min: 0, max: 1 })
    expect(geometry.plotArea.width).toBeGreaterThanOrEqual(0)
    expect(geometry.plotArea.height).toBeGreaterThanOrEqual(0)
  })

  it("uses stable single point domains and path", () => {
    const geometry = createLineChartGeometry({
      rows: [{ value: 10 }],
      yField: "value",
      size: { width: 100, height: 100 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    expect(geometry.xDomain).toEqual({ min: -1, max: 1 })
    expect(geometry.yDomain).toEqual({ min: 9, max: 11 })
    expect(geometry.points[0]).toMatchObject({
      xValue: 0,
      yValue: 10,
      x: 50,
      y: 50,
    })
    expect(geometry.path).toBe("M 50 50")
  })

  it("does not emit NaN or Infinity geometry values", () => {
    const geometry = createLineChartGeometry({
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

    for (const point of geometry.points) {
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
    }
  })

  it("uses margins to resolve plot area", () => {
    const geometry = createLineChartGeometry({
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
