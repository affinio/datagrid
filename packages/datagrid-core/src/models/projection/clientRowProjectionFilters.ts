import type { DataGridColumnFilterSnapshotEntry, DataGridColumnPredicateFilter, DataGridColumnStyleFilter, DataGridFilterSnapshot, DataGridRowNode, DataGridTreeDataResolvedSpec } from "../rowModel.js"
import { evaluateDataGridAdvancedFilterExpression } from "../filters/advancedFilter.js"
import { evaluateColumnPredicateFilter, serializeColumnValueToToken } from "../filters/columnFilterUtils.js"
import { resolveAdvancedExpression } from "../mutation/rowPatchAnalyzer.js"
import { normalizeText, readRowField, type DataGridFilterCellStyleValueReader, type DataGridFilterCellValueReader } from "./clientRowProjectionAccessors.js"
import { stableSerializeUnknown } from "./clientRowProjectionStableSerialize.js"

export interface DataGridFilterPredicateOptions<T> {
  ignoreColumnFilterKey?: string
  readRowField?: (rowNode: DataGridRowNode<T>, key: string, field?: string) => unknown
  readFilterCell?: DataGridFilterCellValueReader<T>
  readFilterCellStyle?: DataGridFilterCellStyleValueReader<T>
  quickFilterColumnKeys?: readonly string[]
}

