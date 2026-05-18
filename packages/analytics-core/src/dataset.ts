import { executeAnalyticsQuery } from "./query"
import { inferAnalyticsSchema } from "./schema"
import type {
  AnalyticsDataset,
  AnalyticsQuery,
  AnalyticsRow,
  CreateAnalyticsDatasetOptions,
} from "./types"

export function createAnalyticsDataset(
  rows: AnalyticsRow[],
  query: AnalyticsQuery,
  options?: CreateAnalyticsDatasetOptions,
): AnalyticsDataset {
  const resultRows = executeAnalyticsQuery(rows, query)
  const schema = inferAnalyticsSchema(resultRows)
  const meta: AnalyticsDataset["meta"] = {
    rowCount: resultRows.length,
    sourceRowCount: rows.length,
  }

  if (options?.generatedAt !== undefined) {
    meta.generatedAt = options.generatedAt
  }

  return {
    rows: resultRows,
    fields: schema.fields,
    meta,
  }
}
