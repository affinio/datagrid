import type {
  AggregationOp,
  AnalyticsMeasure,
  AnalyticsQuery,
  AnalyticsRow,
} from "./types"
import { applyAnalyticsFilters } from "./filter"

interface MeasureState {
  count: number
  numericCount: number
  sum: number
  min: number | null
  max: number | null
}

interface GroupState {
  dimensions: AnalyticsRow
  measures: MeasureState[]
}

export function aggregateRows(rows: AnalyticsRow[], query: AnalyticsQuery): AnalyticsRow[] {
  const filteredRows = applyAnalyticsFilters(rows, query.filters)

  if (filteredRows.length === 0) {
    return []
  }

  const dimensions = query.dimensions ?? []
  const measures = query.measures ?? []
  const groups = new Map<string, GroupState>()

  for (const row of filteredRows) {
    const groupKey = createGroupKey(row, dimensions.map((dimension) => dimension.field))
    let group = groups.get(groupKey)

    if (group === undefined) {
      group = {
        dimensions: Object.fromEntries(
          dimensions.map((dimension) => [
            dimension.as ?? dimension.field,
            row[dimension.field],
          ]),
        ),
        measures: measures.map(createMeasureState),
      }
      groups.set(groupKey, group)
    }

    for (let index = 0; index < measures.length; index += 1) {
      applyMeasure(group.measures[index]!, measures[index]!, row)
    }
  }

  return Array.from(groups.values(), (group) => ({
    ...group.dimensions,
    ...Object.fromEntries(
      measures.map((measure, index) => [
        getMeasureOutputName(measure),
        resolveMeasureValue(measure.op, group.measures[index]!),
      ]),
    ),
  }))
}

function createMeasureState(): MeasureState {
  return {
    count: 0,
    numericCount: 0,
    sum: 0,
    min: null,
    max: null,
  }
}

function applyMeasure(state: MeasureState, measure: AnalyticsMeasure, row: AnalyticsRow): void {
  state.count += 1

  if (measure.op === "count" || measure.field === undefined) {
    return
  }

  const value = row[measure.field]
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return
  }

  state.numericCount += 1
  state.sum += value
  state.min = state.min === null ? value : Math.min(state.min, value)
  state.max = state.max === null ? value : Math.max(state.max, value)
}

function resolveMeasureValue(op: AggregationOp, state: MeasureState): number | null {
  switch (op) {
    case "count":
      return state.count
    case "sum":
      return state.numericCount === 0 ? null : state.sum
    case "avg":
      return state.numericCount === 0 ? null : state.sum / state.numericCount
    case "min":
      return state.min
    case "max":
      return state.max
  }
}

function getMeasureOutputName(measure: AnalyticsMeasure): string {
  if (measure.as !== undefined) {
    return measure.as
  }

  if (measure.op === "count") {
    return "count"
  }

  return measure.field === undefined ? measure.op : `${measure.op}_${measure.field}`
}

function createGroupKey(row: AnalyticsRow, fields: string[]): string {
  return JSON.stringify(fields.map((field) => encodeGroupValue(row[field])))
}

function encodeGroupValue(value: unknown): unknown {
  if (value === null) {
    return ["null"]
  }

  if (value === undefined) {
    return ["undefined"]
  }

  if (value instanceof Date) {
    return ["datetime", value.toISOString()]
  }

  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return ["number", "NaN"]
    }
    if (value === Infinity) {
      return ["number", "Infinity"]
    }
    if (value === -Infinity) {
      return ["number", "-Infinity"]
    }
  }

  return [typeof value, value]
}
