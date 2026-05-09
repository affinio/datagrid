import { describe, expect, it } from "vitest"

import { resolveDataGridQuickFilter } from "../config/dataGridQuickFilter"

describe("resolveDataGridQuickFilter contract", () => {
  it("keeps quick filter disabled by default", () => {
    expect(resolveDataGridQuickFilter(undefined)).toEqual({
      enabled: false,
      placeholder: "Search rows",
      columns: null,
      mode: "contains",
    })
  })

  it("accepts boolean shorthand", () => {
    expect(resolveDataGridQuickFilter(true)).toEqual({
      enabled: true,
      placeholder: "Search rows",
      columns: null,
      mode: "contains",
    })
    expect(resolveDataGridQuickFilter(false)).toEqual({
      enabled: false,
      placeholder: "Search rows",
      columns: null,
      mode: "contains",
    })
  })

  it("normalizes shell-only options without creating a new state channel", () => {
    expect(resolveDataGridQuickFilter({
      placeholder: " Search accounts ",
      columns: [" name ", "", "status", "name"],
      mode: "tokens",
    })).toEqual({
      enabled: true,
      placeholder: "Search accounts",
      columns: ["name", "status"],
      mode: "tokens",
    })
  })
})
