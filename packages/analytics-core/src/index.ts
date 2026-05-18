export type {
  AggregationOp,
  AnalyticsDimension,
  AnalyticsField,
  AnalyticsFieldType,
  AnalyticsMeasure,
  AnalyticsQuery,
  AnalyticsRow,
  AnalyticsSchema,
} from "./types"
export { aggregateRows } from "./aggregate"
export { inferAnalyticsSchema } from "./schema"

export function createAnalyticsCore(): { version: string } {
  return {
    version: "0.1.0",
  }
}
