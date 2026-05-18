import { describe, expect, it } from "vitest"
import {
  aggregateRows,
  applyAnalyticsFilters,
} from "../index"
import type {
  AnalyticsFilter,
  AnalyticsRow,
} from "../index"

describe("applyAnalyticsFilters", () => {
  it("returns the original rows array when filters are omitted or empty", () => {
    const rows: AnalyticsRow[] = [{ region: "UK" }]

    expect(applyAnalyticsFilters(rows)).toBe(rows)
    expect(applyAnalyticsFilters(rows, [])).toBe(rows)
  })

  it("filters with equals and notEquals", () => {
    const rows: AnalyticsRow[] = [
      { region: "UK", value: Number.NaN },
      { region: "EU", value: 1 },
    ]

    expect(applyAnalyticsFilters(rows, [
      { field: "region", op: "equals", value: "UK" },
    ])).toEqual([
      { region: "UK", value: Number.NaN },
    ])

    expect(applyAnalyticsFilters(rows, [
      { field: "region", op: "notEquals", value: "UK" },
    ])).toEqual([
      { region: "EU", value: 1 },
    ])

    expect(applyAnalyticsFilters(rows, [
      { field: "value", op: "equals", value: Number.NaN },
    ])).toEqual([
      { region: "UK", value: Number.NaN },
    ])
  })

  it("filters string values with contains, startsWith, and endsWith", () => {
    const rows: AnalyticsRow[] = [
      { name: "Northwest" },
      { name: "Northeast" },
      { name: "Southwest" },
      { name: 123 },
    ]

    expect(applyAnalyticsFilters(rows, [
      { field: "name", op: "contains", value: "west" },
    ])).toEqual([
      { name: "Northwest" },
      { name: "Southwest" },
    ])

    expect(applyAnalyticsFilters(rows, [
      { field: "name", op: "startsWith", value: "North" },
    ])).toEqual([
      { name: "Northwest" },
      { name: "Northeast" },
    ])

    expect(applyAnalyticsFilters(rows, [
      { field: "name", op: "endsWith", value: "east" },
    ])).toEqual([
      { name: "Northeast" },
    ])
  })

  it("filters number values with gt, gte, lt, and lte", () => {
    const rows: AnalyticsRow[] = [
      { amount: 50 },
      { amount: 100 },
      { amount: 150 },
      { amount: "200" },
    ]

    expect(applyAnalyticsFilters(rows, [
      { field: "amount", op: "gt", value: 100 },
    ])).toEqual([
      { amount: 150 },
    ])

    expect(applyAnalyticsFilters(rows, [
      { field: "amount", op: "gte", value: 100 },
    ])).toEqual([
      { amount: 100 },
      { amount: 150 },
    ])

    expect(applyAnalyticsFilters(rows, [
      { field: "amount", op: "lt", value: 100 },
    ])).toEqual([
      { amount: 50 },
    ])

    expect(applyAnalyticsFilters(rows, [
      { field: "amount", op: "lte", value: 100 },
    ])).toEqual([
      { amount: 50 },
      { amount: 100 },
    ])
  })

  it("filters with in and notIn", () => {
    const rows: AnalyticsRow[] = [
      { region: "UK" },
      { region: "EU" },
      { region: "US" },
    ]

    expect(applyAnalyticsFilters(rows, [
      { field: "region", op: "in", value: ["UK", "EU"] },
    ])).toEqual([
      { region: "UK" },
      { region: "EU" },
    ])

    expect(applyAnalyticsFilters(rows, [
      { field: "region", op: "notIn", value: ["UK", "EU"] },
    ])).toEqual([
      { region: "US" },
    ])
  })

  it("filters with isEmpty and isNotEmpty", () => {
    const rows: AnalyticsRow[] = [
      { value: null },
      { value: undefined },
      { value: "" },
      { value: "ready" },
      { value: 0 },
    ]

    expect(applyAnalyticsFilters(rows, [
      { field: "value", op: "isEmpty" },
    ])).toEqual([
      { value: null },
      { value: undefined },
      { value: "" },
    ])

    expect(applyAnalyticsFilters(rows, [
      { field: "value", op: "isNotEmpty" },
    ])).toEqual([
      { value: "ready" },
      { value: 0 },
    ])
  })

  it("applies multiple filters with AND semantics", () => {
    const rows: AnalyticsRow[] = [
      { region: "UK", amount: 100 },
      { region: "UK", amount: 200 },
      { region: "EU", amount: 250 },
    ]
    const filters: AnalyticsFilter[] = [
      { field: "region", op: "equals", value: "UK" },
      { field: "amount", op: "gt", value: 150 },
    ]

    expect(applyAnalyticsFilters(rows, filters)).toEqual([
      { region: "UK", amount: 200 },
    ])
  })

  it("does not mutate input rows", () => {
    const rows: AnalyticsRow[] = [
      { region: "UK", amount: 100 },
      { region: "EU", amount: 200 },
    ]
    const before = rows.map((row) => ({ ...row }))

    applyAnalyticsFilters(rows, [
      { field: "region", op: "equals", value: "UK" },
    ])

    expect(rows).toEqual(before)
  })

  it("filters rows before aggregation", () => {
    expect(aggregateRows([
      { region: "UK", amount: 100 },
      { region: "UK", amount: 200 },
      { region: "EU", amount: 250 },
    ], {
      filters: [{ field: "region", op: "equals", value: "UK" }],
      dimensions: [{ field: "region" }],
      measures: [
        { op: "count" },
        { field: "amount", op: "sum", as: "totalAmount" },
      ],
    })).toEqual([
      { region: "UK", count: 2, totalAmount: 300 },
    ])
  })

  it("returns no aggregate rows when filters remove all rows", () => {
    expect(aggregateRows([
      { region: "UK", amount: 100 },
    ], {
      filters: [{ field: "region", op: "equals", value: "EU" }],
      measures: [{ op: "count" }],
    })).toEqual([])
  })
})
