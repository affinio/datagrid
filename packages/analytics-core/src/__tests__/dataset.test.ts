import { describe, expect, it } from "vitest"
import {
  createAnalyticsDataset,
  executeAnalyticsQuery,
} from "../index"
import type {
  AnalyticsDataset,
  AnalyticsRow,
  CreateAnalyticsDatasetOptions,
} from "../index"

describe("createAnalyticsDataset", () => {
  it("creates a chart-ready dataset from grouped query results", () => {
    const rows: AnalyticsRow[] = [
      { region: "UK", amount: 100, status: "active" },
      { region: "UK", amount: 200, status: "active" },
      { region: "EU", amount: 250, status: "inactive" },
    ]
    const options: CreateAnalyticsDatasetOptions = {
      generatedAt: "2026-05-18T00:00:00.000Z",
    }

    const dataset: AnalyticsDataset = createAnalyticsDataset(rows, {
      filters: [{ field: "status", op: "equals", value: "active" }],
      dimensions: [{ field: "region" }],
      measures: [
        { op: "count", as: "count" },
        { field: "amount", op: "sum", as: "totalAmount" },
      ],
      sort: [{ field: "totalAmount", direction: "desc" }],
      limit: 10,
    }, options)

    expect(dataset).toEqual({
      rows: [
        { region: "UK", count: 2, totalAmount: 300 },
      ],
      fields: [
        { id: "region", type: "string" },
        { id: "count", type: "number" },
        { id: "totalAmount", type: "number" },
      ],
      meta: {
        rowCount: 1,
        sourceRowCount: 3,
        generatedAt: "2026-05-18T00:00:00.000Z",
      },
    })
  })

  it("omits generatedAt by default", () => {
    const dataset = createAnalyticsDataset([
      { region: "UK", amount: 100 },
    ], {
      dimensions: [{ field: "region" }],
      measures: [{ field: "amount", op: "sum", as: "totalAmount" }],
    })

    expect(dataset.meta).toEqual({
      rowCount: 1,
      sourceRowCount: 1,
    })
    expect("generatedAt" in dataset.meta).toBe(false)
  })

  it("returns empty fields and rows for empty results", () => {
    expect(createAnalyticsDataset([
      { region: "UK", amount: 100 },
      { region: "EU", amount: 200 },
    ], {
      filters: [{ field: "region", op: "equals", value: "US" }],
      dimensions: [{ field: "region" }],
      measures: [{ op: "count" }],
    })).toEqual({
      rows: [],
      fields: [],
      meta: {
        rowCount: 0,
        sourceRowCount: 2,
      },
    })
  })

  it("uses executeAnalyticsQuery output rows", () => {
    const rows: AnalyticsRow[] = [
      { region: "UK", amount: 100 },
      { region: "EU", amount: 250 },
      { region: "UK", amount: 200 },
    ]
    const query = {
      dimensions: [{ field: "region", as: "market" }],
      measures: [{ field: "amount", op: "sum" as const, as: "totalAmount" }],
      sort: [{ field: "totalAmount", direction: "desc" as const }],
      limit: 1,
    }

    expect(createAnalyticsDataset(rows, query).rows).toEqual(
      executeAnalyticsQuery(rows, query),
    )
  })

  it("infers fields from dimension and measure aliases", () => {
    const dataset = createAnalyticsDataset([
      { region: "UK", amount: 100 },
    ], {
      dimensions: [{ field: "region", as: "market" }],
      measures: [{ field: "amount", op: "sum", as: "totalAmount" }],
    })

    expect(dataset.fields).toEqual([
      { id: "market", type: "string" },
      { id: "totalAmount", type: "number" },
    ])
  })

  it("does not mutate input rows", () => {
    const rows: AnalyticsRow[] = [
      { region: "UK", amount: 100, status: "active" },
      { region: "EU", amount: 200, status: "inactive" },
    ]
    const before = rows.map((row) => ({ ...row }))

    createAnalyticsDataset(rows, {
      filters: [{ field: "status", op: "equals", value: "active" }],
      dimensions: [{ field: "region" }],
      measures: [{ field: "amount", op: "sum", as: "totalAmount" }],
      sort: [{ field: "totalAmount", direction: "desc" }],
      limit: 1,
    })

    expect(rows).toEqual(before)
  })
})
