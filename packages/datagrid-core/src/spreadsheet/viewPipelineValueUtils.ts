function normalizeTextComparisonValue(value: unknown, caseSensitive = false): string {
  const normalized = String(value ?? "")
  return caseSensitive ? normalized : normalized.toLowerCase()
}

function normalizeOrderedValue(value: unknown): number | string | boolean | null {
  if (value == null) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime()
  if (typeof value === "boolean") return value
  if (typeof value === "bigint") return Number(value)
  const text = String(value).trim()
  if (text.length === 0) return ""
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
    const numericValue = Number(text)
    if (Number.isFinite(numericValue)) return numericValue
  }
  return text.toLowerCase()
}

export function compareSpreadsheetViewValues(left: unknown, right: unknown): number {
  const normalizedLeft = normalizeOrderedValue(left)
  const normalizedRight = normalizeOrderedValue(right)
  if (normalizedLeft == null && normalizedRight == null) return 0
  if (normalizedLeft == null) return 1
  if (normalizedRight == null) return -1
  if (typeof normalizedLeft === "number" && typeof normalizedRight === "number") {
    return normalizedLeft - normalizedRight
  }
  if (typeof normalizedLeft === "boolean" && typeof normalizedRight === "boolean") {
    return Number(normalizedLeft) - Number(normalizedRight)
  }
  return String(normalizedLeft).localeCompare(String(normalizedRight))
}

export function isSpreadsheetViewValueEmpty(value: unknown): boolean {
  return value == null || String(value).trim().length === 0
}

export function areSpreadsheetViewValuesEquivalent(
  left: unknown,
  right: unknown,
  caseSensitive = false,
): boolean {
  if (left == null || right == null) return left == null && right == null
  if (compareSpreadsheetViewValues(left, right) === 0) return true
  return normalizeTextComparisonValue(left, caseSensitive) === normalizeTextComparisonValue(right, caseSensitive)
}

export function coerceSpreadsheetViewNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "bigint") return Number(value)
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime()
  const text = String(value ?? "").trim()
  if (text.length === 0) return null
  const numericValue = Number(text)
  return Number.isFinite(numericValue) ? numericValue : null
}

export function normalizeSpreadsheetViewText(value: unknown, caseSensitive = false): string {
  return normalizeTextComparisonValue(value, caseSensitive)
}

export function normalizeSpreadsheetViewOutputValue(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value.startsWith("=") ? `=${JSON.stringify(value)}` : value
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value)
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString()
  return String(value)
}

export function cloneSpreadsheetViewValues(source: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return { ...source }
}

export function spreadsheetViewValuesEqual(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  for (const key of leftKeys) {
    if (!Object.is(left[key], right[key])) return false
  }
  return true
}

export function createSpreadsheetViewJoinLookupKey(value: unknown): string {
  if (value == null) return "null:"
  if (value instanceof Date) return `date:${Number.isNaN(value.getTime()) ? "" : value.toISOString()}`
  switch (typeof value) {
    case "string": return `string:${value}`
    case "number": return `number:${Number.isFinite(value) ? value : ""}`
    case "boolean": return `boolean:${value ? "1" : "0"}`
    case "bigint": return `bigint:${String(value)}`
    default: return `other:${String(value)}`
  }
}

export function createSpreadsheetViewExplodedRowId(
  leftRowId: DataGridRowId,
  rightRowId: DataGridRowId | null,
  matchIndex: number,
): string {
  const encodedLeft = String(leftRowId)
  const encodedRight = rightRowId == null ? "null" : String(rightRowId)
  return `join:${encodedLeft.length}:${encodedLeft}|${encodedRight.length}:${encodedRight}|${matchIndex}`
}
import type { DataGridAggOp, DataGridRowId } from "../models/rowModel.js"

const NUMERIC_AGGREGATIONS = new Set<Exclude<DataGridAggOp, "custom">>([
  "sum",
  "avg",
  "count",
  "countNonNull",
  "min",
  "max",
])

export function isNumericSpreadsheetViewAggregation(aggregation: DataGridAggOp): boolean {
  return aggregation !== "custom" && NUMERIC_AGGREGATIONS.has(aggregation)
}
