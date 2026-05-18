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

export interface AnalyticsQuery {
  dimensions?: AnalyticsDimension[]
  measures?: AnalyticsMeasure[]
}
