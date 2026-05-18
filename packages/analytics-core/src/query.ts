import { aggregateRows } from "./aggregate"
import type {
  AnalyticsQuery,
  AnalyticsRow,
  AnalyticsSort,
} from "./types"

export function executeAnalyticsQuery(
  rows: AnalyticsRow[],
  query: AnalyticsQuery,
): AnalyticsRow[] {
  if (query.limit !== undefined && query.limit <= 0) {
    return []
  }

  const aggregatedRows = aggregateRows(rows, query)
  const sortedRows = sortRows(aggregatedRows, query.sort)

  if (query.limit === undefined) {
    return sortedRows
  }

  return sortedRows.slice(0, query.limit)
}

function sortRows(rows: AnalyticsRow[], sort?: AnalyticsSort[]): AnalyticsRow[] {
  if (sort === undefined || sort.length === 0) {
    return rows
  }

  return [...rows].sort((left, right) => compareRows(left, right, sort))
}

function compareRows(left: AnalyticsRow, right: AnalyticsRow, sort: AnalyticsSort[]): number {
  for (const sortEntry of sort) {
    const direction = sortEntry.direction ?? "asc"
    const comparison = compareValues(left[sortEntry.field], right[sortEntry.field])

    if (comparison !== 0) {
      return direction === "desc" && !isNullishSortPair(left[sortEntry.field], right[sortEntry.field])
        ? -comparison
        : comparison
    }
  }

  return 0
}

function isNullishSortPair(left: unknown, right: unknown): boolean {
  return left === null || left === undefined || right === null || right === undefined
}

function compareValues(left: unknown, right: unknown): number {
  const leftEmpty = left === null || left === undefined
  const rightEmpty = right === null || right === undefined

  if (leftEmpty || rightEmpty) {
    if (leftEmpty && rightEmpty) {
      return 0
    }
    return leftEmpty ? 1 : -1
  }

  const leftComparable = toComparableValue(left)
  const rightComparable = toComparableValue(right)

  if (leftComparable.kind === rightComparable.kind) {
    return compareComparableValues(leftComparable.value, rightComparable.value)
  }

  return compareComparableValues(
    String(leftComparable.value),
    String(rightComparable.value),
  )
}

function toComparableValue(value: unknown): { kind: string; value: number | string } {
  if (typeof value === "number") {
    return {
      kind: "number",
      value: Number.isNaN(value) ? "NaN" : value,
    }
  }

  if (typeof value === "string") {
    return {
      kind: "string",
      value,
    }
  }

  if (typeof value === "boolean") {
    return {
      kind: "boolean",
      value: value ? 1 : 0,
    }
  }

  if (value instanceof Date) {
    return {
      kind: "date",
      value: value.getTime(),
    }
  }

  return {
    kind: "fallback",
    value: String(value),
  }
}

function compareComparableValues(left: number | string, right: number | string): number {
  if (typeof left === "number" && typeof right === "number") {
    return left - right
  }

  return String(left).localeCompare(String(right))
}
