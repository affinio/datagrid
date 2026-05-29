import type {
  DataGridAdvancedFilter,
  DataGridColumnFilterSnapshotEntry,
  DataGridColumnHistogram,
  DataGridColumnHistogramEntry,
  DataGridColumnHistogramOptions,
  DataGridColumnPredicateFilter,
  DataGridColumnStyleFilter,
  DataGridFilterSnapshot,
  DataGridRowNode,
  DataGridSortState,
  DataGridTreeDataResolvedSpec,
} from "../rowModel.js"
import { evaluateDataGridAdvancedFilterExpression } from "../filters/advancedFilter.js"
import {
  evaluateColumnPredicateFilter,
  serializeColumnValueToToken,
} from "../filters/columnFilterUtils.js"
import { resolveAdvancedExpression } from "../mutation/rowPatchAnalyzer.js"
import {
  compareDataGridValues,
  type DataGridComparatorRegistry,
} from "../comparator/comparatorPolicy.js"

export type DataGridFilterCellValueReader<T> = (
  rowNode: DataGridRowNode<T>,
  columnKey: string,
) => unknown

export type DataGridFilterCellStyleValueReader<T> = (
  rowNode: DataGridRowNode<T>,
  columnKey: string,
  styleKey: string,
) => unknown

export interface DataGridFilterPredicateOptions<T> {
  ignoreColumnFilterKey?: string
  readRowField?: (rowNode: DataGridRowNode<T>, key: string, field?: string) => unknown
  readFilterCell?: DataGridFilterCellValueReader<T>
  readFilterCellStyle?: DataGridFilterCellStyleValueReader<T>
  quickFilterColumnKeys?: readonly string[]
}

export interface ResolveDataGridFilterCellValueOptions<T> {
  rowNode: DataGridRowNode<T>
  columnKey: string
  field?: string
  readFilterCell?: DataGridFilterCellValueReader<T>
  readField?: (rowNode: DataGridRowNode<T>, key: string, field?: string) => unknown
}

export interface ResolveDataGridFilterCellStyleValueOptions<T> {
  rowNode: DataGridRowNode<T>
  columnKey: string
  styleKey: string
  readFilterCellStyle?: DataGridFilterCellStyleValueReader<T>
}

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

export function resolveDataGridFilterCellValue<T>(
  options: ResolveDataGridFilterCellValueOptions<T>,
): unknown {
  if (typeof options.readFilterCell === "function") {
    const resolved = options.readFilterCell(options.rowNode, options.columnKey)
    if (typeof resolved !== "undefined") {
      return resolved
    }
  }
  const readField = options.readField ?? readRowField
  return readField(options.rowNode, options.columnKey, options.field)
}

export function resolveDataGridFilterCellStyleValue<T>(
  options: ResolveDataGridFilterCellStyleValueOptions<T>,
): unknown {
  if (typeof options.readFilterCellStyle !== "function") {
    return undefined
  }
  return options.readFilterCellStyle(options.rowNode, options.columnKey, options.styleKey)
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
    const nextAdvancedFilters: Record<string, DataGridAdvancedFilter> = {}
    for (const [rawKey, advancedFilter] of Object.entries(filterModel.advancedFilters ?? {})) {
      if (rawKey.trim() === ignoredColumnKey) {
        changed = true
        continue
      }
      nextAdvancedFilters[rawKey] = advancedFilter
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
      advancedFilters: nextAdvancedFilters,
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
  const advancedKeys = Object.keys(filterModel.advancedFilters ?? {})
  if (advancedKeys.length > 0) {
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
      const comparator = stableSerializeUnknown(descriptor.comparator ?? null)
      return `${descriptor.key}:${descriptor.field ?? ""}:${direction}:${dependencyFields}:${comparator}`
    })
    .join("|")
}

