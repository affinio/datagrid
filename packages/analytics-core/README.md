# @affino/analytics-core

Headless analytics data pipeline utilities for plain TypeScript rows. The package has no UI, rendering, Vue, React, DOM, Canvas, SVG, or chart dependencies.

Current pipeline:

```text
rows -> filters -> aggregation -> sort/limit -> dataset
```

Use it to prepare chart-ready, map-ready, KPI, or DataGrid-derived result rows without coupling the analytics model to any rendering layer.

## Schema Inference

```ts
import { inferAnalyticsSchema } from "@affino/analytics-core"

const schema = inferAnalyticsSchema([
  { region: "UK", amount: 100, active: true },
  { region: "EU", amount: 250, active: false },
])

// {
//   fields: [
//     { id: "region", type: "string" },
//     { id: "amount", type: "number" },
//     { id: "active", type: "boolean" },
//   ],
// }
```

## Grouped Aggregation

```ts
import { aggregateRows } from "@affino/analytics-core"

const rows = aggregateRows([
  { region: "UK", amount: 100 },
  { region: "UK", amount: 200 },
  { region: "EU", amount: 250 },
], {
  dimensions: [{ field: "region" }],
  measures: [
    { op: "count", as: "count" },
    { field: "amount", op: "sum", as: "totalAmount" },
  ],
})

// [
//   { region: "UK", count: 2, totalAmount: 300 },
//   { region: "EU", count: 1, totalAmount: 250 },
// ]
```

## Filtered Top-N Dataset

```ts
import { createAnalyticsDataset } from "@affino/analytics-core"

const dataset = createAnalyticsDataset([
  { region: "UK", amount: 100, status: "active" },
  { region: "UK", amount: 200, status: "active" },
  { region: "EU", amount: 250, status: "inactive" },
], {
  filters: [{ field: "status", op: "equals", value: "active" }],
  dimensions: [{ field: "region" }],
  measures: [
    { op: "count", as: "count" },
    { field: "amount", op: "sum", as: "totalAmount" },
  ],
  sort: [{ field: "totalAmount", direction: "desc" }],
  limit: 10,
}, {
  generatedAt: "2026-05-18T00:00:00.000Z",
})

// {
//   rows: [{ region: "UK", count: 2, totalAmount: 300 }],
//   fields: [
//     { id: "region", type: "string" },
//     { id: "count", type: "number" },
//     { id: "totalAmount", type: "number" },
//   ],
//   meta: {
//     rowCount: 1,
//     sourceRowCount: 3,
//     generatedAt: "2026-05-18T00:00:00.000Z",
//   },
// }
```

## Behavior Notes

- Filters use AND semantics.
- String filters are string-only: `contains`, `startsWith`, and `endsWith` ignore non-string row values.
- Numeric comparisons are number-only: `gt`, `gte`, `lt`, and `lte` ignore non-number row values.
- Numeric aggregations ignore non-numeric values.
- Numeric aggregations return `null` when no numeric values exist in a group.
- `executeAnalyticsQuery` returns aggregated/query result rows after filtering, sorting, and limiting.
- `createAnalyticsDataset` infers fields from output rows, not source rows.
- `generatedAt` is only included in dataset metadata when provided.

## Non-Goals For v0.1

- No chart rendering.
- No Vue, React, or DOM integration.
- No visual encoding model yet.
- No date or numeric buckets yet.
- No server SQL pushdown.
