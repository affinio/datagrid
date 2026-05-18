import { describe, expect, it } from "vitest"
import { createScatterChartGeometry } from "@affino/charts-core"
import type { ChartDatum } from "@affino/charts-core"

describe("scatter chart geometry", () => {
  it("creates points for valid x/y rows", () => {
    const rows: ChartDatum[] = [
      { x: 0, y: 10 },
      { x: 10, y: 20 },
    ]

    const geometry = createScatterChartGeometry({
      rows,
      xField: "x",
      yField: "y",
      size: { width: 100, height: 100 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    expect(geometry.points).toMatchObject([
      { key: "0", index: 0, row: rows[0], xValue: 0, yValue: 10, radiusValue: null },
      { key: "1", index: 1, row: rows[1], xValue: 10, yValue: 20, radiusValue: null },
    ])
    expect(geometry.points.map((point) => ({ x: point.x, y: point.y }))).toEqual([
      { x: 0, y: 100 },
      { x: 100, y: 0 },
    ])
  })

  it("skips invalid x/y values", () => {
    const geometry = createScatterChartGeometry({
      rows: [
        { x: 0, y: 10 },
        { x: "1", y: 20 },
        { x: 2, y: Number.NaN },
        { x: Infinity, y: 40 },
        { x: 4, y: 50 },
      ],
      xField: "x",
      yField: "y",
      size: { width: 100, height: 100 },
    })

    expect(geometry.points.map((point) => [point.xValue, point.yValue])).toEqual([
      [0, 10],
      [4, 50],
    ])
  })

  it("preserves input order", () => {
    const rows: ChartDatum[] = [
      { x: 30, y: 3 },
      { x: 10, y: 1 },
      { x: 20, y: 2 },
    ]

    const geometry = createScatterChartGeometry({
      rows,
      xField: "x",
      yField: "y",
      size: { width: 100, height: 100 },
    })

    expect(geometry.points.map((point) => point.xValue)).toEqual([30, 10, 20])
    expect(geometry.points.map((point) => point.row)).toEqual(rows)
  })

  it("computes x and y domains", () => {
    const geometry = createScatterChartGeometry({
      rows: [
        { x: -5, y: 10 },
        { x: 15, y: 30 },
      ],
      xField: "x",
      yField: "y",
      size: { width: 100, height: 100 },
    })

    expect(geometry.xDomain).toEqual({ min: -5, max: 15 })
    expect(geometry.yDomain).toEqual({ min: 10, max: 30 })
  })

  it("includes zero in x and y domains when requested", () => {
    const geometry = createScatterChartGeometry({
      rows: [
        { x: 10, y: 20 },
        { x: 15, y: 30 },
      ],
      xField: "x",
      yField: "y",
      includeZeroX: true,
      includeZeroY: true,
      size: { width: 100, height: 100 },
    })

    expect(geometry.xDomain).toEqual({ min: 0, max: 15 })
    expect(geometry.yDomain).toEqual({ min: 0, max: 30 })
  })

  it("uses margins to resolve plot area", () => {
    const geometry = createScatterChartGeometry({
      rows: [{ x: 1, y: 2 }],
      xField: "x",
      yField: "y",
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

  it("uses default radius when radiusField is omitted", () => {
    const geometry = createScatterChartGeometry({
      rows: [{ x: 1, y: 2 }],
      xField: "x",
      yField: "y",
      size: { width: 100, height: 100 },
    })

    expect(geometry.radiusDomain).toBeNull()
    expect(geometry.points[0]?.radiusValue).toBeNull()
    expect(geometry.points[0]?.radius).toBe(4)
  })

  it("maps radiusField values to bubble radius", () => {
    const geometry = createScatterChartGeometry({
      rows: [
        { x: 0, y: 0, r: 10 },
        { x: 1, y: 1, r: 20 },
      ],
      xField: "x",
      yField: "y",
      radiusField: "r",
      minRadius: 5,
      maxRadius: 15,
      size: { width: 100, height: 100 },
    })

    expect(geometry.radiusDomain).toEqual({ min: 10, max: 20 })
    expect(geometry.points.map((point) => point.radius)).toEqual([5, 15])
  })

  it("falls back safely for invalid radius values", () => {
    const geometry = createScatterChartGeometry({
      rows: [
        { x: 0, y: 0, r: "10" },
        { x: 1, y: 1, r: Number.NaN },
        { x: 2, y: 2, r: 20 },
      ],
      xField: "x",
      yField: "y",
      radiusField: "r",
      minRadius: 5,
      maxRadius: 15,
      size: { width: 100, height: 100 },
    })

    expect(geometry.radiusDomain).toEqual({ min: 19, max: 21 })
    expect(geometry.points.map((point) => point.radiusValue)).toEqual([null, null, 20])
    expect(geometry.points.map((point) => point.radius)).toEqual([5, 5, 10])
  })

  it("returns empty geometry for empty input", () => {
    const geometry = createScatterChartGeometry({
      rows: [],
      xField: "x",
      yField: "y",
      size: { width: 100, height: 100 },
    })

    expect(geometry.points).toEqual([])
    expect(geometry.xDomain).toEqual({ min: 0, max: 1 })
    expect(geometry.yDomain).toEqual({ min: 0, max: 1 })
    expect(geometry.radiusDomain).toBeNull()
    expect(geometry.plotArea.width).toBeGreaterThanOrEqual(0)
    expect(geometry.plotArea.height).toBeGreaterThanOrEqual(0)
  })

  it("does not emit NaN or Infinity geometry values", () => {
    const geometry = createScatterChartGeometry({
      rows: [
        { x: 0, y: 0, r: 0 },
        { x: 10, y: 10, r: 10 },
      ],
      xField: "x",
      yField: "y",
      radiusField: "r",
      minRadius: -1,
      maxRadius: 8,
      size: { width: 0, height: 0 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    for (const point of geometry.points) {
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
      expect(Number.isFinite(point.radius)).toBe(true)
      expect(point.radius).toBeGreaterThanOrEqual(0)
    }
  })
})
