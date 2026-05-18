import {
  aggregateRows,
  inferAnalyticsSchema,
} from "@affino/analytics-core"

const rows = [
  { region: "UK", amount: 100 },
  { region: "UK", amount: 200 },
  { region: "EU", amount: 250 },
]

export const schema = inferAnalyticsSchema(rows)

export const resultRows = aggregateRows(rows, {
  dimensions: [{ field: "region" }],
  measures: [
    { op: "count", as: "count" },
    { field: "amount", op: "sum", as: "totalAmount" },
    { field: "amount", op: "avg", as: "averageAmount" },
  ],
})
