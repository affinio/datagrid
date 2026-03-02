import type {
  DataGridAdvancedFilter,
  DataGridColumnFilterSnapshotEntry,
  DataGridColumnHistogram,
  DataGridColumnHistogramEntry,
  DataGridColumnHistogramOptions,
  DataGridColumnPredicateFilter,
  DataGridFilterSnapshot,
  DataGridRowNode,
  DataGridSortState,
  DataGridTreeDataResolvedSpec,
} from "./rowModel.js"
import { evaluateDataGridAdvancedFilterExpression } from "./advancedFilter.js"
import {
  evaluateColumnPredicateFilter,
  serializeColumnValueToToken,
} from "./columnFilterUtils.js"
import { resolveAdvancedExpression } from "./rowPatchAnalyzer.js"

function readByPath(value: unknown, path: string): unknown {
  if (!path || typeof value !== "object" || value === null) {
    return undefined
  }
  const segments = path.split(".").filter(Boolean)
  let current: unknown = value
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined
      }
      current = current[index]
      continue
    }
    if (typeof current !== "object" || current === null || !(segment in (current as Record<string, unknown>))) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

export function readRowField<T>(rowNode: DataGridRowNode<T>, key: string, field?: string): unknown {
  const source = rowNode.data as unknown
  const resolvedField = field && field.trim().length > 0 ? field : key
  if (!resolvedField) {
    return undefined
  }
  const directValue = typeof source === "object" && source !== null
    ? (source as Record<string, unknown>)[resolvedField]
    : undefined
  if (typeof directValue !== "undefined") {
    return directValue
  }
  return readByPath(source, resolvedField)
}

export function normalizeText(value: unknown): string {
  if (value == null) {
    return ""
  }
  return String(value)
}

export function normalizeLeafRow<T>(row: DataGridRowNode<T>): DataGridRowNode<T> {
  if (row.kind === "leaf" && row.state.group === false) {
    return row
  }
  return {
    ...row,
    kind: "leaf",
    state: {
      ...row.state,
      group: false,
    },
    groupMeta: undefined,
  }
}

function normalizeColumnFilterEntries(
  columnFilters: Record<string, DataGridColumnFilterSnapshotEntry>,
): Array<{
    key: string
    kind: "valueSet"
    valueTokenSet: Set<string>
  } | {
    key: string
    kind: "predicate"
    predicate: DataGridColumnPredicateFilter
  }> {
  const normalized: Array<{
    key: string
    kind: "valueSet"
    valueTokenSet: Set<string>
  } | {
    key: string
    kind: "predicate"
    predicate: DataGridColumnPredicateFilter
  }> = []
  for (const [rawKey, rawEntry] of Object.entries(columnFilters ?? {})) {
    const key = rawKey.trim()
    if (!key || !rawEntry) {
      continue
    }

    if (rawEntry.kind === "valueSet") {
      const seen = new Set<string>()
      const valueTokens: string[] = []
      for (const rawToken of rawEntry.tokens ?? []) {
        const token = String(rawToken ?? "")
        if (!token || seen.has(token)) {
          continue
        }
        seen.add(token)
        valueTokens.push(token)
      }
      if (valueTokens.length === 0) {
        continue
      }
      normalized.push({ key, kind: "valueSet", valueTokenSet: new Set(valueTokens) })
      continue
    }

    if (rawEntry.kind !== "predicate") {
      continue
    }

    normalized.push({
      key,
      kind: "predicate",
      predicate: {
        kind: "predicate",
        operator: rawEntry.operator,
        value: rawEntry.value,
        value2: rawEntry.value2,
        caseSensitive: rawEntry.caseSensitive,
      },
    })
  }
  return normalized
}

