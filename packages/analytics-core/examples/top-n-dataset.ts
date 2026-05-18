import { createAnalyticsDataset } from "@affino/analytics-core"

const rows = [
  { region: "UK", amount: 100, status: "active" },
  { region: "UK", amount: 200, status: "active" },
  { region: "EU", amount: 250, status: "inactive" },
  { region: "US", amount: 400, status: "active" },
]

export const dataset = createAnalyticsDataset(rows, {
  filters: [{ field: "status", op: "equals", value: "active" }],
  dimensions: [{ field: "region", as: "market" }],
  measures: [
    { op: "count", as: "count" },
    { field: "amount", op: "sum", as: "totalAmount" },
  ],
  sort: [{ field: "totalAmount", direction: "desc" }],
  limit: 2,
}, {
  generatedAt: "2026-05-18T00:00:00.000Z",
})
