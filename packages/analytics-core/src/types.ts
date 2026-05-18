export type AnalyticsRow = Record<string, unknown>

export type AnalyticsFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "unknown"

export interface AnalyticsField {
  id: string
  label?: string
  type: AnalyticsFieldType
}

export interface AnalyticsSchema {
  fields: AnalyticsField[]
}

export interface AnalyticsDataset {
  rows: AnalyticsRow[]
  fields: AnalyticsField[]
  meta: {
    rowCount: number
    sourceRowCount: number
    generatedAt?: string
  }
}

export interface CreateAnalyticsDatasetOptions {
  generatedAt?: string
}

export type AggregationOp =
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"

export interface AnalyticsDimension {
  field: string
  as?: string
}

export interface AnalyticsMeasure {
  field?: string
  op: AggregationOp
  as?: string
}

export type AnalyticsFilterOp =
  | "equals"
  | "notEquals"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "notIn"
  | "isEmpty"
  | "isNotEmpty"

export interface AnalyticsFilter {
  field: string
  op: AnalyticsFilterOp
  value?: unknown
}

export interface AnalyticsSort {
  field: string
  direction?: "asc" | "desc"
}

export interface AnalyticsQuery {
  dimensions?: AnalyticsDimension[]
  filters?: AnalyticsFilter[]
  limit?: number
  measures?: AnalyticsMeasure[]
  sort?: AnalyticsSort[]
}