export function createFilterPredicate<T>(
  filterModel: DataGridFilterSnapshot | null,
  options: { ignoreColumnFilterKey?: string } = {},
): (rowNode: DataGridRowNode<T>) => boolean {
  if (!filterModel) {
    return () => true
  }

  const ignoredColumnKey = typeof options.ignoreColumnFilterKey === "string"
    ? options.ignoreColumnFilterKey.trim()
    : ""

  const effectiveFilterModel = (() => {
    if (!ignoredColumnKey) {
      return filterModel
    }
    let changed = false
    const nextColumnFilters: Record<string, DataGridColumnFilterSnapshotEntry> = {}
    for (const [rawKey, values] of Object.entries(filterModel.columnFilters ?? {})) {
      if (rawKey.trim() === ignoredColumnKey) {
        changed = true
        continue
      }
      if (values.kind === "valueSet") {
        nextColumnFilters[rawKey] = { kind: "valueSet", tokens: [...values.tokens] }
        continue
      }
      nextColumnFilters[rawKey] = {
        kind: "predicate",
        operator: values.operator,
        value: values.value,
        value2: values.value2,
        caseSensitive: values.caseSensitive,
      }
    }
    const nextAdvancedFilters: Record<string, DataGridAdvancedFilter> = {}
    for (const [rawKey, advancedFilter] of Object.entries(filterModel.advancedFilters ?? {})) {
      if (rawKey.trim() === ignoredColumnKey) {
        changed = true
        continue
      }
      nextAdvancedFilters[rawKey] = advancedFilter
    }
    if (!changed) {
      return filterModel
    }
    return {
      columnFilters: nextColumnFilters,
      advancedFilters: nextAdvancedFilters,
      advancedExpression: filterModel.advancedExpression ?? null,
    } satisfies DataGridFilterSnapshot
  })()

  const columnFilters = normalizeColumnFilterEntries(
    (effectiveFilterModel.columnFilters ?? {}) as Record<string, DataGridColumnFilterSnapshotEntry>,
  ).map(entry => [entry.key, entry] as const)
  const advancedExpression = resolveAdvancedExpression(effectiveFilterModel)

  return (rowNode: DataGridRowNode<T>) => {
    for (const [key, filterEntry] of columnFilters) {
      const candidate = readRowField(rowNode, key)
      if (filterEntry.kind === "valueSet") {
        const candidateToken = serializeColumnValueToToken(candidate)
        if (!filterEntry.valueTokenSet?.has(candidateToken)) {
          return false
        }
        continue
      }
      if (filterEntry.predicate && !evaluateColumnPredicateFilter(filterEntry.predicate, candidate)) {
        return false
      }
    }

    if (advancedExpression) {
      return evaluateDataGridAdvancedFilterExpression(advancedExpression, condition => {
        return readRowField(rowNode, condition.key, condition.field)
      })
    }

    return true
  }
}

export function hasActiveFilterModel(filterModel: DataGridFilterSnapshot | null): boolean {
  if (!filterModel) {
    return false
  }
  const columnFilters = Object.values(filterModel.columnFilters ?? {})
  if (columnFilters.some(entry => {
    if (entry.kind === "valueSet") {
      return entry.tokens.length > 0
    }
    return true
  })) {
    return true
  }
  const advancedKeys = Object.keys(filterModel.advancedFilters ?? {})
  if (advancedKeys.length > 0) {
    return true
  }
  return resolveAdvancedExpression(filterModel) !== null
}

export function alwaysMatchesFilter<T>(_row: DataGridRowNode<T>): boolean {
  return true
}

export function shouldUseFilteredRowsForTreeSort<T>(
  treeData: DataGridTreeDataResolvedSpec<T> | null,
  filterModel: DataGridFilterSnapshot | null,
): boolean {
  if (!treeData || treeData.mode !== "path" || !hasActiveFilterModel(filterModel)) {
    return false
  }
  return (
    treeData.filterMode === "leaf-only"
    || treeData.filterMode === "include-parents"
    || treeData.filterMode === "include-descendants"
  )
}

export function serializeSortValueModelForCache(
  sortModel: readonly DataGridSortState[],
  options: { includeDirection?: boolean } = {},
): string {
  if (!Array.isArray(sortModel) || sortModel.length === 0) {
    return "__none__"
  }
  const includeDirection = options.includeDirection !== false
  return sortModel
    .map(descriptor => {
      const dependencyFields = Array.isArray(descriptor.dependencyFields)
        ? [...descriptor.dependencyFields].map(value => String(value).trim()).filter(Boolean).sort().join(",")
        : ""
      const direction = includeDirection ? descriptor.direction ?? "asc" : ""
      return `${descriptor.key}:${descriptor.field ?? ""}:${direction}:${dependencyFields}`
    })
    .join("|")
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

export function buildColumnHistogram<T>(
  rows: readonly DataGridRowNode<T>[],
  columnId: string,
  options?: DataGridColumnHistogramOptions,
): DataGridColumnHistogram {
  const key = String(columnId ?? "").trim()
  const entriesByToken = new Map<string, DataGridColumnHistogramEntry>()

  for (const row of rows) {
    const value = readRowField(row, key)
    const token = serializeColumnValueToToken(value)
    const current = entriesByToken.get(token)
    if (current) {
      current.count += 1
      continue
    }
    entriesByToken.set(token, {
      token,
      value,
      text: normalizeText(value),
      count: 1,
    })
  }

  const entries = Array.from(entriesByToken.values())
  if (entries.length === 0) {
    return []
  }

  const orderBy = options?.orderBy ?? "valueAsc"
  if (orderBy === "countDesc") {
    entries.sort((left, right) => right.count - left.count || left.text?.localeCompare(right.text ?? "") || 0)
  } else {
    entries.sort((left, right) => (left.text ?? "").localeCompare(right.text ?? "", undefined, {
      numeric: true,
      sensitivity: "base",
    }))
  }

  const limit = Number.isFinite(options?.limit) ? Math.max(0, Math.trunc(options?.limit as number)) : 0
  if (limit > 0 && entries.length > limit) {
    return entries.slice(0, limit)
  }
  return entries
}

function normalizeFilterValuesForSignature(values: readonly unknown[]): readonly string[] {
  const normalized: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const token = normalizeText(value)
    if (seen.has(token)) {
      continue
    }
    seen.add(token)
    normalized.push(token)
  }
  return normalized.sort((left, right) => left.localeCompare(right))
}

