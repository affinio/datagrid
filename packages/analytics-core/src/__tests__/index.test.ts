import { describe, expect, it } from "vitest"
import { createAnalyticsCore, inferAnalyticsSchema } from "../index"
import type {
  AnalyticsQuery,
  AnalyticsRow,
  AnalyticsSchema,
} from "../index"

describe("analytics-core", () => {
  it("creates a versioned core instance", () => {
    expect(createAnalyticsCore()).toEqual({ version: "0.1.0" })
  })

  it("exports public analytics types", () => {
    const row: AnalyticsRow = {
      region: "North",
      revenue: 125,
      active: true,
    }

    const schema: AnalyticsSchema = {
      fields: [
        { id: "region", label: "Region", type: "string" },
        { id: "revenue", label: "Revenue", type: "number" },
        { id: "active", type: "boolean" },
      ],
    }

    const query: AnalyticsQuery = {
      dimensions: [{ field: "region", as: "Region" }],
      measures: [
        { op: "count", as: "Rows" },
        { field: "revenue", op: "sum", as: "Revenue" },
      ],
    }

    expect(row.region).toBe("North")
    expect(schema.fields).toHaveLength(3)
    expect(query.measures?.map((measure) => measure.op)).toEqual(["count", "sum"])
  })

  it("infers an empty schema for empty rows", () => {
    expect(inferAnalyticsSchema([])).toEqual({ fields: [] })
  })

  it("infers field types and preserves first-seen field order", () => {
    expect(inferAnalyticsSchema([
      { region: "UK", amount: 100 },
      { active: true, amount: 250, region: "EU", closedAt: new Date("2026-01-01") },
    ])).toEqual({
      fields: [
        { id: "region", type: "string" },
        { id: "amount", type: "number" },
        { id: "active", type: "boolean" },
        { id: "closedAt", type: "datetime" },
      ],
    })
  })

  it("ignores nullish values when a concrete type exists", () => {
    expect(inferAnalyticsSchema([
      { amount: null },
      { amount: 100 },
      { amount: undefined },
    ])).toEqual({
      fields: [
        { id: "amount", type: "number" },
      ],
    })
  })

  it("infers unknown for fields with only nullish values", () => {
    expect(inferAnalyticsSchema([
      { amount: null },
      { amount: undefined },
    ])).toEqual({
      fields: [
        { id: "amount", type: "unknown" },
      ],
    })
  })

  it("infers unknown for mixed incompatible non-null values", () => {
    expect(inferAnalyticsSchema([
      { value: 100 },
      { value: "100" },
    ])).toEqual({
      fields: [
        { id: "value", type: "unknown" },
      ],
    })
  })
})
