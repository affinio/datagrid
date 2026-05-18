import { describe, expect, it } from "vitest"
import {
  getChartNumberValue,
  getChartStringValue,
  isFiniteChartNumber,
} from "@affino/charts-core"
import type { ChartDatum } from "@affino/charts-core"

describe("chart data access helpers", () => {
  it("detects finite numbers", () => {
    expect(isFiniteChartNumber(0)).toBe(true)
    expect(isFiniteChartNumber(42)).toBe(true)
    expect(isFiniteChartNumber(-3.5)).toBe(true)
  })

  it("rejects non-finite numbers and numeric strings", () => {
    expect(isFiniteChartNumber(Number.NaN)).toBe(false)
    expect(isFiniteChartNumber(Infinity)).toBe(false)
    expect(isFiniteChartNumber(-Infinity)).toBe(false)
    expect(isFiniteChartNumber("42")).toBe(false)
    expect(isFiniteChartNumber(null)).toBe(false)
    expect(isFiniteChartNumber(undefined)).toBe(false)
  })

  it("extracts string values predictably", () => {
    const row: ChartDatum = {
      label: "North",
      count: 12,
      active: true,
      empty: null,
      unset: undefined,
    }

    expect(getChartStringValue(row, "label")).toBe("North")
    expect(getChartStringValue(row, "count")).toBe("12")
    expect(getChartStringValue(row, "active")).toBe("true")
    expect(getChartStringValue(row, "empty")).toBe("")
    expect(getChartStringValue(row, "unset")).toBe("")
    expect(getChartStringValue(row, "missing")).toBe("")
  })

  it("extracts valid finite number values", () => {
    const row: ChartDatum = {
      value: 125,
    }

    expect(getChartNumberValue(row, "value")).toBe(125)
  })

  it("rejects invalid number values", () => {
    const row: ChartDatum = {
      missingLike: undefined,
      empty: null,
      numericString: "125",
      nan: Number.NaN,
      positiveInfinity: Infinity,
      negativeInfinity: -Infinity,
      text: "Revenue",
      active: true,
    }

    expect(getChartNumberValue(row, "missing")).toBeNull()
    expect(getChartNumberValue(row, "missingLike")).toBeNull()
    expect(getChartNumberValue(row, "empty")).toBeNull()
    expect(getChartNumberValue(row, "numericString")).toBeNull()
    expect(getChartNumberValue(row, "nan")).toBeNull()
    expect(getChartNumberValue(row, "positiveInfinity")).toBeNull()
    expect(getChartNumberValue(row, "negativeInfinity")).toBeNull()
    expect(getChartNumberValue(row, "text")).toBeNull()
    expect(getChartNumberValue(row, "active")).toBeNull()
  })
})
