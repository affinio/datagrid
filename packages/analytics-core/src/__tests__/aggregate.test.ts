import { describe, expect, it } from "vitest"
import { aggregateRows } from "../index"
import type { AnalyticsRow } from "../index"

describe("aggregateRows", () => {
  it("returns no groups for empty input", () => {
    expect(aggregateRows([], {
      measures: [{ op: "count" }],
    })).toEqual([])
  })

  it("aggregates all rows into one group without dimensions", () => {
    expect(aggregateRows([
      { amount: 100 },
      { amount: 200 },
      { amount: "ignored" },
    ], {
      measures: [
        { op: "count" },
        { field: "amount", op: "sum" },
        { field: "amount", op: "avg" },
        { field: "amount", op: "min" },
        { field: "amount", op: "max" },
      ],
    })).toEqual([
      {
        count: 3,
        sum_amount: 300,
        avg_amount: 150,
        min_amount: 100,
        max_amount: 200,
      },
    ])
  })

  it("groups by a dimension and supports measure aliases", () => {
    expect(aggregateRows([
      { region: "UK", amount: 100 },
      { region: "UK", amount: 200 },
      { region: "EU", amount: 250 },
    ], {
      dimensions: [{ field: "region" }],
      measures: [
        { op: "count", as: "count" },
        { field: "amount", op: "sum", as: "totalAmount" },
      ],
    })).toEqual([
      { region: "UK", count: 2, totalAmount: 300 },
      { region: "EU", count: 1, totalAmount: 250 },
    ])
  })

  it("groups by multiple dimensions in first group appearance order", () => {
    expect(aggregateRows([
      { region: "UK", status: "open", amount: 100 },
      { region: "UK", status: "closed", amount: 200 },
      { region: "UK", status: "open", amount: 50 },
    ], {
      dimensions: [
        { field: "region" },
        { field: "status" },
      ],
      measures: [{ op: "count" }],
    })).toEqual([
      { region: "UK", status: "open", count: 2 },
      { region: "UK", status: "closed", count: 1 },
    ])
  })

  it("uses aliases for dimension output names", () => {
    expect(aggregateRows([
      { region: "UK", amount: 100 },
    ], {
      dimensions: [{ field: "region", as: "market" }],
      measures: [{ field: "amount", op: "sum", as: "revenue" }],
    })).toEqual([
      { market: "UK", revenue: 100 },
    ])
  })

  it("returns null for numeric aggregations with no numeric values", () => {
    expect(aggregateRows([
      { region: "UK", amount: "100" },
      { region: "UK", amount: null },
    ], {
      dimensions: [{ field: "region" }],
      measures: [
        { field: "amount", op: "sum" },
        { field: "amount", op: "avg" },
        { field: "amount", op: "min" },
        { field: "amount", op: "max" },
      ],
    })).toEqual([
      {
        region: "UK",
        sum_amount: null,
        avg_amount: null,
        min_amount: null,
        max_amount: null,
      },
    ])
  })

  it("does not mutate input rows", () => {
    const rows: AnalyticsRow[] = [
      { region: "UK", amount: 100 },
      { region: "EU", amount: 200 },
    ]
    const before = rows.map((row) => ({ ...row }))

    aggregateRows(rows, {
      dimensions: [{ field: "region" }],
      measures: [{ field: "amount", op: "sum" }],
    })

    expect(rows).toEqual(before)
  })

  it("does not collide dimension values with different primitive types", () => {
    expect(aggregateRows([
      { value: "1", amount: 10 },
      { value: 1, amount: 20 },
      { value: null, amount: 30 },
      { value: undefined, amount: 40 },
    ], {
      dimensions: [{ field: "value" }],
      measures: [{ field: "amount", op: "sum" }],
    })).toEqual([
      { value: "1", sum_amount: 10 },
      { value: 1, sum_amount: 20 },
      { value: null, sum_amount: 30 },
      { value: undefined, sum_amount: 40 },
    ])
  })
})
