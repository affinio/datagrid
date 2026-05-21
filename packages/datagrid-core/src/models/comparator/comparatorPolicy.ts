import type {
  DataGridComparatorPolicy,
  DataGridRowNode,
  DataGridSortState,
} from "../rowModel.js"

export interface DataGridComparatorContext<T = unknown> {
  descriptor?: DataGridSortState
  leftRow?: DataGridRowNode<T>
  rightRow?: DataGridRowNode<T>
}

export type DataGridComparator<T = unknown> = (
  left: unknown,
  right: unknown,
  context: DataGridComparatorContext<T>,
) => number

export interface DataGridComparatorDefinition<T = unknown> {
  id: string
  compare: DataGridComparator<T>
}

export interface DataGridComparatorRegistry<T = unknown> {
  resolve(id: string): DataGridComparator<T> | undefined
}

export type DataGridComparatorRegistryInput<T = unknown> =
  | DataGridComparatorRegistry<T>
  | ReadonlyMap<string, DataGridComparator<T>>
  | Readonly<Record<string, DataGridComparator<T>>>
  | readonly DataGridComparatorDefinition<T>[]

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

function normalizeComparatorId(id: unknown): string {
  return typeof id === "string" ? id.trim() : ""
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

export function createDataGridComparatorRegistry<T = unknown>(
  input?: DataGridComparatorRegistryInput<T> | null,
): DataGridComparatorRegistry<T> | undefined {
  if (!input) {
    return undefined
  }
  if (typeof (input as DataGridComparatorRegistry<T>).resolve === "function") {
    return input as DataGridComparatorRegistry<T>
  }
  const comparators = new Map<string, DataGridComparator<T>>()
  const addComparator = (id: unknown, compare: unknown): void => {
    const normalizedId = normalizeComparatorId(id)
    if (!normalizedId || typeof compare !== "function") {
      throw new Error("Invalid DataGrid comparator registry entry")
    }
    if (comparators.has(normalizedId)) {
      throw new Error(`Duplicate DataGrid comparator id: ${normalizedId}`)
    }
    comparators.set(normalizedId, compare as DataGridComparator<T>)
  }
  if (input instanceof Map) {
    for (const [id, compare] of input.entries()) {
      addComparator(id, compare)
    }
  } else if (Array.isArray(input)) {
    for (const definition of input) {
      addComparator(definition?.id, definition?.compare)
    }
  } else {
    for (const [id, compare] of Object.entries(input)) {
      addComparator(id, compare)
    }
  }
  return {
    resolve(id: string): DataGridComparator<T> | undefined {
      return comparators.get(normalizeComparatorId(id))
    },
  }
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
