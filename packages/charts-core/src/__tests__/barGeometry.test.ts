import { describe, expect, it } from "vitest"
import { createBarChartGeometry } from "@affino/charts-core"
import type { ChartDatum } from "@affino/charts-core"

describe("bar chart geometry", () => {
  it("creates bars for valid rows", () => {
    const rows: ChartDatum[] = [
      { category: "A", value: 10 },
      { category: "B", value: 20 },
    ]

    const geometry = createBarChartGeometry({
      rows,
      categoryField: "category",
      valueField: "value",
      size: { width: 300, height: 200 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      paddingInner: 0,
      paddingOuter: 0,
    })

    expect(geometry.valueDomain).toEqual({ min: 0, max: 20 })
    expect(geometry.categories).toEqual(["A::0", "B::1"])
    expect(geometry.bars).toMatchObject([
      { key: "A::0", index: 0, row: rows[0], category: "A", value: 10 },
      { key: "B::1", index: 1, row: rows[1], category: "B", value: 20 },
    ])
    expect(geometry.bars[0]).toMatchObject({
      x: 0,
      y: 100,
      width: 150,
      height: 100,
    })
    expect(geometry.bars[1]).toMatchObject({
      x: 150,
      y: 0,
      width: 150,
      height: 200,
    })
  })

  it("skips rows with invalid numeric values", () => {
    const geometry = createBarChartGeometry({
      rows: [
        { category: "A", value: "10" },
        { category: "B", value: Number.NaN },
        { category: "C", value: Infinity },
        { category: "D", value: 4 },
      ],
      categoryField: "category",
      valueField: "value",
      size: { width: 100, height: 100 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    expect(geometry.bars).toHaveLength(1)
    expect(geometry.bars[0]?.category).toBe("D")
    expect(geometry.bars[0]?.value).toBe(4)
  })

  it("preserves valid row order", () => {
    const rows: ChartDatum[] = [
      { category: "C", value: 3 },
      { category: "A", value: 1 },
      { category: "B", value: 2 },
    ]

    const geometry = createBarChartGeometry({
      rows,
      categoryField: "category",
      valueField: "value",
      size: { width: 300, height: 100 },
    })

    expect(geometry.bars.map((bar) => bar.category)).toEqual(["C", "A", "B"])
    expect(geometry.bars.map((bar) => bar.row)).toEqual(rows)
  })

  it("limits valid bars with maxBars before geometry calculation", () => {
    const geometry = createBarChartGeometry({
      rows: [
        { category: "A", value: "invalid" },
        { category: "B", value: 2 },
        { category: "C", value: 3 },
        { category: "D", value: 4 },
      ],
      categoryField: "category",
      valueField: "value",
      size: { width: 300, height: 100 },
      maxBars: 2,
    })

    expect(geometry.bars.map((bar) => bar.category)).toEqual(["B", "C"])
    expect(geometry.valueDomain).toEqual({ min: 0, max: 3 })
  })

  it("creates separate bars for duplicate categories", () => {
    const geometry = createBarChartGeometry({
      rows: [
        { category: "UK", value: 5 },
        { category: "UK", value: 7 },
      ],
      categoryField: "category",
      valueField: "value",
      size: { width: 200, height: 100 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      paddingInner: 0,
      paddingOuter: 0,
    })

    expect(geometry.categories).toEqual(["UK::0", "UK::1"])
    expect(geometry.bars.map((bar) => bar.category)).toEqual(["UK", "UK"])
    expect(geometry.bars.map((bar) => bar.key)).toEqual(["UK::0", "UK::1"])
    expect(geometry.bars.map((bar) => bar.x)).toEqual([0, 100])
  })

  it("uses margins to resolve plot area", () => {
    const geometry = createBarChartGeometry({
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
  })

  it("includes zero by default in the value domain", () => {
    const geometry = createBarChartGeometry({
      rows: [
        { category: "A", value: 10 },
        { category: "B", value: 20 },
      ],
      categoryField: "category",
      valueField: "value",
      size: { width: 100, height: 100 },
    })

    expect(geometry.valueDomain).toEqual({ min: 0, max: 20 })
  })

  it("returns empty bars and fallback domain for empty input", () => {
    const geometry = createBarChartGeometry({
      rows: [],
      categoryField: "category",
      valueField: "value",
      size: { width: 100, height: 100 },
    })

    expect(geometry.bars).toEqual([])
    expect(geometry.categories).toEqual([])
    expect(geometry.valueDomain).toEqual({ min: 0, max: 1 })
    expect(geometry.plotArea.width).toBeGreaterThanOrEqual(0)
    expect(geometry.plotArea.height).toBeGreaterThanOrEqual(0)
  })

  it("does not emit NaN geometry values", () => {
    const geometry = createBarChartGeometry({
      rows: [
        { category: "A", value: 0 },
        { category: "B", value: 10 },
      ],
      categoryField: "category",
      valueField: "value",
      size: { width: 0, height: 0 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    for (const bar of geometry.bars) {
      expect(Number.isNaN(bar.x)).toBe(false)
      expect(Number.isNaN(bar.y)).toBe(false)
      expect(Number.isNaN(bar.width)).toBe(false)
      expect(Number.isNaN(bar.height)).toBe(false)
    }
  })

  it("handles negative values with non-negative heights", () => {
    const geometry = createBarChartGeometry({
      rows: [
        { category: "Loss", value: -10 },
        { category: "Gain", value: 20 },
      ],
      categoryField: "category",
      valueField: "value",
      size: { width: 200, height: 120 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      paddingInner: 0,
      paddingOuter: 0,
    })

    expect(geometry.valueDomain).toEqual({ min: -10, max: 20 })
    expect(geometry.bars).toHaveLength(2)
    for (const bar of geometry.bars) {
      expect(Number.isNaN(bar.x)).toBe(false)
      expect(Number.isNaN(bar.y)).toBe(false)
      expect(Number.isNaN(bar.width)).toBe(false)
      expect(Number.isNaN(bar.height)).toBe(false)
      expect(bar.height).toBeGreaterThanOrEqual(0)
    }
  })
})
