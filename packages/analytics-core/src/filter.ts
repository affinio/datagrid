import type {
  AnalyticsFilter,
  AnalyticsRow,
} from "./types"

export function applyAnalyticsFilters(
  rows: AnalyticsRow[],
  filters?: AnalyticsFilter[],
): AnalyticsRow[] {
  if (filters === undefined || filters.length === 0) {
    return rows
  }

  return rows.filter((row) => filters.every((filter) => matchesFilter(row, filter)))
}

function matchesFilter(row: AnalyticsRow, filter: AnalyticsFilter): boolean {
  const value = row[filter.field]

  switch (filter.op) {
    case "equals":
      return isEqualValue(value, filter.value)
    case "notEquals":
      return !isEqualValue(value, filter.value)
    case "contains":
      return isStringMatch(value, filter.value, (source, target) => source.includes(target))
    case "startsWith":
      return isStringMatch(value, filter.value, (source, target) => source.startsWith(target))
    case "endsWith":
      return isStringMatch(value, filter.value, (source, target) => source.endsWith(target))
    case "gt":
      return isNumberMatch(value, filter.value, (source, target) => source > target)
    case "gte":
      return isNumberMatch(value, filter.value, (source, target) => source >= target)
    case "lt":
      return isNumberMatch(value, filter.value, (source, target) => source < target)
    case "lte":
      return isNumberMatch(value, filter.value, (source, target) => source <= target)
    case "in":
      return Array.isArray(filter.value) && filter.value.some((item) => isEqualValue(value, item))
    case "notIn":
      return Array.isArray(filter.value) && !filter.value.some((item) => isEqualValue(value, item))
    case "isEmpty":
      return isEmptyValue(value)
    case "isNotEmpty":
      return !isEmptyValue(value)
  }
}

function isEqualValue(left: unknown, right: unknown): boolean {
  return left === right || (Number.isNaN(left) && Number.isNaN(right))
}

function isStringMatch(
  value: unknown,
  filterValue: unknown,
  predicate: (source: string, target: string) => boolean,
): boolean {
  return typeof value === "string" &&
    typeof filterValue === "string" &&
    predicate(value, filterValue)
}

function isNumberMatch(
  value: unknown,
  filterValue: unknown,
  predicate: (source: number, target: number) => boolean,
): boolean {
  return typeof value === "number" &&
    typeof filterValue === "number" &&
    Number.isFinite(value) &&
    Number.isFinite(filterValue) &&
    predicate(value, filterValue)
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === ""
}
