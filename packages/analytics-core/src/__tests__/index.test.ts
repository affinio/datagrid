import { describe, expect, it } from "vitest"
import { createAnalyticsCore } from "../index"
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
})
