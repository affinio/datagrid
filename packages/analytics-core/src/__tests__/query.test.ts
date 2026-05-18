import { describe, expect, it } from "vitest"
import {
  aggregateRows,
  executeAnalyticsQuery,
} from "../index"
import type { AnalyticsRow } from "../index"

describe("executeAnalyticsQuery", () => {
  it("matches aggregateRows when sort and limit are omitted", () => {
    const rows: AnalyticsRow[] = [
      { region: "UK", amount: 100 },
      { region: "UK", amount: 200 },
      { region: "EU", amount: 250 },
    ]
    const query = {
      dimensions: [{ field: "region" }],
      measures: [{ field: "amount", op: "sum" as const, as: "totalAmount" }],
    }

    expect(executeAnalyticsQuery(rows, query)).toEqual(aggregateRows(rows, query))
  })

  it("sorts by output field names including measure aliases", () => {
    expect(executeAnalyticsQuery([
      { region: "UK", amount: 100 },
      { region: "EU", amount: 250 },
      { region: "UK", amount: 200 },
    ], {
      dimensions: [{ field: "region" }],
      measures: [{ field: "amount", op: "sum", as: "totalAmount" }],
      sort: [{ field: "totalAmount", direction: "desc" }],
    })).toEqual([
      { region: "UK", totalAmount: 300 },
      { region: "EU", totalAmount: 250 },
    ])
  })

  it("uses ascending sort by default and applies limit after sort", () => {
    expect(executeAnalyticsQuery([
      { region: "UK", amount: 300 },
      { region: "EU", amount: 100 },
      { region: "US", amount: 200 },
    ], {
      dimensions: [{ field: "region" }],
      measures: [{ field: "amount", op: "sum", as: "totalAmount" }],
      sort: [{ field: "totalAmount" }],
      limit: 2,
    })).toEqual([
      { region: "EU", totalAmount: 100 },
      { region: "US", totalAmount: 200 },
    ])
  })

  it("applies multiple sort entries in order", () => {
    expect(executeAnalyticsQuery([
      { region: "UK", status: "closed", amount: 100 },
      { region: "UK", status: "open", amount: 100 },
      { region: "EU", status: "open", amount: 100 },
    ], {
      dimensions: [
        { field: "region" },
        { field: "status" },
      ],
      measures: [{ field: "amount", op: "sum", as: "totalAmount" }],
      sort: [
        { field: "totalAmount", direction: "desc" },
        { field: "region" },
        { field: "status", direction: "desc" },
      ],
    })).toEqual([
      { region: "EU", status: "open", totalAmount: 100 },
      { region: "UK", status: "open", totalAmount: 100 },
      { region: "UK", status: "closed", totalAmount: 100 },
    ])
  })

  it("sorts booleans, dates, and strings by their typed values", () => {
    expect(executeAnalyticsQuery([
      { active: true, createdAt: new Date("2026-01-02"), label: "b" },
      { active: false, createdAt: new Date("2026-01-01"), label: "c" },
      { active: false, createdAt: new Date("2026-01-03"), label: "a" },
    ], {
      dimensions: [
        { field: "active" },
        { field: "createdAt" },
        { field: "label" },
      ],
      measures: [{ op: "count" }],
      sort: [
        { field: "active" },
        { field: "createdAt", direction: "desc" },
        { field: "label" },
      ],
    })).toEqual([
      { active: false, createdAt: new Date("2026-01-03"), label: "a", count: 1 },
      { active: false, createdAt: new Date("2026-01-01"), label: "c", count: 1 },
      { active: true, createdAt: new Date("2026-01-02"), label: "b", count: 1 },
    ])
  })

  it("sorts null and undefined last for ascending and descending directions", () => {
    const rows: AnalyticsRow[] = [
      { bucket: "missing", score: null },
      { bucket: "low", score: 1 },
      { bucket: "empty", score: undefined },
      { bucket: "high", score: 3 },
    ]

    expect(executeAnalyticsQuery(rows, {
      dimensions: [
        { field: "bucket" },
        { field: "score" },
      ],
      measures: [{ op: "count" }],
      sort: [{ field: "score" }],
    })).toEqual([
      { bucket: "low", score: 1, count: 1 },
      { bucket: "high", score: 3, count: 1 },
      { bucket: "missing", score: null, count: 1 },
      { bucket: "empty", score: undefined, count: 1 },
    ])

    expect(executeAnalyticsQuery(rows, {
      dimensions: [
        { field: "bucket" },
        { field: "score" },
      ],
      measures: [{ op: "count" }],
      sort: [{ field: "score", direction: "desc" }],
    })).toEqual([
      { bucket: "high", score: 3, count: 1 },
      { bucket: "low", score: 1, count: 1 },
      { bucket: "missing", score: null, count: 1 },
      { bucket: "empty", score: undefined, count: 1 },
    ])
  })

  it("sorts mixed unsupported values deterministically with string fallback", () => {
    expect(executeAnalyticsQuery([
      { value: { rank: 2 } },
      { value: ["a"] },
      { value: Symbol.for("z") },
    ], {
      dimensions: [{ field: "value" }],
      measures: [{ op: "count" }],
      sort: [{ field: "value" }],
    })).toEqual([
      { value: { rank: 2 }, count: 1 },
      { value: ["a"], count: 1 },
      { value: Symbol.for("z"), count: 1 },
    ])
  })

  it("returns no rows for non-positive limits", () => {
    const rows: AnalyticsRow[] = [{ region: "UK" }]
    const query = {
      dimensions: [{ field: "region" }],
      measures: [{ op: "count" as const }],
    }

    expect(executeAnalyticsQuery(rows, { ...query, limit: 0 })).toEqual([])
    expect(executeAnalyticsQuery(rows, { ...query, limit: -1 })).toEqual([])
  })

  it("applies filters before aggregation and sorting", () => {
    expect(executeAnalyticsQuery([
      { region: "UK", amount: 100 },
      { region: "UK", amount: 200 },
      { region: "EU", amount: 250 },
    ], {
      filters: [{ field: "region", op: "equals", value: "UK" }],
      dimensions: [{ field: "region" }],
      measures: [{ field: "amount", op: "sum", as: "totalAmount" }],
      sort: [{ field: "totalAmount", direction: "desc" }],
    })).toEqual([
      { region: "UK", totalAmount: 300 },
    ])
  })

  it("does not mutate input rows", () => {
    const rows: AnalyticsRow[] = [
      { region: "UK", amount: 100 },
      { region: "EU", amount: 250 },
    ]
    const before = rows.map((row) => ({ ...row }))

    executeAnalyticsQuery(rows, {
      dimensions: [{ field: "region" }],
      measures: [{ field: "amount", op: "sum", as: "totalAmount" }],
      sort: [{ field: "totalAmount", direction: "desc" }],
      limit: 1,
    })

    expect(rows).toEqual(before)
  })
})