function normalizeColumnFilterEntryForSignature(
  entry: DataGridColumnFilterSnapshotEntry,
): string {
  if (entry.kind === "valueSet") {
    return stableSerializeUnknown({ kind: "valueSet", tokens: normalizeFilterValuesForSignature(entry.tokens) })
  }
  return stableSerializeUnknown({
    kind: "predicate",
    operator: entry.operator,
    value: entry.value,
    value2: entry.value2,
    caseSensitive: entry.caseSensitive,
  })
}

function serializeFilterModelForSignature(filterModel: DataGridFilterSnapshot | null): string {
  if (!filterModel) {
    return "__none__"
  }
  const normalizedColumnFilters: Record<string, string> = {}
  for (const [rawKey, entry] of Object.entries(filterModel.columnFilters ?? {})) {
    const hasContent = entry.kind === "valueSet"
      ? entry.tokens.length > 0
      : true
    if (!hasContent) {
      continue
    }
    const key = rawKey.trim()
    if (!key) {
      continue
    }
    normalizedColumnFilters[key] = normalizeColumnFilterEntryForSignature(entry)
  }
  const normalizedAdvancedFilters: Record<string, DataGridAdvancedFilter> = {}
  for (const [rawKey, advancedFilter] of Object.entries(filterModel.advancedFilters ?? {})) {
    const key = rawKey.trim()
    if (!key) {
      continue
    }
    normalizedAdvancedFilters[key] = advancedFilter
  }
  return stableSerializeUnknown({
    columnFilters: normalizedColumnFilters,
    advancedFilters: normalizedAdvancedFilters,
    advancedExpression: resolveAdvancedExpression(filterModel),
  })
}

export function isSameSortModel(
  left: readonly DataGridSortState[],
  right: readonly DataGridSortState[],
): boolean {
  return serializeSortValueModelForCache(left, { includeDirection: true })
    === serializeSortValueModelForCache(right, { includeDirection: true })
}

export function isSameFilterModel(
  left: DataGridFilterSnapshot | null,
  right: DataGridFilterSnapshot | null,
): boolean {
  return serializeFilterModelForSignature(left) === serializeFilterModelForSignature(right)
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

function compareUnknown(left: unknown, right: unknown): number {
  if (left == null && right == null) {
    return 0
  }
  if (left == null) {
    return 1
  }
  if (right == null) {
    return -1
  }
  const leftNumber = toComparableNumber(left)
  const rightNumber = toComparableNumber(right)
  if (leftNumber != null && rightNumber != null) {
    return leftNumber - rightNumber
  }
  const leftText = normalizeText(left)
  const rightText = normalizeText(right)
  return leftText.localeCompare(rightText)
}

export function sortLeafRows<T>(
  rows: readonly DataGridRowNode<T>[],
  sortModel: readonly DataGridSortState[],
  resolveSortValues?: (row: DataGridRowNode<T>, descriptors: readonly DataGridSortState[]) => readonly unknown[],
): DataGridRowNode<T>[] {
  const descriptors = Array.isArray(sortModel) ? sortModel.filter(Boolean) : []
  if (descriptors.length === 0) {
    return [...rows]
  }
  const decorated = rows.map((row, index) => ({
    row,
    index,
    sortValues: resolveSortValues
      ? resolveSortValues(row, descriptors)
      : descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field)),
  }))
  decorated.sort((left, right) => {
    for (let descriptorIndex = 0; descriptorIndex < descriptors.length; descriptorIndex += 1) {
      const descriptor = descriptors[descriptorIndex]
      if (!descriptor) {
        continue
      }
      const direction = descriptor.direction === "desc" ? -1 : 1
      const leftValue = left.sortValues[descriptorIndex]
      const rightValue = right.sortValues[descriptorIndex]
      const compared = compareUnknown(leftValue, rightValue)
      if (compared !== 0) {
        return compared * direction
      }
    }
    const rowIdDelta = compareUnknown(left.row.rowId, right.row.rowId)
    if (rowIdDelta !== 0) {
      return rowIdDelta
    }
    const sourceDelta = left.row.sourceIndex - right.row.sourceIndex
    if (sourceDelta !== 0) {
      return sourceDelta
    }
    return left.index - right.index
  })
  return decorated.map(entry => entry.row)
}
