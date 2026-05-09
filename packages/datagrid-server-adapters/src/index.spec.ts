import { describe, expect, it } from "vitest"
import {
  normalizeDataGridServerColumnFilters,
  normalizeDataGridServerQuickFilter,
} from "./index"

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

describe("normalizeDataGridServerColumnFilters", () => {
  it("normalizes value-set filters and preserves stable column order", () => {
    expect(normalizeDataGridServerColumnFilters({
      owner: { kind: "valueSet", tokens: [" string:noc ", "", "string:noc", "string:payments"] },
      empty: { kind: "valueSet", tokens: [] },
    })).toEqual({
      owner: {
        kind: "valueSet",
        tokens: ["string:noc", "string:payments"],
      },
    })
  })

  it("normalizes predicate filters and drops unusable predicates", () => {
    expect(normalizeDataGridServerColumnFilters({
      amount: { kind: "predicate", operator: " between ", value: 10, value2: 20 },
      name: { kind: "predicate", operator: "contains", value: "NOC", caseSensitive: true },
      invalid: { kind: "predicate", operator: "contains" },
      empty: { kind: "predicate", operator: " isEmpty " },
      nan: { kind: "predicate", operator: "equals", value: Number.NaN },
    })).toEqual({
      amount: {
        kind: "predicate",
        operator: "between",
        value: 10,
        value2: 20,
      },
      name: {
        kind: "predicate",
        operator: "contains",
        value: "NOC",
        caseSensitive: true,
      },
      empty: {
        kind: "predicate",
        operator: "isEmpty",
      },
    })
  })

  it("normalizes style filters and supports column id mapping", () => {
    expect(normalizeDataGridServerColumnFilters({
      status: { kind: "styleValueSet", styleKey: " bg ", tokens: [" #fff ", "#fff", "#000"] },
      ignored: { kind: "styleValueSet", styleKey: " ", tokens: ["#fff"] },
    }, {
      columnIdMap: {
        status: "status_code",
      },
    })).toEqual({
      status_code: {
        kind: "styleValueSet",
        styleKey: "bg",
        tokens: ["#fff", "#000"],
      },
    })
  })
})
