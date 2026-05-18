import { describe, expect, it } from "vitest"
import { createPieChartGeometry } from "@affino/charts-core"
import type { ChartDatum } from "@affino/charts-core"

describe("pie chart geometry", () => {
  it("creates slices for valid positive values", () => {
    const rows: ChartDatum[] = [
      { category: "A", value: 10 },
      { category: "B", value: 30 },
    ]

    const geometry = createPieChartGeometry({
      rows,
      categoryField: "category",
      valueField: "value",
      size: { width: 200, height: 200 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    expect(geometry.total).toBe(40)
    expect(geometry.center).toEqual({ x: 100, y: 100 })
    expect(geometry.radius).toBe(100)
    expect(geometry.innerRadius).toBe(0)
    expect(geometry.slices).toMatchObject([
      { key: "A::0", index: 0, row: rows[0], category: "A", value: 10 },
      { key: "B::1", index: 1, row: rows[1], category: "B", value: 30 },
    ])
  })

  it("skips invalid values and values at or below zero", () => {
    const geometry = createPieChartGeometry({
      rows: [
        { category: "A", value: 10 },
        { category: "B", value: "20" },
        { category: "C", value: Number.NaN },
        { category: "D", value: Infinity },
        { category: "E", value: 0 },
        { category: "F", value: -5 },
      ],
      categoryField: "category",
      valueField: "value",
      size: { width: 100, height: 100 },
    })

    expect(geometry.slices.map((slice) => slice.category)).toEqual(["A"])
    expect(geometry.total).toBe(10)
  })

  it("returns percentages that sum to one", () => {
    const geometry = createPieChartGeometry({
      rows: [
        { category: "A", value: 1 },
        { category: "B", value: 2 },
        { category: "C", value: 3 },
      ],
      categoryField: "category",
      valueField: "value",
      size: { width: 100, height: 100 },
    })

    const percentageTotal = geometry.slices.reduce((sum, slice) => sum + slice.percentage, 0)
    expect(percentageTotal).toBeCloseTo(1)
  })

  it("preserves valid row order", () => {
    const rows: ChartDatum[] = [
      { category: "C", value: 3 },
      { category: "A", value: 1 },
      { category: "B", value: 2 },
    ]

    const geometry = createPieChartGeometry({
      rows,
      categoryField: "category",
      valueField: "value",
      size: { width: 100, height: 100 },
    })

    expect(geometry.slices.map((slice) => slice.category)).toEqual(["C", "A", "B"])
    expect(geometry.slices.map((slice) => slice.row)).toEqual(rows)
  })

  it("creates separate slices for duplicate categories", () => {
    const geometry = createPieChartGeometry({
      rows: [
        { category: "UK", value: 5 },
        { category: "UK", value: 7 },
      ],
      categoryField: "category",
      valueField: "value",
      size: { width: 100, height: 100 },
    })

    expect(geometry.slices.map((slice) => slice.category)).toEqual(["UK", "UK"])
    expect(geometry.slices.map((slice) => slice.key)).toEqual(["UK::0", "UK::1"])
  })

  it("creates non-empty pie paths", () => {
    const geometry = createPieChartGeometry({
      rows: [
        { category: "A", value: 10 },
        { category: "B", value: 20 },
      ],
      categoryField: "category",
      valueField: "value",
      size: { width: 100, height: 100 },
    })

    expect(geometry.slices.every((slice) => slice.path.length > 0)).toBe(true)
    expect(geometry.slices[0]?.path).toContain("A")
  })

  it("creates non-empty donut paths when innerRadiusRatio is greater than zero", () => {
    const geometry = createPieChartGeometry({
      rows: [{ category: "A", value: 10 }],
      categoryField: "category",
      valueField: "value",
      size: { width: 100, height: 100 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      innerRadiusRatio: 0.5,
    })

    expect(geometry.innerRadius).toBe(25)
    expect(geometry.slices[0]?.path).toContain("L")
    expect(geometry.slices[0]?.path.length).toBeGreaterThan(0)
  })

  it("clamps innerRadiusRatio", () => {
    const geometry = createPieChartGeometry({
      rows: [{ category: "A", value: 10 }],
      categoryField: "category",
      valueField: "value",
      size: { width: 100, height: 100 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      innerRadiusRatio: 2,
    })

    expect(geometry.radius).toBe(50)
    expect(geometry.innerRadius).toBe(47.5)
  })

  it("creates a valid full-circle path for a single slice", () => {
    const geometry = createPieChartGeometry({
      rows: [{ category: "A", value: 10 }],
      categoryField: "category",
      valueField: "value",
      size: { width: 100, height: 100 },
    })

    const slice = geometry.slices[0]
    expect(slice?.percentage).toBe(1)
    expect(slice?.path.length).toBeGreaterThan(0)
    expect(slice?.path).not.toContain("NaN")
    expect(slice?.path).not.toContain("Infinity")
  })

  it("returns empty slices and total zero for empty input", () => {
    const geometry = createPieChartGeometry({
      rows: [],
      categoryField: "category",
      valueField: "value",
      size: { width: 100, height: 80 },
    })

    expect(geometry.slices).toEqual([])
    expect(geometry.total).toBe(0)
    expect(geometry.radius).toBeGreaterThanOrEqual(0)
    expect(geometry.center.x).toBeGreaterThanOrEqual(0)
    expect(geometry.center.y).toBeGreaterThanOrEqual(0)
  })

  it("uses margins to resolve plot area", () => {
    const geometry = createPieChartGeometry({
      rows: [{ category: "A", value: 10 }],
      categoryField: "category",
      valueField: "value",
      size: { width: 300, height: 200 },
      margin: { top: 10, right: 20, bottom: 30, left: 40 },
    })

    expect(geometry.plotArea).toEqual({
      x: 40,
      y: 10,
      width: 240,
      height: 160,
    })
    expect(geometry.center).toEqual({ x: 160, y: 90 })
    expect(geometry.radius).toBe(80)
  })

  it("does not emit NaN or Infinity geometry values", () => {
    const geometry = createPieChartGeometry({
      rows: [
        { category: "A", value: 10 },
        { category: "B", value: 20 },
      ],
      categoryField: "category",
      valueField: "value",
      size: { width: 0, height: 0 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    expect(Number.isFinite(geometry.center.x)).toBe(true)
    expect(Number.isFinite(geometry.center.y)).toBe(true)
    expect(Number.isFinite(geometry.radius)).toBe(true)
    expect(Number.isFinite(geometry.innerRadius)).toBe(true)
    for (const slice of geometry.slices) {
      expect(Number.isFinite(slice.startAngle)).toBe(true)
      expect(Number.isFinite(slice.endAngle)).toBe(true)
      expect(Number.isFinite(slice.centroid.x)).toBe(true)
      expect(Number.isFinite(slice.centroid.y)).toBe(true)
      expect(slice.path).not.toContain("NaN")
      expect(slice.path).not.toContain("Infinity")
    }
  })
})