function normalizeColumnFilterEntries(
  columnFilters: Record<string, DataGridColumnFilterSnapshotEntry>,
): Array<{
    key: string
    kind: "valueSet"
    valueTokenSet: Set<string>
    stringValueSet: Set<string> | null
  } | {
    key: string
    kind: "predicate"
    predicate: DataGridColumnPredicateFilter
  }> {
  const normalizeValueSetTokenForLookup = (token: string): string => {
    if (token.startsWith("string:")) {
      return `string:${token.slice("string:".length).toLowerCase()}`
    }
    return token
  }
  const normalized: Array<{
    key: string
    kind: "valueSet"
    valueTokenSet: Set<string>
    stringValueSet: Set<string> | null
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
      const stringValues: string[] = []
      for (const rawToken of rawEntry.tokens ?? []) {
        const token = normalizeValueSetTokenForLookup(String(rawToken ?? ""))
        if (!token || seen.has(token)) {
          continue
        }
        seen.add(token)
        valueTokens.push(token)
        if (token.startsWith("string:")) {
          stringValues.push(token.slice("string:".length))
        }
      }
      if (valueTokens.length === 0) {
        continue
      }
      normalized.push({
        key,
        kind: "valueSet",
        valueTokenSet: new Set(valueTokens),
        stringValueSet: stringValues.length > 0 ? new Set(stringValues) : null,
      })
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

function normalizeStyleValueTokenForLookup(token: string): string {
  if (token.startsWith("string:")) {
    return `string:${token.slice("string:".length).toLowerCase()}`
  }
  return token
}

function normalizeColumnStyleFilterEntries(
  columnStyleFilters: Record<string, DataGridColumnStyleFilter>,
): Array<{
  key: string
  styleKey: string
  valueTokenSet: Set<string>
}> {
  const normalized: Array<{
    key: string
    styleKey: string
    valueTokenSet: Set<string>
  }> = []
  for (const [rawKey, rawEntry] of Object.entries(columnStyleFilters ?? {})) {
    const key = rawKey.trim()
    if (!key || !rawEntry || rawEntry.kind !== "styleValueSet") {
      continue
    }
    const styleKey = String(rawEntry.styleKey ?? "").trim()
    if (!styleKey) {
      continue
    }
    const seen = new Set<string>()
    const valueTokens: string[] = []
    for (const rawToken of rawEntry.tokens ?? []) {
      const token = normalizeStyleValueTokenForLookup(String(rawToken ?? ""))
      if (!token || seen.has(token)) {
        continue
      }
      seen.add(token)
      valueTokens.push(token)
    }
    if (valueTokens.length === 0) {
      continue
    }
    normalized.push({
      key,
      styleKey,
      valueTokenSet: new Set(valueTokens),
    })
  }
  return normalized
}

function normalizeQuickFilterQuery(query: unknown): string {
  return typeof query === "string" ? query.trim().toLowerCase() : ""
}

function normalizeQuickFilterColumnKeys(columnKeys: readonly unknown[] | undefined): readonly string[] {
  if (!Array.isArray(columnKeys)) {
    return []
  }
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const rawColumnKey of columnKeys) {
    const columnKey = String(rawColumnKey ?? "").trim()
    if (columnKey.length === 0 || seen.has(columnKey)) {
      continue
    }
    seen.add(columnKey)
    normalized.push(columnKey)
  }
  return normalized
}

function normalizeQuickFilterTokens(query: string): readonly string[] {
  return query.split(/\s+/).filter(token => token.length > 0)
}

function matchesValueSetFilter(
  candidate: unknown,
  filterEntry: {
    valueTokenSet: Set<string>
    stringValueSet: Set<string> | null
  },
): boolean {
  if (candidate == null) {
    return filterEntry.valueTokenSet.has("null")
  }
  if (typeof candidate === "string") {
    return filterEntry.stringValueSet?.has(candidate.toLowerCase()) === true
  }
  if (candidate instanceof Date) {
    return filterEntry.valueTokenSet.has(`date:${candidate.toISOString()}`)
  }
  const kind = typeof candidate
  if (kind === "number" || kind === "boolean" || kind === "bigint" || kind === "undefined") {
    return filterEntry.valueTokenSet.has(`${kind}:${String(candidate)}`)
  }
  const candidateToken = normalizeStyleValueTokenForLookup(serializeColumnValueToToken(candidate))
  return filterEntry.valueTokenSet.has(candidateToken)
}

export function createFilterPredicate<T>(
  filterModel: DataGridFilterSnapshot | null,
  options: DataGridFilterPredicateOptions<T> = {},
): (rowNode: DataGridRowNode<T>) => boolean {
  if (!filterModel) {
    return () => true
  }

  const ignoredColumnKey = typeof options.ignoreColumnFilterKey === "string"
    ? options.ignoreColumnFilterKey.trim()
    : ""
  const readField = options.readRowField ?? readRowField
  const readFilterCell = options.readFilterCell
  const readFilterCellStyle = options.readFilterCellStyle

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
    const nextColumnStyleFilters: Record<string, DataGridColumnStyleFilter> = {}
    for (const [rawKey, styleFilter] of Object.entries(filterModel.columnStyleFilters ?? {})) {
      if (rawKey.trim() === ignoredColumnKey) {
        changed = true
        continue
      }
      nextColumnStyleFilters[rawKey] = {
        kind: "styleValueSet",
        styleKey: styleFilter.styleKey,
        tokens: [...styleFilter.tokens],
      }
    }
    if (!changed) {
      return filterModel
    }
    return {
      columnFilters: nextColumnFilters,
      columnStyleFilters: nextColumnStyleFilters,
      advancedExpression: filterModel.advancedExpression ?? null,
      ...(filterModel.quickFilter ? { quickFilter: filterModel.quickFilter } : {}),
    } satisfies DataGridFilterSnapshot
  })()

  const columnFilters = normalizeColumnFilterEntries(
    (effectiveFilterModel.columnFilters ?? {}) as Record<string, DataGridColumnFilterSnapshotEntry>,
  ).map(entry => [entry.key, entry] as const)
  const columnStyleFilters = normalizeColumnStyleFilterEntries(
    (effectiveFilterModel.columnStyleFilters ?? {}) as Record<string, DataGridColumnStyleFilter>,
  )
  const advancedExpression = resolveAdvancedExpression(effectiveFilterModel)
  const quickFilterQuery = normalizeQuickFilterQuery(effectiveFilterModel.quickFilter?.query)
  const quickFilterColumnKeys = normalizeQuickFilterColumnKeys(
    effectiveFilterModel.quickFilter?.columns?.length
      ? effectiveFilterModel.quickFilter.columns
      : options.quickFilterColumnKeys,
  )
  const quickFilterMode = effectiveFilterModel.quickFilter?.mode === "tokens" ? "tokens" : "contains"
  const quickFilterTokens = quickFilterMode === "tokens"
    ? normalizeQuickFilterTokens(quickFilterQuery)
    : []
  const hasQuickFilter = quickFilterQuery.length > 0

  const readCellValue = (rowNode: DataGridRowNode<T>, columnKey: string, field?: string): unknown => {
    if (typeof readFilterCell === "function") {
      const resolved = readFilterCell(rowNode, columnKey)
      if (typeof resolved !== "undefined") {
        return resolved
      }
    }
    return readField(rowNode, columnKey, field)
  }

  const readCellStyleValue = (
    rowNode: DataGridRowNode<T>,
    columnKey: string,
    styleKey: string,
  ): unknown => {
    if (typeof readFilterCellStyle !== "function") {
      return undefined
    }
    return readFilterCellStyle(rowNode, columnKey, styleKey)
  }

  const rowMatchesQuickFilter = (rowNode: DataGridRowNode<T>): boolean => {
    if (quickFilterColumnKeys.length === 0) {
      return false
    }
    if (quickFilterMode === "tokens" && quickFilterTokens.length === 0) {
      return true
    }
    const values: string[] = []
    for (const columnKey of quickFilterColumnKeys) {
      const value = readCellValue(rowNode, columnKey)
      if (value == null) {
        continue
      }
      const normalizedValue = String(value).toLowerCase()
      if (quickFilterMode === "contains" && normalizedValue.includes(quickFilterQuery)) {
        return true
      }
      if (quickFilterMode === "tokens") {
        values.push(normalizedValue)
      }
    }
    if (quickFilterMode !== "tokens") {
      return false
    }
    return quickFilterTokens.every(token => values.some(value => value.includes(token)))
  }

  return (rowNode: DataGridRowNode<T>) => {
    for (const [key, filterEntry] of columnFilters) {
      const candidate = readCellValue(rowNode, key)
      if (filterEntry.kind === "valueSet") {
        if (!matchesValueSetFilter(candidate, filterEntry)) {
          return false
        }
        continue
      }
      if (filterEntry.predicate && !evaluateColumnPredicateFilter(filterEntry.predicate, candidate)) {
        return false
      }
    }

    for (const filterEntry of columnStyleFilters) {
      const candidate = readCellStyleValue(rowNode, filterEntry.key, filterEntry.styleKey)
      const candidateToken = normalizeStyleValueTokenForLookup(serializeColumnValueToToken(candidate))
      if (!filterEntry.valueTokenSet.has(candidateToken)) {
        return false
      }
    }

    if (advancedExpression) {
      if (!evaluateDataGridAdvancedFilterExpression(advancedExpression, condition => {
        return readCellValue(rowNode, condition.key, condition.field)
      })) {
        return false
      }
    }

    return !hasQuickFilter || rowMatchesQuickFilter(rowNode)
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
  const columnStyleFilters = Object.values(filterModel.columnStyleFilters ?? {})
  if (columnStyleFilters.some(entry => entry.tokens.length > 0)) {
    return true
  }
  if (resolveAdvancedExpression(filterModel) !== null) {
    return true
  }
  return normalizeQuickFilterQuery(filterModel.quickFilter?.query).length > 0
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

function normalizeColumnStyleFilterEntryForSignature(
  entry: DataGridColumnStyleFilter,
): string {
  return stableSerializeUnknown({
    kind: "styleValueSet",
    styleKey: String(entry.styleKey ?? "").trim(),
    tokens: normalizeFilterValuesForSignature(entry.tokens),
  })
}

function normalizeQuickFilterForSignature(
  quickFilter: DataGridFilterSnapshot["quickFilter"],
): { query: string; columns?: readonly string[]; mode?: "contains" | "tokens" } | null {
  const query = typeof quickFilter?.query === "string" ? quickFilter.query.trim() : ""
  if (query.length === 0) {
    return null
  }
  const columns = Array.isArray(quickFilter?.columns)
    ? Array.from(new Set(quickFilter.columns.map(column => String(column).trim()).filter(column => column.length > 0)))
      .sort((left, right) => left.localeCompare(right))
    : []
  const mode = quickFilter?.mode === "contains" || quickFilter?.mode === "tokens"
    ? quickFilter.mode
    : undefined
  return {
    query,
    ...(columns.length > 0 ? { columns } : {}),
    ...(mode ? { mode } : {}),
  }
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
  const normalizedColumnStyleFilters: Record<string, string> = {}
  for (const [rawKey, entry] of Object.entries(filterModel.columnStyleFilters ?? {})) {
    const key = rawKey.trim()
    if (!key || !String(entry.styleKey ?? "").trim() || entry.tokens.length === 0) {
      continue
    }
    normalizedColumnStyleFilters[key] = normalizeColumnStyleFilterEntryForSignature(entry)
  }
  return stableSerializeUnknown({
    columnFilters: normalizedColumnFilters,
    columnStyleFilters: normalizedColumnStyleFilters,
    advancedExpression: resolveAdvancedExpression(filterModel),
    quickFilter: normalizeQuickFilterForSignature(filterModel.quickFilter),
  })
}

export function isSameFilterModel(
  left: DataGridFilterSnapshot | null,
  right: DataGridFilterSnapshot | null,
): boolean {
  return serializeFilterModelForSignature(left) === serializeFilterModelForSignature(right)
}

