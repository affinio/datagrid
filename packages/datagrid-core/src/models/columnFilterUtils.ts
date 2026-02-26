import type { DataGridColumnPredicateFilter } from "./rowModel.js"

function normalizeText(value: unknown): string {
  if (value == null) {
    return ""
  }
  return String(value)
}

function stableSerializeUnknown(value: unknown): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerializeUnknown).join(",")}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableSerializeUnknown(nested)}`)
  return `{${entries.join(",")}}`
}

export function serializeColumnValueToToken(value: unknown): string {
  if (value == null) {
    return "null"
  }
  if (value instanceof Date) {
    return `date:${value.toISOString()}`
  }
  const kind = typeof value
  if (kind === "number" || kind === "string" || kind === "boolean" || kind === "bigint" || kind === "undefined") {
    return `${kind}:${String(value)}`
  }
  try {
    return `json:${stableSerializeUnknown(value)}`
  } catch {
    return `repr:${String(value)}`
  }
}

function toComparableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (value instanceof Date) {
    return value.getTime()
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function evaluateColumnPredicateFilter(
  filter: DataGridColumnPredicateFilter,
  candidate: unknown,
): boolean {
  const operator = filter.operator
  const caseSensitive = filter.caseSensitive === true
  const normalizeForTextCompare = (value: unknown) => {
    const text = normalizeText(value)
    return caseSensitive ? text : text.toLowerCase()
  }

  if (operator === "isEmpty") {
    return normalizeText(candidate).trim().length === 0
  }
  if (operator === "notEmpty") {
    return normalizeText(candidate).trim().length > 0
  }
  if (operator === "isNull") {
    return candidate == null
  }
  if (operator === "notNull") {
    return candidate != null
  }

  if (operator === "contains") {
    const haystack = normalizeForTextCompare(candidate)
    const needle = normalizeForTextCompare(filter.value)
    return needle.length > 0 && haystack.includes(needle)
  }
  if (operator === "startsWith") {
    const haystack = normalizeForTextCompare(candidate)
    const needle = normalizeForTextCompare(filter.value)
    return needle.length > 0 && haystack.startsWith(needle)
  }
  if (operator === "endsWith") {
    const haystack = normalizeForTextCompare(candidate)
    const needle = normalizeForTextCompare(filter.value)
    return needle.length > 0 && haystack.endsWith(needle)
  }
  if (operator === "equals") {
    return normalizeForTextCompare(candidate) === normalizeForTextCompare(filter.value)
  }
  if (operator === "notEquals") {
    return normalizeForTextCompare(candidate) !== normalizeForTextCompare(filter.value)
  }

  const left = toComparableNumber(candidate)
  const right = toComparableNumber(filter.value)
  if (left == null || right == null) {
    return false
  }
  if (operator === "gt") {
    return left > right
  }
  if (operator === "gte") {
    return left >= right
  }
  if (operator === "lt") {
    return left < right
  }
  if (operator === "lte") {
    return left <= right
  }
  if (operator === "between") {
    const right2 = toComparableNumber(filter.value2)
    if (right2 == null) {
      return false
    }
    const lower = Math.min(right, right2)
    const upper = Math.max(right, right2)
    return left >= lower && left <= upper
  }
  return false
}
