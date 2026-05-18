export type {
  AggregationOp,
  AnalyticsDataset,
  AnalyticsDimension,
  AnalyticsFilter,
  AnalyticsFilterOp,
  AnalyticsField,
  AnalyticsFieldType,
  AnalyticsMeasure,
  AnalyticsQuery,
  AnalyticsRow,
  AnalyticsSchema,
  AnalyticsSort,
  CreateAnalyticsDatasetOptions,
} from "./types"
export { aggregateRows } from "./aggregate"
export { applyAnalyticsFilters } from "./filter"
export { createAnalyticsDataset } from "./dataset"
export { executeAnalyticsQuery } from "./query"
export { inferAnalyticsSchema } from "./schema"

export function createAnalyticsCore(): { version: string } {
  return {
    version: "0.1.0",
  }
}
