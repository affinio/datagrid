import type { DataGridComparatorPolicy } from "../rowModel.js"
import type { DataGridComparatorContext, DataGridComparatorRegistry } from "./comparatorRegistry.js"
export type {
  DataGridComparator,
  DataGridComparatorContext,
  DataGridComparatorDefinition,
  DataGridComparatorRegistry,
  DataGridComparatorRegistryInput,
} from "./comparatorRegistry.js"

const collatorCache = new Map<string, Intl.Collator>()

function normalizeText(value: unknown): string {
  if (value == null) {
    return ""
  }
  return String(value)
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

function resolveCollator(policy: DataGridComparatorPolicy): Intl.Collator {
  const locale = policy.locale
  const options: Intl.CollatorOptions = {
    numeric: policy.kind === "natural" ? true : policy.numeric === true,
    sensitivity: policy.kind === "natural" ? "base" : policy.sensitivity,
    caseFirst: policy.caseFirst,
  }
  const cacheKey = JSON.stringify({ locale, options })
  let collator = collatorCache.get(cacheKey)
  if (!collator) {
    collator = new Intl.Collator(locale as string | string[] | undefined, options)
    collatorCache.set(cacheKey, collator)
  }
  return collator
}

function normalizeComparatorId(id: unknown): string {
  return typeof id === "string" ? id.trim() : ""
}

export function compareDataGridValues<T = unknown>(
  left: unknown,
  right: unknown,
  context: DataGridComparatorContext<T> = {},
  options: { comparatorRegistry?: DataGridComparatorRegistry<T> } = {},
): number {
  const policy = context.descriptor?.comparator
  const nulls = policy?.nulls === "first" ? "first" : "last"
  if (left == null && right == null) {
    return 0
  }
  if (left == null) {
    return nulls === "first" ? -1 : 1
  }
  if (right == null) {
    return nulls === "first" ? 1 : -1
  }

  if (policy?.kind === "custom") {
    const comparatorId = normalizeComparatorId(policy.comparatorId)
    const comparator = comparatorId ? options.comparatorRegistry?.resolve(comparatorId) : undefined
    if (comparator) {
      const compared = comparator(left, right, context)
      if (Number.isFinite(compared)) {
        return compared
      }
    }
  }

  const leftNumber = toComparableNumber(left)
  const rightNumber = toComparableNumber(right)
  if (leftNumber != null && rightNumber != null) {
    return leftNumber - rightNumber
  }

  const leftText = normalizeText(left)
  const rightText = normalizeText(right)
  if (policy?.kind === "locale" || policy?.kind === "natural" || policy?.numeric === true) {
    return resolveCollator(policy).compare(leftText, rightText)
  }
  return leftText.localeCompare(rightText)
}
