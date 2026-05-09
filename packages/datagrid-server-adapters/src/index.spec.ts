import { describe, expect, it } from "vitest"
import { normalizeDataGridServerQuickFilter } from "./index"

describe("normalizeDataGridServerQuickFilter", () => {
  it("normalizes query, columns, and mode", () => {
    expect(normalizeDataGridServerQuickFilter({
      query: " platform eu ",
      columns: [" owner ", "service", "owner", "", " region "],
      mode: "tokens",
    })).toEqual({
      query: "platform eu",
      columns: ["owner", "service", "region"],
      mode: "tokens",
    })
  })

  it("drops empty quick filters", () => {
    expect(normalizeDataGridServerQuickFilter(null)).toBeNull()
    expect(normalizeDataGridServerQuickFilter({
      query: "   ",
      columns: ["owner"],
      mode: "tokens",
    })).toBeNull()
  })

  it("uses a configurable mode fallback without creating a top-level search value", () => {
    const normalized = normalizeDataGridServerQuickFilter({
      query: "platform",
      mode: "invalid" as "contains",
    }, {
      quickFilterModeFallback: "tokens",
    })

    expect(normalized).toEqual({
      query: "platform",
      mode: "tokens",
    })
    expect(normalized).not.toHaveProperty("search")
  })
})
