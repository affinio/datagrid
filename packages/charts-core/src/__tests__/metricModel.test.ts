import { describe, expect, it } from "vitest"
import { createMetricModel } from "@affino/charts-core"

describe("metric model helpers", () => {
  it("formats number values", () => {
    expect(createMetricModel({
      label: "Revenue",
      value: 1234.567,
      precision: 1,
    }).displayValue).toBe("1,234.6")
  })

  it("formats percent values", () => {
    expect(createMetricModel({
      label: "Conversion",
      value: 0.125,
      format: "percent",
      precision: 1,
    }).displayValue).toBe("12.5%")
  })

  it("formats currency values", () => {
    expect(createMetricModel({
      label: "Revenue",
      value: 1234.5,
      format: "currency",
      currency: "GBP",
      precision: 2,
    }).displayValue).toBe("£1,234.50")
  })

  it("formats compact values", () => {
    expect(createMetricModel({
      label: "Users",
      value: 1200,
      format: "compact",
      precision: 1,
    }).displayValue).toBe("1.2k")
  })

  it("formats raw and null values", () => {
    expect(createMetricModel({
      label: "Status",
      value: "Ready",
      format: "raw",
    }).displayValue).toBe("Ready")
    expect(createMetricModel({
      label: "Missing",
      value: null,
      format: "raw",
    }).displayValue).toBe("—")
  })

  it("computes upward deltas", () => {
    expect(createMetricModel({
      label: "Revenue",
      value: 120,
      previousValue: 100,
    }).delta).toEqual({
      value: 20,
      percentage: 20,
      direction: "up",
    })
  })

  it("computes downward and flat deltas", () => {
    expect(createMetricModel({
      label: "Revenue",
      value: 80,
      previousValue: 100,
    }).delta).toEqual({
      value: -20,
      percentage: -20,
      direction: "down",
    })
    expect(createMetricModel({
      label: "Revenue",
      value: 100,
      previousValue: 100,
    }).delta).toEqual({
      value: 0,
      percentage: 0,
      direction: "flat",
    })
  })

  it("sets delta percentage to null when previous value is zero", () => {
    expect(createMetricModel({
      label: "Revenue",
      value: 10,
      previousValue: 0,
    }).delta).toEqual({
      value: 10,
      percentage: null,
      direction: "up",
    })
  })

  it("returns null delta for invalid previous or current values", () => {
    expect(createMetricModel({
      label: "Revenue",
      value: "100",
      previousValue: 90,
    }).delta).toBeNull()
    expect(createMetricModel({
      label: "Revenue",
      value: Number.NaN,
      previousValue: 90,
    }).delta).toBeNull()
    expect(createMetricModel({
      label: "Revenue",
      value: 100,
      previousValue: Infinity,
    }).delta).toBeNull()
  })

  it("filters trend to finite numbers", () => {
    expect(createMetricModel({
      label: "Revenue",
      value: 100,
      trend: [1, Number.NaN, 2, Infinity, -Infinity, 3],
    }).trend).toEqual([1, 2, 3])
  })

  it("preserves unit", () => {
    const model = createMetricModel({
      label: "Latency",
      value: 120,
      unit: "ms",
    })

    expect(model.unit).toBe("ms")
    expect(model.displayValue).toBe("120")
  })
})