function stableSerializeUnknown(value: unknown, active = new WeakSet<object>()): string {
  if (value == null) {
    return JSON.stringify(value)
  }
  if (typeof value === "bigint") {
    return JSON.stringify(`${value}n`)
  }
  if (typeof value === "function") {
    return JSON.stringify(`[Function:${value.name || "anonymous"}]`)
  }
  if (typeof value === "symbol") {
    return JSON.stringify(String(value))
  }
  if (typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString())
  }
  if (value instanceof RegExp) {
    return JSON.stringify(String(value))
  }
  if (active.has(value)) {
    return JSON.stringify("[Circular]")
  }
  active.add(value)
  try {
    if (Array.isArray(value)) {
      return `[${value.map(entry => stableSerializeUnknown(entry, active)).join(",")}]`
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableSerializeUnknown(nested, active)}`)
    return `{${entries.join(",")}}`
  } finally {
    active.delete(value)
  }
}

export function buildColumnHistogram<T>(
  rows: readonly DataGridRowNode<T>[],
  columnId: string,
  options?: DataGridColumnHistogramOptions,
  valueOptions: {
    readField?: (rowNode: DataGridRowNode<T>, key: string, field?: string) => unknown
    readFilterCell?: DataGridFilterCellValueReader<T>
    readFilterCellStyle?: DataGridFilterCellStyleValueReader<T>
  } = {},
): DataGridColumnHistogram {
  const key = String(columnId ?? "").trim()
  const styleKey = String(options?.styleKey ?? "").trim()
  const normalizedSearch = String(options?.search ?? "").trim().toLowerCase()
  const entriesByToken = new Map<string, DataGridColumnHistogramEntry>()
  const readField = valueOptions.readField ?? readRowField

  for (const row of rows) {
    const value = styleKey.length > 0
      ? resolveDataGridFilterCellStyleValue({
        rowNode: row,
        columnKey: key,
        styleKey,
        readFilterCellStyle: valueOptions.readFilterCellStyle,
      })
      : resolveDataGridFilterCellValue({
        rowNode: row,
        columnKey: key,
        readFilterCell: valueOptions.readFilterCell,
        readField,
      })
    const token = serializeColumnValueToToken(value)
    const text = normalizeText(value)
    if (normalizedSearch.length > 0 && !text.toLowerCase().includes(normalizedSearch)) {
      continue
    }
    const current = entriesByToken.get(token)
    if (current) {
      current.count += 1
      continue
    }
    entriesByToken.set(token, {
      token,
      value,
      text,
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
    columnStyleFilters: normalizedColumnStyleFilters,
    advancedFilters: normalizedAdvancedFilters,
    advancedExpression: resolveAdvancedExpression(filterModel),
    quickFilter: normalizeQuickFilterForSignature(filterModel.quickFilter),
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

function toFastComparableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (value instanceof Date) {
    return value.getTime()
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function compareFastNullableNumbers(
  leftValue: unknown,
  rightValue: unknown,
  leftNumber: number | undefined,
  rightNumber: number | undefined,
  nulls: "first" | "last",
): number {
  if (leftValue == null && rightValue == null) {
    return 0
  }
  if (leftValue == null) {
    return nulls === "first" ? -1 : 1
  }
  if (rightValue == null) {
    return nulls === "first" ? 1 : -1
  }
  return (leftNumber ?? 0) - (rightNumber ?? 0)
}

const NUMERIC_BUCKET_SORT_MIN_ROWS = 4096
const NUMERIC_BUCKET_SORT_MAX_RANGE = 65_536
const NUMERIC_BUCKET_SORT_RANGE_RATIO = 8

function shouldUseNumericIntegerBucketSort(rowCount: number, minValue: number, maxValue: number): boolean {
  if (rowCount < NUMERIC_BUCKET_SORT_MIN_ROWS) {
    return false
  }
  const range = maxValue - minValue + 1
  if (!Number.isSafeInteger(range) || range <= 0) {
    return false
  }
  const rangeBudget = Math.min(
    NUMERIC_BUCKET_SORT_MAX_RANGE,
    Math.max(1024, Math.floor(rowCount / NUMERIC_BUCKET_SORT_RANGE_RATIO)),
  )
  return range <= rangeBudget
}

interface RowTieBreakerEntry {
  rowId: unknown
  rowIdNumber: number | null
  rowIdText: string
  sourceIndex: number
}

function createRowTieBreakerComparator<T>(
  rows: readonly DataGridRowNode<T>[],
): (leftIndex: number, rightIndex: number) => number {
  const cache = new Array<RowTieBreakerEntry | null | undefined>(rows.length)
  const readEntry = (index: number): RowTieBreakerEntry | null => {
    const cached = cache[index]
    if (typeof cached !== "undefined") {
      return cached
    }
    const row = rows[index]
    if (!row) {
      cache[index] = null
      return null
    }
    const rowId = row.rowId
    const entry: RowTieBreakerEntry = {
      rowId,
      rowIdNumber: rowId == null ? null : toFastComparableNumber(rowId),
      rowIdText: rowId == null ? "" : String(rowId),
      sourceIndex: row.sourceIndex,
    }
    cache[index] = entry
    return entry
  }

  return (leftIndex: number, rightIndex: number): number => {
    const left = readEntry(leftIndex)
    const right = readEntry(rightIndex)
    if (!left || !right) {
      return leftIndex - rightIndex
    }
    let rowIdDelta = 0
    if (left.rowId == null && right.rowId == null) {
      rowIdDelta = 0
    } else if (left.rowId == null) {
      rowIdDelta = 1
    } else if (right.rowId == null) {
      rowIdDelta = -1
    } else if (left.rowIdNumber != null && right.rowIdNumber != null) {
      rowIdDelta = left.rowIdNumber - right.rowIdNumber
    } else {
      rowIdDelta = left.rowIdText.localeCompare(right.rowIdText)
    }
    if (rowIdDelta !== 0) {
      return rowIdDelta
    }
    const sourceDelta = left.sourceIndex - right.sourceIndex
    if (sourceDelta !== 0) {
      return sourceDelta
    }
    return leftIndex - rightIndex
  }
}

function sortRowsByIntegerBuckets<T>(
  rows: readonly DataGridRowNode<T>[],
  numericSortValuesByIndex: readonly (number | undefined)[],
  minValue: number,
  maxValue: number,
  direction: 1 | -1,
): DataGridRowNode<T>[] {
  const range = maxValue - minValue + 1
  const buckets = new Array<number[] | undefined>(range)
  for (let index = 0; index < rows.length; index += 1) {
    const bucketIndex = (numericSortValuesByIndex[index] ?? minValue) - minValue
    const bucket = buckets[bucketIndex]
    if (bucket) {
      bucket.push(index)
    } else {
      buckets[bucketIndex] = [index]
    }
  }

  const sortedRows = new Array<DataGridRowNode<T>>(rows.length)
  let outputIndex = 0
  const compareTieBreakers = createRowTieBreakerComparator(rows)
  const start = direction === -1 ? range - 1 : 0
  const end = direction === -1 ? -1 : range
  for (let bucketIndex = start; bucketIndex !== end; bucketIndex += direction) {
    const bucket = buckets[bucketIndex]
    if (!bucket) {
      continue
    }
    if (bucket.length > 1) {
      bucket.sort(compareTieBreakers)
    }
    for (let index = 0; index < bucket.length; index += 1) {
      const row = rows[bucket[index] ?? -1]
      if (row) {
        sortedRows[outputIndex] = row
        outputIndex += 1
      }
    }
  }
  return sortedRows
}

export function sortLeafRows<T>(
  rows: readonly DataGridRowNode<T>[],
  sortModel: readonly DataGridSortState[],
  resolveSortValues?: (row: DataGridRowNode<T>, descriptors: readonly DataGridSortState[]) => readonly unknown[],
  resolveSingleSortValue?: (row: DataGridRowNode<T>, descriptor: DataGridSortState) => unknown,
  options: { comparatorRegistry?: DataGridComparatorRegistry<T> } = {},
): DataGridRowNode<T>[] {
  const descriptors = Array.isArray(sortModel) ? sortModel.filter(Boolean) : []
  if (descriptors.length === 0) {
    return rows as DataGridRowNode<T>[]
  }
  if (descriptors.length === 1) {
    const descriptor = descriptors[0]
    if (!descriptor) {
      return rows as DataGridRowNode<T>[]
    }
    const direction = descriptor.direction === "desc" ? -1 : 1
    const nulls = descriptor.comparator?.nulls === "first" ? "first" : "last"
    const sortValuesByIndex = new Array<unknown>(rows.length)
    const numericSortValuesByIndex = new Array<number | undefined>(rows.length)
    let canUseNumericSortFastPath = descriptor.comparator?.kind !== "custom"
    let canUseIntegerBucketSort = canUseNumericSortFastPath
    let hasNullableSortValue = false
    let minIntegerSortValue = Number.POSITIVE_INFINITY
    let maxIntegerSortValue = Number.NEGATIVE_INFINITY
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      if (!row) {
        sortValuesByIndex[index] = undefined
        hasNullableSortValue = true
        canUseIntegerBucketSort = false
        continue
      }
      const sortValue = resolveSingleSortValue
        ? resolveSingleSortValue(row, descriptor)
        : resolveSortValues
          ? resolveSortValues(row, descriptors)[0]
          : readRowField(row, descriptor.key, descriptor.field)
      sortValuesByIndex[index] = sortValue
      if (!canUseNumericSortFastPath || sortValue == null) {
        if (sortValue == null) {
          hasNullableSortValue = true
          canUseIntegerBucketSort = false
        }
        continue
      }
      const numericSortValue = toFastComparableNumber(sortValue)
      if (numericSortValue == null) {
        canUseNumericSortFastPath = false
        canUseIntegerBucketSort = false
        continue
      }
      numericSortValuesByIndex[index] = numericSortValue
      if (!canUseIntegerBucketSort) {
        continue
      }
      if (!Number.isSafeInteger(numericSortValue)) {
        canUseIntegerBucketSort = false
        continue
      }
      minIntegerSortValue = Math.min(minIntegerSortValue, numericSortValue)
      maxIntegerSortValue = Math.max(maxIntegerSortValue, numericSortValue)
    }

    if (
      canUseNumericSortFastPath
      && canUseIntegerBucketSort
      && !hasNullableSortValue
      && shouldUseNumericIntegerBucketSort(rows.length, minIntegerSortValue, maxIntegerSortValue)
    ) {
      return sortRowsByIntegerBuckets(
        rows,
        numericSortValuesByIndex,
        minIntegerSortValue,
        maxIntegerSortValue,
        direction,
      )
    }

    const orderedIndexes = new Array<number>(rows.length)
    for (let index = 0; index < rows.length; index += 1) {
      orderedIndexes[index] = index
    }
    const compareTieBreakers = createRowTieBreakerComparator(rows)

    orderedIndexes.sort((leftIndex, rightIndex) => {
      const leftRow = rows[leftIndex]
      const rightRow = rows[rightIndex]
      if (!leftRow || !rightRow) {
        return leftIndex - rightIndex
      }
      const compared = canUseNumericSortFastPath
        ? compareFastNullableNumbers(
            sortValuesByIndex[leftIndex],
            sortValuesByIndex[rightIndex],
            numericSortValuesByIndex[leftIndex],
            numericSortValuesByIndex[rightIndex],
            nulls,
          )
        : compareDataGridValues(
            sortValuesByIndex[leftIndex],
            sortValuesByIndex[rightIndex],
            { descriptor, leftRow, rightRow },
            { comparatorRegistry: options.comparatorRegistry },
          )
      if (compared !== 0) {
        return compared * direction
      }
      return compareTieBreakers(leftIndex, rightIndex)
    })

    const sortedRows = new Array<DataGridRowNode<T>>(orderedIndexes.length)
    for (let index = 0; index < orderedIndexes.length; index += 1) {
      const rowIndex = orderedIndexes[index]
      if (typeof rowIndex === "undefined") {
        continue
      }
      const row = rows[rowIndex]
      if (row) {
        sortedRows[index] = row
      }
    }
    return sortedRows
  }

  const sortValuesByIndex = new Array<readonly unknown[]>(rows.length)
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!row) {
      sortValuesByIndex[index] = []
      continue
    }
    sortValuesByIndex[index] = resolveSortValues
      ? resolveSortValues(row, descriptors)
      : descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field))
  }

  const orderedIndexes = new Array<number>(rows.length)
  for (let index = 0; index < rows.length; index += 1) {
    orderedIndexes[index] = index
  }
  const compareTieBreakers = createRowTieBreakerComparator(rows)

  orderedIndexes.sort((leftIndex, rightIndex) => {
    const leftRow = rows[leftIndex]
    const rightRow = rows[rightIndex]
    if (!leftRow || !rightRow) {
      return leftIndex - rightIndex
    }
    const leftSortValues = sortValuesByIndex[leftIndex] ?? []
    const rightSortValues = sortValuesByIndex[rightIndex] ?? []
    for (let descriptorIndex = 0; descriptorIndex < descriptors.length; descriptorIndex += 1) {
      const descriptor = descriptors[descriptorIndex]
      if (!descriptor) {
        continue
      }
      const direction = descriptor.direction === "desc" ? -1 : 1
      const leftValue = leftSortValues[descriptorIndex]
      const rightValue = rightSortValues[descriptorIndex]
      const compared = compareDataGridValues(
        leftValue,
        rightValue,
        { descriptor, leftRow, rightRow },
        { comparatorRegistry: options.comparatorRegistry },
      )
      if (compared !== 0) {
        return compared * direction
      }
    }
    return compareTieBreakers(leftIndex, rightIndex)
  })

  const sortedRows = new Array<DataGridRowNode<T>>(orderedIndexes.length)
  for (let index = 0; index < orderedIndexes.length; index += 1) {
    const rowIndex = orderedIndexes[index]
    if (typeof rowIndex === "undefined") {
      continue
    }
    const row = rows[rowIndex]
    if (row) {
      sortedRows[index] = row
    }
  }
  return sortedRows
}
