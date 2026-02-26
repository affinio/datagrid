import {
  buildGroupExpansionSnapshot,
  buildPaginationSnapshot,
  cloneGroupBySpec,
  isGroupExpanded,
  isSameGroupExpansionSnapshot,
  isSameGroupBySpec,
  normalizeRowNode,
  normalizeGroupBySpec,
  normalizePaginationInput,
  normalizeTreeDataSpec,
  normalizeViewportRange,
  setGroupExpansionKey,
  toggleGroupExpansionKey,
  withResolvedRowIdentity,
  type DataGridGroupExpansionSnapshot,
  type DataGridPaginationInput,
  type DataGridProjectionDiagnostics,
  type DataGridAdvancedFilter,
  type DataGridColumnFilterSnapshotEntry,
  type DataGridColumnHistogram,
  type DataGridColumnHistogramEntry,
  type DataGridColumnPredicateFilter,
  type DataGridColumnHistogramOptions,
  type DataGridFilterSnapshot,
  type DataGridSortAndFilterModelInput,
  type DataGridAggregationModel,
  type DataGridGroupBySpec,
  type DataGridRowId,
  type DataGridRowIdResolver,
  type DataGridRowNode,
  type DataGridRowNodeInput,
  type DataGridRowModel,
  type DataGridRowModelListener,
  type DataGridRowModelRefreshReason,
  type DataGridRowModelSnapshot,
  type DataGridSortState,
  type DataGridTreeDataDiagnostics,
  type DataGridTreeDataFilterMode,
  type DataGridTreeDataResolvedSpec,
  type DataGridTreeDataSpec,
  type DataGridViewportRange,
} from "./rowModel.js"
import {
  createClientRowProjectionEngine,
  type DataGridClientProjectionFinalizeMeta,
  type DataGridClientProjectionStage,
  type DataGridClientProjectionStageHandlers,
  expandClientProjectionStages,
} from "./clientRowProjectionEngine.js"
import { createClientRowProjectionOrchestrator } from "./clientRowProjectionOrchestrator.js"
import { DATAGRID_CLIENT_ALL_PROJECTION_STAGES } from "./projectionStages.js"
import { buildGroupedRowsProjection } from "./groupProjectionController.js"
import {
  createDataGridAggregationEngine,
  type DataGridIncrementalAggregationGroupState,
  type DataGridIncrementalAggregationLeafContribution,
} from "./aggregationEngine.js"
import {
  cloneDataGridFilterSnapshot as cloneFilterSnapshot,
  evaluateDataGridAdvancedFilterExpression,
} from "./advancedFilter.js"
import {
  evaluateColumnPredicateFilter,
  serializeColumnValueToToken,
} from "./columnFilterUtils.js"
import {
  analyzeRowPatchChangeSet,
  collectAggregationModelFields,
  buildPatchProjectionExecutionPlan,
  collectFilterModelFields,
  collectGroupByFields,
  collectSortModelFields,
  collectTreeDataDependencyFields,
  resolveAdvancedExpression,
} from "./rowPatchAnalyzer.js"
import {
  createDataGridProjectionPolicy,
  type DataGridClientPerformanceMode,
  type DataGridProjectionPolicy,
} from "./projectionPolicy.js"
import { createClientRowRuntimeStateStore } from "./clientRowRuntimeStateStore.js"
import { createClientRowLifecycle } from "./clientRowLifecycle.js"
import type { DataGridFieldDependency } from "./dependencyGraph.js"

export interface CreateClientRowModelOptions<T> {
  rows?: readonly DataGridRowNodeInput<T>[]
  resolveRowId?: DataGridRowIdResolver<T>
  initialTreeData?: DataGridTreeDataSpec<T> | null
  initialSortModel?: readonly DataGridSortState[]
  initialFilterModel?: DataGridFilterSnapshot | null
  initialGroupBy?: DataGridGroupBySpec | null
  initialAggregationModel?: DataGridAggregationModel<T> | null
  initialPagination?: DataGridPaginationInput | null
  performanceMode?: DataGridClientPerformanceMode
  projectionPolicy?: DataGridProjectionPolicy
  fieldDependencies?: readonly DataGridFieldDependency[]
}

export interface DataGridClientRowReorderInput {
  fromIndex: number
  toIndex: number
  count?: number
}

export interface DataGridClientRowPatch<T = unknown> {
  rowId: DataGridRowId
  data: Partial<T>
}

export interface DataGridClientRowPatchOptions {
  /**
   * `false` by default for Excel-like edit flow: keep current projection order
   * until explicit reapply (`refresh`) or recompute-enabled patch.
   */
  recomputeSort?: boolean
  /**
   * `false` by default for Excel-like edit flow: keep current filter membership
   * until explicit reapply (`refresh`) or recompute-enabled patch.
   */
  recomputeFilter?: boolean
  /**
   * `false` by default for Excel-like edit flow: keep current grouping/aggregation
   * layout until explicit reapply (`refresh`) or recompute-enabled patch.
   */
  recomputeGroup?: boolean
  emit?: boolean
}

export interface ClientRowModel<T> extends DataGridRowModel<T> {
  setRows(rows: readonly DataGridRowNodeInput<T>[]): void
  setSortAndFilterModel(input: DataGridSortAndFilterModelInput): void
  getColumnHistogram(columnId: string, options?: DataGridColumnHistogramOptions): DataGridColumnHistogram
  patchRows(
    updates: readonly DataGridClientRowPatch<T>[],
    options?: DataGridClientRowPatchOptions,
  ): void
  reorderRows(input: DataGridClientRowReorderInput): boolean
  getDerivedCacheDiagnostics(): DataGridClientRowModelDerivedCacheDiagnostics
}

export interface DataGridClientRowModelDerivedCacheDiagnostics {
  revisions: {
    row: number
    sort: number
    filter: number
    group: number
  }
  filterPredicateHits: number
  filterPredicateMisses: number
  sortValueHits: number
  sortValueMisses: number
  groupValueHits: number
  groupValueMisses: number
}

interface SortValueCacheEntry {
  rowVersion: number
  values: readonly unknown[]
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

function readRowField<T>(rowNode: DataGridRowNode<T>, key: string, field?: string): unknown {
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

function normalizeText(value: unknown): string {
  if (value == null) {
    return ""
  }
  return String(value)
}

interface GroupKeySegment {
  field: string
  value: string
}

function createGroupedRowKey(segments: readonly GroupKeySegment[]): string {
  let encoded = "group:"
  for (const segment of segments) {
    encoded += `${segment.field.length}:${segment.field}${segment.value.length}:${segment.value}`
  }
  return encoded
}

function computeGroupByAggregatesMap<T>(
  inputRows: readonly DataGridRowNode<T>[],
  groupBy: DataGridGroupBySpec,
  resolveGroupValue: (row: DataGridRowNode<T>, field: string) => string,
  computeAggregates: (rows: readonly DataGridRowNode<T>[]) => Record<string, unknown>,
): Map<string, Record<string, unknown>> {
  const aggregatesByGroupKey = new Map<string, Record<string, unknown>>()
  const fields = groupBy.fields
  if (fields.length === 0 || inputRows.length === 0) {
    return aggregatesByGroupKey
  }

  const projectLevel = (
    rows: readonly DataGridRowNode<T>[],
    level: number,
    path: readonly GroupKeySegment[],
  ): void => {
    if (level >= fields.length || rows.length === 0) {
      return
    }
    const field = fields[level] ?? ""
    const buckets = new Map<string, DataGridRowNode<T>[]>()
    for (const row of rows) {
      const value = resolveGroupValue(row, field)
      const bucket = buckets.get(value)
      if (bucket) {
        bucket.push(row)
      } else {
        buckets.set(value, [row])
      }
    }
    for (const [value, bucketRows] of buckets.entries()) {
      const nextPath: GroupKeySegment[] = [...path, { field, value }]
      const groupKey = createGroupedRowKey(nextPath)
      const aggregates = computeAggregates(bucketRows)
      if (Object.keys(aggregates).length > 0) {
        aggregatesByGroupKey.set(groupKey, { ...aggregates })
      }
      projectLevel(bucketRows, level + 1, nextPath)
    }
  }

  projectLevel(inputRows, 0, [])
  return aggregatesByGroupKey
}

interface GroupByIncrementalAggregationResult {
  statesByGroupKey: Map<string, DataGridIncrementalAggregationGroupState>
  aggregatesByGroupKey: Map<string, Record<string, unknown>>
  groupPathByRowId: Map<DataGridRowId, readonly string[]>
  leafContributionByRowId: Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>
}

function computeGroupByIncrementalAggregation<T>(
  inputRows: readonly DataGridRowNode<T>[],
  groupBy: DataGridGroupBySpec,
  resolveGroupValue: (row: DataGridRowNode<T>, field: string) => string,
  createLeafContribution: (
    row: DataGridRowNode<T>,
  ) => DataGridIncrementalAggregationLeafContribution | null,
  createEmptyGroupState: () => DataGridIncrementalAggregationGroupState | null,
  applyContributionDelta: (
    groupState: DataGridIncrementalAggregationGroupState,
    previous: DataGridIncrementalAggregationLeafContribution | null,
    next: DataGridIncrementalAggregationLeafContribution | null,
  ) => void,
  finalizeGroupState: (groupState: DataGridIncrementalAggregationGroupState) => Record<string, unknown>,
): GroupByIncrementalAggregationResult {
  const statesByGroupKey = new Map<string, DataGridIncrementalAggregationGroupState>()
  const aggregatesByGroupKey = new Map<string, Record<string, unknown>>()
  const groupPathByRowId = new Map<DataGridRowId, string[]>()
  const leafContributionByRowId = new Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>()
  const fields = groupBy.fields
  if (fields.length === 0 || inputRows.length === 0) {
    return {
      statesByGroupKey,
      aggregatesByGroupKey,
      groupPathByRowId,
      leafContributionByRowId,
    }
  }

  const projectLevel = (
    rows: readonly DataGridRowNode<T>[],
    level: number,
    path: readonly GroupKeySegment[],
  ): void => {
    if (level >= fields.length || rows.length === 0) {
      return
    }
    const field = fields[level] ?? ""
    const buckets = new Map<string, DataGridRowNode<T>[]>()
    for (const row of rows) {
      const value = resolveGroupValue(row, field)
      const bucket = buckets.get(value)
      if (bucket) {
        bucket.push(row)
      } else {
        buckets.set(value, [row])
      }
    }
    for (const [value, bucketRows] of buckets.entries()) {
      const nextPath: GroupKeySegment[] = [...path, { field, value }]
      const groupKey = createGroupedRowKey(nextPath)
      const state = createEmptyGroupState()
      if (!state) {
        continue
      }
      for (const row of bucketRows) {
        if (row.kind !== "leaf") {
          continue
        }
        const contribution = createLeafContribution(row)
        if (!contribution) {
          continue
        }
        leafContributionByRowId.set(row.rowId, contribution)
        const existingPath = groupPathByRowId.get(row.rowId)
        if (existingPath) {
          existingPath.push(groupKey)
        } else {
          groupPathByRowId.set(row.rowId, [groupKey])
        }
        applyContributionDelta(state, null, contribution)
      }
      statesByGroupKey.set(groupKey, state)
      const aggregates = finalizeGroupState(state)
      if (Object.keys(aggregates).length > 0) {
        aggregatesByGroupKey.set(groupKey, aggregates)
      }
      projectLevel(bucketRows, level + 1, nextPath)
    }
  }

  projectLevel(inputRows, 0, [])
  return {
    statesByGroupKey,
    aggregatesByGroupKey,
    groupPathByRowId,
    leafContributionByRowId,
  }
}

function patchGroupRowsAggregatesByGroupKey<T>(
  rows: readonly DataGridRowNode<T>[],
  resolveAggregates: (groupKey: string) => Record<string, unknown> | undefined,
): DataGridRowNode<T>[] {
  const patched: DataGridRowNode<T>[] = []
  for (const row of rows) {
    if (row.kind !== "group" || !row.groupMeta?.groupKey) {
      patched.push(row)
      continue
    }
    const nextAggregates = resolveAggregates(row.groupMeta.groupKey)
    if (!nextAggregates || Object.keys(nextAggregates).length === 0) {
      if (!row.groupMeta.aggregates) {
        patched.push(row)
        continue
      }
      const { aggregates: _dropAggregates, ...groupMeta } = row.groupMeta
      patched.push({
        ...row,
        groupMeta,
      })
      continue
    }
    if (areSameAggregateRecords(row.groupMeta.aggregates, nextAggregates)) {
      patched.push(row)
      continue
    }
    patched.push({
      ...row,
      groupMeta: {
        ...row.groupMeta,
        aggregates: { ...nextAggregates },
      },
    })
  }
  return patched
}

function cloneAggregationModel<T>(
  input: DataGridAggregationModel<T> | null | undefined,
): DataGridAggregationModel<T> | null {
  if (!input || !Array.isArray(input.columns)) {
    return null
  }
  return {
    basis: input.basis,
    columns: input.columns.map(column => ({ ...column })),
  }
}

function isSameAggregationModel<T>(
  left: DataGridAggregationModel<T> | null,
  right: DataGridAggregationModel<T> | null,
): boolean {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }
  if (left.basis !== right.basis) {
    return false
  }
  if (left.columns.length !== right.columns.length) {
    return false
  }
  for (let index = 0; index < left.columns.length; index += 1) {
    const leftColumn = left.columns[index]
    const rightColumn = right.columns[index]
    if (!leftColumn || !rightColumn) {
      return false
    }
    if (
      leftColumn.key !== rightColumn.key ||
      leftColumn.field !== rightColumn.field ||
      leftColumn.op !== rightColumn.op ||
      leftColumn.createState !== rightColumn.createState ||
      leftColumn.add !== rightColumn.add ||
      leftColumn.remove !== rightColumn.remove ||
      leftColumn.finalize !== rightColumn.finalize ||
      leftColumn.coerce !== rightColumn.coerce
    ) {
      return false
    }
  }
  return true
}

function areSameAggregateRecords(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
): boolean {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  for (const key of leftKeys) {
    if (!(key in right) || left[key] !== right[key]) {
      return false
    }
  }
  return true
}

interface NormalizedColumnFilterEntry {
  key: string
  kind: "valueSet" | "predicate"
  valueTokenSet?: ReadonlySet<string>
  predicate?: DataGridColumnPredicateFilter
}

function normalizeColumnFilterEntries(
  columnFilters: Record<string, DataGridColumnFilterSnapshotEntry>,
): NormalizedColumnFilterEntry[] {
  const normalized: NormalizedColumnFilterEntry[] = []
  for (const [rawKey, rawEntry] of Object.entries(columnFilters ?? {})) {
    const key = rawKey.trim()
    if (key.length === 0) {
      continue
    }

    if (!rawEntry || typeof rawEntry !== "object") {
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

function createFilterPredicate<T>(
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

function hasActiveFilterModel(filterModel: DataGridFilterSnapshot | null): boolean {
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

function alwaysMatchesFilter<T>(_row: DataGridRowNode<T>): boolean {
  return true
}

function shouldUseFilteredRowsForTreeSort<T>(
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

function serializeSortValueModelForCache(
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

function buildColumnHistogram<T>(
  rows: readonly DataGridRowNode<T>[],
  columnId: string,
  options?: Pick<DataGridColumnHistogramOptions, "limit" | "orderBy">,
): DataGridColumnHistogram {
  const countsByToken = new Map<string, { value: unknown; count: number }>()
  for (const row of rows) {
    if (row.kind !== "leaf") {
      continue
    }
    const value = readRowField(row, columnId)
    const token = serializeColumnValueToToken(value)
    const current = countsByToken.get(token)
    if (current) {
      current.count += 1
      continue
    }
    countsByToken.set(token, { value, count: 1 })
  }
  const entries: DataGridColumnHistogramEntry[] = []
  for (const [token, entry] of countsByToken.entries()) {
    entries.push({
      token,
      value: entry.value,
      count: entry.count,
      text: normalizeText(entry.value),
    })
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

function isSameSortModel(
  left: readonly DataGridSortState[],
  right: readonly DataGridSortState[],
): boolean {
  return serializeSortValueModelForCache(left, { includeDirection: true })
    === serializeSortValueModelForCache(right, { includeDirection: true })
}

function isSameFilterModel(
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

function sortLeafRows<T>(
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

function isDataGridRowId(value: unknown): value is DataGridRowId {
  return typeof value === "string" || typeof value === "number"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function applyRowDataPatch<T>(current: T, patch: Partial<T>): T {
  if (!isRecord(current) || !isRecord(patch)) {
    return patch as T
  }
  let changed = false
  const next = Object.create(Object.getPrototypeOf(current)) as Record<string, unknown>
  Object.defineProperties(next, Object.getOwnPropertyDescriptors(current))
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (Object.is(next[key], value)) {
      continue
    }
    next[key] = value
    changed = true
  }
  return changed ? (next as T) : current
}

function mergeRowPatch<T>(left: Partial<T>, right: Partial<T>): Partial<T> {
  if (isRecord(left) && isRecord(right)) {
    return {
      ...left,
      ...right,
    } as Partial<T>
  }
  return right
}

function buildRowIdIndex<T>(inputRows: readonly DataGridRowNode<T>[]): Map<DataGridRowId, DataGridRowNode<T>> {
  const byId = new Map<DataGridRowId, DataGridRowNode<T>>()
  for (const row of inputRows) {
    byId.set(row.rowId, row)
  }
  return byId
}

function remapRowsByIdentity<T>(
  inputRows: readonly DataGridRowNode<T>[],
  byId: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
): DataGridRowNode<T>[] {
  const remapped: DataGridRowNode<T>[] = []
  for (const row of inputRows) {
    const replacement = byId.get(row.rowId)
    if (replacement) {
      remapped.push(replacement)
    }
  }
  return remapped
}

function preserveRowOrder<T>(
  previousRows: readonly DataGridRowNode<T>[],
  nextRows: readonly DataGridRowNode<T>[],
): DataGridRowNode<T>[] {
  if (previousRows.length === 0) {
    return [...nextRows]
  }
  const nextById = buildRowIdIndex(nextRows)
  const seen = new Set<DataGridRowId>()
  const projected: DataGridRowNode<T>[] = []
  for (const row of previousRows) {
    const candidate = nextById.get(row.rowId)
    if (!candidate || seen.has(candidate.rowId)) {
      continue
    }
    projected.push(candidate)
    seen.add(candidate.rowId)
  }
  for (const row of nextRows) {
    if (seen.has(row.rowId)) {
      continue
    }
    projected.push(row)
    seen.add(row.rowId)
  }
  return projected
}

function patchProjectedRowsByIdentity<T>(
  inputRows: readonly DataGridRowNode<T>[],
  byId: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
): DataGridRowNode<T>[] {
  const patched: DataGridRowNode<T>[] = []
  for (const row of inputRows) {
    const next = byId.get(row.rowId)
    if (!next) {
      patched.push(row)
      continue
    }
    if (row.data === next.data && row.row === next.row) {
      patched.push(row)
      continue
    }
    patched.push({
      ...row,
      data: next.data,
      row: next.row,
    })
  }
  return patched
}

function createRowVersionIndex<T>(rows: readonly DataGridRowNode<T>[]): Map<DataGridRowId, number> {
  const versions = new Map<DataGridRowId, number>()
  for (const row of rows) {
    versions.set(row.rowId, 0)
  }
  return versions
}

function rebuildRowVersionIndex<T>(
  previous: ReadonlyMap<DataGridRowId, number>,
  rows: readonly DataGridRowNode<T>[],
): Map<DataGridRowId, number> {
  const versions = new Map<DataGridRowId, number>()
  for (const row of rows) {
    versions.set(
      row.rowId,
      previous.has(row.rowId)
        ? ((previous.get(row.rowId) ?? 0) + 1)
        : 0,
    )
  }
  return versions
}

function bumpRowVersions(
  versions: Map<DataGridRowId, number>,
  rowIds: readonly DataGridRowId[],
): void {
  for (const rowId of rowIds) {
    versions.set(rowId, (versions.get(rowId) ?? 0) + 1)
  }
}

function pruneSortCacheRows<T, V>(
  cache: Map<DataGridRowId, V>,
  rows: readonly DataGridRowNode<T>[],
): void {
  const activeRowIds = new Set<DataGridRowId>()
  for (const row of rows) {
    activeRowIds.add(row.rowId)
  }
  for (const rowId of cache.keys()) {
    if (!activeRowIds.has(rowId)) {
      cache.delete(rowId)
    }
  }
}

function enforceCacheCap<K, V>(
  cache: Map<K, V>,
  maxSize: number,
): void {
  if (maxSize <= 0 || cache.size <= maxSize) {
    return
  }
  while (cache.size > maxSize) {
    const next = cache.keys().next()
    if (next.done) {
      break
    }
    cache.delete(next.value)
  }
}

function normalizeTreePathSegments(raw: readonly (string | number)[]): string[] {
  const segments: string[] = []
  for (const value of raw) {
    const normalized = String(value).trim()
    if (normalized.length === 0) {
      continue
    }
    segments.push(normalized)
  }
  return segments
}

interface TreePathBranch<T> {
  key: string
  value: string
  level: number
  groups: Map<string, TreePathBranch<T>>
  leaves: DataGridRowNode<T>[]
  matchedLeaves: number
}

interface TreeProjectionDiagnostics {
  orphans: number
  cycles: number
}

interface TreeProjectionResult<T> {
  rows: DataGridRowNode<T>[]
  diagnostics: TreeProjectionDiagnostics
}

interface TreePathProjectionCache<T> {
  diagnostics: TreeProjectionDiagnostics
  rootGroups: Map<string, TreePathBranch<T>>
  branchByKey: Map<string, TreePathBranch<T>>
  branchParentByKey: Map<string, string | null>
  branchPathByLeafRowId: Map<DataGridRowId, readonly string[]>
  rootLeaves: DataGridRowNode<T>[]
  matchedLeafRowIds: Set<DataGridRowId>
  leafOnlyRows: DataGridRowNode<T>[]
  aggregatesByGroupKey: Map<string, Record<string, unknown>>
  aggregateStateByGroupKey?: Map<string, DataGridIncrementalAggregationGroupState>
  leafContributionById?: Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>
  dirtyBranchKeys: Set<string>
}

interface TreeParentProjectionCache<T> {
  diagnostics: TreeProjectionDiagnostics
  rowById: Map<DataGridRowId, DataGridRowNode<T>>
  parentById: Map<DataGridRowId, DataGridRowId | null>
  includedChildrenById: Map<DataGridRowId, DataGridRowId[]>
  groupRowIdByGroupKey: Map<string, DataGridRowId>
  rootIncluded: DataGridRowId[]
  aggregatesByGroupRowId: Map<DataGridRowId, Record<string, unknown>>
  aggregateStateByGroupRowId?: Map<DataGridRowId, DataGridIncrementalAggregationGroupState>
  leafContributionById?: Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>
  dirtyBranchRootIds: Set<DataGridRowId>
}

interface TreePathProjectionCacheState<T> {
  key: string
  cache: TreePathProjectionCache<T>
}

interface TreeParentProjectionCacheState<T> {
  key: string
  cache: TreeParentProjectionCache<T>
}

function patchTreePathProjectionCacheRowsByIdentity<T>(
  cache: TreePathProjectionCache<T>,
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  changedRowIds: readonly DataGridRowId[] = [],
): TreePathProjectionCache<T> {
  cache.rootLeaves = patchProjectedRowsByIdentity(cache.rootLeaves, sourceById)
  cache.leafOnlyRows = patchProjectedRowsByIdentity(cache.leafOnlyRows, sourceById)
  const patchBranch = (branch: TreePathBranch<T>) => {
    branch.leaves = patchProjectedRowsByIdentity(branch.leaves, sourceById)
    for (const child of branch.groups.values()) {
      patchBranch(child)
    }
  }
  for (const branch of cache.rootGroups.values()) {
    patchBranch(branch)
  }
  for (const rowId of changedRowIds) {
    const branchPath = cache.branchPathByLeafRowId.get(rowId)
    if (!branchPath) {
      continue
    }
    for (const branchKey of branchPath) {
      cache.dirtyBranchKeys.add(branchKey)
    }
  }
  return cache
}

function patchTreeParentProjectionCacheRowsByIdentity<T>(
  cache: TreeParentProjectionCache<T>,
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  changedRowIds: readonly DataGridRowId[] = [],
): TreeParentProjectionCache<T> {
  for (const [rowId, row] of cache.rowById.entries()) {
    const next = sourceById.get(rowId)
    if (!next || (next.data === row.data && next.row === row.row)) {
      continue
    }
    cache.rowById.set(rowId, normalizeLeafRow(next))
  }
  for (const rowId of changedRowIds) {
    let cursor: DataGridRowId | null = rowId
    while (cursor != null) {
      cache.dirtyBranchRootIds.add(cursor)
      cursor = cache.parentById.get(cursor) ?? null
    }
  }
  return cache
}

function createTreePathGroupKey(segments: readonly string[]): string {
  let encoded = "tree:path:"
  for (const segment of segments) {
    encoded += `${segment.length}:${segment}`
  }
  return encoded
}

function buildTreePathProjectionCache<T>(
  inputRows: readonly DataGridRowNode<T>[],
  treeData: Extract<DataGridTreeDataResolvedSpec<T>, { mode: "path" }>,
  rowMatchesFilter: (row: DataGridRowNode<T>) => boolean,
  computeAggregates?: (rows: readonly DataGridRowNode<T>[]) => Record<string, unknown> | null,
  aggregationBasis: "filtered" | "source" = "filtered",
  createLeafContribution?: (
    row: DataGridRowNode<T>,
  ) => DataGridIncrementalAggregationLeafContribution | null,
  createEmptyGroupState?: () => DataGridIncrementalAggregationGroupState | null,
  applyContributionDelta?: (
    groupState: DataGridIncrementalAggregationGroupState,
    previous: DataGridIncrementalAggregationLeafContribution | null,
    next: DataGridIncrementalAggregationLeafContribution | null,
  ) => void,
  finalizeGroupState?: (groupState: DataGridIncrementalAggregationGroupState) => Record<string, unknown>,
): TreePathProjectionCache<T> {
  const diagnostics: TreeProjectionDiagnostics = {
    orphans: 0,
    cycles: 0,
  }
  const rootGroups = new Map<string, TreePathBranch<T>>()
  const branchByKey = new Map<string, TreePathBranch<T>>()
  const branchParentByKey = new Map<string, string | null>()
  const branchPathByLeafRowId = new Map<DataGridRowId, readonly string[]>()
  const rootLeaves: DataGridRowNode<T>[] = []
  const matchedLeafRowIds = new Set<DataGridRowId>()
  const leafOnlyRows: DataGridRowNode<T>[] = []
  const aggregatesByGroupKey = new Map<string, Record<string, unknown>>()
  const leafContributionById = (computeAggregates || createLeafContribution)
    ? new Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>()
    : undefined
  const aggregateStateByGroupKey = (
    createLeafContribution &&
    createEmptyGroupState &&
    applyContributionDelta &&
    finalizeGroupState
  )
    ? new Map<string, DataGridIncrementalAggregationGroupState>()
    : undefined
  const dirtyBranchKeys = new Set<string>()

  for (const row of inputRows) {
    const normalizedLeaf = normalizeLeafRow(row)
    const path = normalizeTreePathSegments(treeData.getDataPath(normalizedLeaf.data, normalizedLeaf.sourceIndex))
    const matches = rowMatchesFilter(normalizedLeaf)
    if (matches) {
      matchedLeafRowIds.add(normalizedLeaf.rowId)
      leafOnlyRows.push(normalizedLeaf)
    }
    if (path.length === 0) {
      rootLeaves.push(normalizedLeaf)
      continue
    }
    let currentGroups = rootGroups
    const traversed: TreePathBranch<T>[] = []
    const keySegments: string[] = []
    for (let level = 0; level < path.length; level += 1) {
      const value = path[level] ?? ""
      keySegments.push(value)
      const groupKey = createTreePathGroupKey(keySegments)
      const existing = currentGroups.get(value)
      if (existing) {
        traversed.push(existing)
        currentGroups = existing.groups
        continue
      }
      const parentBranch = traversed[traversed.length - 1]
      const next: TreePathBranch<T> = {
        key: groupKey,
        value,
        level,
        groups: new Map<string, TreePathBranch<T>>(),
        leaves: [],
        matchedLeaves: 0,
      }
      currentGroups.set(value, next)
      branchByKey.set(groupKey, next)
      branchParentByKey.set(groupKey, parentBranch ? parentBranch.key : null)
      traversed.push(next)
      currentGroups = next.groups
    }
    const target = traversed[traversed.length - 1]
    if (target) {
      target.leaves.push(normalizedLeaf)
      branchPathByLeafRowId.set(normalizedLeaf.rowId, traversed.map(branch => branch.key))
    }
    if (leafContributionById && createLeafContribution && (aggregationBasis === "source" || matches)) {
      const contribution = createLeafContribution(normalizedLeaf)
      if (contribution) {
        leafContributionById.set(normalizedLeaf.rowId, contribution)
      }
    }
    for (const branch of traversed) {
      if (matches) {
        branch.matchedLeaves += 1
      }
    }
  }

  if (
    aggregateStateByGroupKey &&
    leafContributionById &&
    createEmptyGroupState &&
    applyContributionDelta &&
    finalizeGroupState
  ) {
    const collectBranchContributions = (
      branch: TreePathBranch<T>,
    ): DataGridIncrementalAggregationLeafContribution[] => {
      const contributions: DataGridIncrementalAggregationLeafContribution[] = []
      for (const child of branch.groups.values()) {
        contributions.push(...collectBranchContributions(child))
      }
      for (const leaf of branch.leaves) {
        if (aggregationBasis !== "source" && !matchedLeafRowIds.has(leaf.rowId)) {
          continue
        }
        const contribution = leafContributionById.get(leaf.rowId)
        if (contribution) {
          contributions.push(contribution)
        }
      }
      const groupState = createEmptyGroupState()
      if (!groupState) {
        return contributions
      }
      for (const contribution of contributions) {
        applyContributionDelta(groupState, null, contribution)
      }
      aggregateStateByGroupKey.set(branch.key, groupState)
      const aggregates = finalizeGroupState(groupState)
      if (Object.keys(aggregates).length > 0) {
        aggregatesByGroupKey.set(branch.key, { ...aggregates })
      }
      return contributions
    }
    for (const branch of rootGroups.values()) {
      collectBranchContributions(branch)
    }
  } else if (computeAggregates) {
    const collectBranchLeaves = (branch: TreePathBranch<T>): DataGridRowNode<T>[] => {
      const leafRows: DataGridRowNode<T>[] = []
      for (const child of branch.groups.values()) {
        leafRows.push(...collectBranchLeaves(child))
      }
      for (const leaf of branch.leaves) {
        if (aggregationBasis === "source" || matchedLeafRowIds.has(leaf.rowId)) {
          leafRows.push(leaf)
        }
      }
      if (leafRows.length === 0) {
        return leafRows
      }
      const aggregates = computeAggregates(leafRows)
      if (aggregates && Object.keys(aggregates).length > 0) {
        aggregatesByGroupKey.set(branch.key, { ...aggregates })
      }
      return leafRows
    }
    for (const branch of rootGroups.values()) {
      collectBranchLeaves(branch)
    }
  }

  return {
    diagnostics,
    rootGroups,
    branchByKey,
    branchParentByKey,
    branchPathByLeafRowId,
    rootLeaves,
    matchedLeafRowIds,
    leafOnlyRows,
    aggregatesByGroupKey,
    aggregateStateByGroupKey,
    leafContributionById,
    dirtyBranchKeys,
  }
}

function createTreePathGroupNode<T>(
  branch: TreePathBranch<T>,
  expanded: boolean,
  aggregates?: Record<string, unknown>,
): DataGridRowNode<T> {
  const rowData = ({
    __tree: true,
    key: branch.key,
    value: branch.value,
    level: branch.level,
  } as unknown as T)
  return {
    kind: "group",
    data: rowData,
    row: rowData,
    rowKey: branch.key,
    rowId: branch.key,
    sourceIndex: 0,
    originalIndex: 0,
    displayIndex: -1,
    state: {
      selected: false,
      group: true,
      pinned: "none",
      expanded,
    },
    groupMeta: {
      groupKey: branch.key,
      groupField: "path",
      groupValue: branch.value,
      level: branch.level,
      childrenCount: branch.matchedLeaves,
      ...(aggregates ? { aggregates } : {}),
    },
  }
}

function appendTreePathBranch<T>(
  cache: TreePathProjectionCache<T>,
  branch: TreePathBranch<T>,
  expansionSnapshot: ReturnType<typeof buildGroupExpansionSnapshot>,
  expansionToggledKeys: ReadonlySet<string>,
  output: DataGridRowNode<T>[],
): void {
  // Path mode filter markers are leaf-driven. Synthetic path groups do not evaluate
  // row predicates directly, so include-parents/include-descendants share the same
  // branch visibility rule: keep ancestor chain for matched leaves.
  if (branch.matchedLeaves <= 0) {
    return
  }
  const expanded = isGroupExpanded(expansionSnapshot, branch.key, expansionToggledKeys)
  output.push(createTreePathGroupNode(branch, expanded, cache.aggregatesByGroupKey.get(branch.key)))
  if (!expanded) {
    return
  }
  appendTreePathBranchChildren(cache, branch, expansionSnapshot, expansionToggledKeys, output)
}

function appendTreePathBranchChildren<T>(
  cache: TreePathProjectionCache<T>,
  branch: TreePathBranch<T>,
  expansionSnapshot: ReturnType<typeof buildGroupExpansionSnapshot>,
  expansionToggledKeys: ReadonlySet<string>,
  output: DataGridRowNode<T>[],
): void {
  for (const child of branch.groups.values()) {
    appendTreePathBranch(cache, child, expansionSnapshot, expansionToggledKeys, output)
  }
  for (const leaf of branch.leaves) {
    if (cache.matchedLeafRowIds.has(leaf.rowId)) {
      output.push(leaf)
    }
  }
}

function materializeTreePathProjection<T>(
  cache: TreePathProjectionCache<T>,
  expansionSnapshot: ReturnType<typeof buildGroupExpansionSnapshot>,
  filterMode: DataGridTreeDataFilterMode,
  precomputedExpansionToggledKeys?: ReadonlySet<string>,
): TreeProjectionResult<T> {
  if (filterMode === "leaf-only") {
    return {
      rows: cache.leafOnlyRows,
      diagnostics: cache.diagnostics,
    }
  }
  const projected: DataGridRowNode<T>[] = []
  const expansionToggledKeys = precomputedExpansionToggledKeys ?? new Set<string>(expansionSnapshot.toggledGroupKeys)
  for (const branch of cache.rootGroups.values()) {
    appendTreePathBranch(cache, branch, expansionSnapshot, expansionToggledKeys, projected)
  }
  for (const leaf of cache.rootLeaves) {
    if (cache.matchedLeafRowIds.has(leaf.rowId)) {
      projected.push(leaf)
    }
  }
  return {
    rows: projected,
    diagnostics: cache.diagnostics,
  }
}

function buildTreeProjectionCacheKey<T>(
  treeCacheRevision: number,
  filterRevision: number,
  sortRevision: number,
  treeData: DataGridTreeDataResolvedSpec<T>,
): string {
  return [
    treeCacheRevision,
    filterRevision,
    sortRevision,
    treeData.mode,
    treeData.filterMode,
  ].join(":")
}

function isTreePathSpec<T>(
  treeData: DataGridTreeDataResolvedSpec<T>,
): treeData is Extract<DataGridTreeDataResolvedSpec<T>, { mode: "path" }> {
  return treeData.mode === "path"
}

function projectTreeDataRowsFromCache<T>(
  inputRows: readonly DataGridRowNode<T>[],
  treeData: DataGridTreeDataResolvedSpec<T>,
  expansionSnapshot: ReturnType<typeof buildGroupExpansionSnapshot>,
  expansionToggledKeys: ReadonlySet<string> | undefined,
  rowMatchesFilter: (row: DataGridRowNode<T>) => boolean,
  pathCacheState: TreePathProjectionCacheState<T> | null,
  parentCacheState: TreeParentProjectionCacheState<T> | null,
  cacheKey: string,
  computeAggregates?: (rows: readonly DataGridRowNode<T>[]) => Record<string, unknown> | null,
  aggregationBasis: "filtered" | "source" = "filtered",
  createLeafContribution?: (
    row: DataGridRowNode<T>,
  ) => DataGridIncrementalAggregationLeafContribution | null,
  createEmptyGroupState?: () => DataGridIncrementalAggregationGroupState | null,
  applyContributionDelta?: (
    groupState: DataGridIncrementalAggregationGroupState,
    previous: DataGridIncrementalAggregationLeafContribution | null,
    next: DataGridIncrementalAggregationLeafContribution | null,
  ) => void,
  finalizeGroupState?: (groupState: DataGridIncrementalAggregationGroupState) => Record<string, unknown>,
): {
    result: TreeProjectionResult<T>
    pathCache: TreePathProjectionCacheState<T> | null
    parentCache: TreeParentProjectionCacheState<T> | null
  } {
  if (isTreePathSpec(treeData)) {
    const nextPathCacheState = pathCacheState?.key === cacheKey
      ? pathCacheState
      : {
        key: cacheKey,
          cache: buildTreePathProjectionCache(
            inputRows,
            treeData,
            rowMatchesFilter,
            computeAggregates,
            aggregationBasis,
            createLeafContribution,
            createEmptyGroupState,
            applyContributionDelta,
            finalizeGroupState,
          ),
        }
    return {
      result: materializeTreePathProjection(
        nextPathCacheState.cache,
        expansionSnapshot,
        treeData.filterMode,
        expansionToggledKeys,
      ),
      pathCache: nextPathCacheState,
      parentCache: parentCacheState,
    }
  }

  const nextParentCacheState = parentCacheState?.key === cacheKey
    ? parentCacheState
    : {
        key: cacheKey,
        cache: buildTreeParentProjectionCache(
          inputRows,
          treeData,
          rowMatchesFilter,
          computeAggregates,
          aggregationBasis,
          createLeafContribution,
          createEmptyGroupState,
          applyContributionDelta,
          finalizeGroupState,
        ),
      }
  return {
    result: materializeTreeParentProjection(nextParentCacheState.cache, expansionSnapshot, expansionToggledKeys),
    pathCache: pathCacheState,
    parentCache: nextParentCacheState,
  }
}

function createTreeParentGroupKey(rowId: DataGridRowId): string {
  return `tree:parent:${String(rowId)}`
}

function buildTreeParentProjectionCache<T>(
  inputRows: readonly DataGridRowNode<T>[],
  treeData: Extract<DataGridTreeDataResolvedSpec<T>, { mode: "parent" }>,
  rowMatchesFilter: (row: DataGridRowNode<T>) => boolean,
  computeAggregates?: (rows: readonly DataGridRowNode<T>[]) => Record<string, unknown> | null,
  aggregationBasis: "filtered" | "source" = "filtered",
  createLeafContribution?: (
    row: DataGridRowNode<T>,
  ) => DataGridIncrementalAggregationLeafContribution | null,
  createEmptyGroupState?: () => DataGridIncrementalAggregationGroupState | null,
  applyContributionDelta?: (
    groupState: DataGridIncrementalAggregationGroupState,
    previous: DataGridIncrementalAggregationLeafContribution | null,
    next: DataGridIncrementalAggregationLeafContribution | null,
  ) => void,
  finalizeGroupState?: (groupState: DataGridIncrementalAggregationGroupState) => Record<string, unknown>,
): TreeParentProjectionCache<T> {
  const diagnostics: TreeProjectionDiagnostics = {
    orphans: 0,
    cycles: 0,
  }
  const rowById = new Map<DataGridRowId, DataGridRowNode<T>>()
  for (const row of inputRows) {
    rowById.set(row.rowId, normalizeLeafRow(row))
  }
  const rawParentById = new Map<DataGridRowId, DataGridRowId | null>()
  const dropped = new Set<DataGridRowId>()

  for (const row of inputRows) {
    const rowId = row.rowId
    const resolved = treeData.getParentId(row.data, row.sourceIndex)
    let parentId: DataGridRowId | null =
      resolved == null
        ? null
        : (isDataGridRowId(resolved) ? resolved : null)
    if (treeData.rootParentId != null && parentId === treeData.rootParentId) {
      parentId = null
    }
    if (parentId != null && !rowById.has(parentId)) {
      diagnostics.orphans += 1
      if (treeData.orphanPolicy === "drop") {
        dropped.add(rowId)
        continue
      }
      if (treeData.orphanPolicy === "error") {
        throw new Error(`[DataGridTreeData] Orphan row '${String(rowId)}' has missing parent '${String(parentId)}'.`)
      }
      parentId = null
    }
    if (parentId === rowId) {
      diagnostics.cycles += 1
      if (treeData.cyclePolicy === "error") {
        throw new Error(`[DataGridTreeData] Self-cycle for row '${String(rowId)}'.`)
      }
      parentId = null
    }
    rawParentById.set(rowId, parentId)
  }

  for (const row of inputRows) {
    if (dropped.has(row.rowId)) {
      continue
    }
    const rowId = row.rowId
    let parentId = rawParentById.get(rowId) ?? null
    if (parentId == null) {
      continue
    }
    const visited = new Set<DataGridRowId>([rowId])
    let cursor: DataGridRowId | null = parentId
    while (cursor != null) {
      if (visited.has(cursor)) {
        diagnostics.cycles += 1
        if (treeData.cyclePolicy === "error") {
          throw new Error(`[DataGridTreeData] Cycle detected for row '${String(rowId)}'.`)
        }
        parentId = null
        break
      }
      visited.add(cursor)
      cursor = rawParentById.get(cursor) ?? null
    }
    if (parentId == null) {
      rawParentById.set(rowId, null)
    }
  }

  const childrenById = new Map<DataGridRowId | null, DataGridRowId[]>()
  const pushChild = (parentId: DataGridRowId | null, rowId: DataGridRowId) => {
    const bucket = childrenById.get(parentId)
    if (bucket) {
      bucket.push(rowId)
      return
    }
    childrenById.set(parentId, [rowId])
  }
  for (const row of inputRows) {
    if (dropped.has(row.rowId)) {
      continue
    }
    const parentId = rawParentById.get(row.rowId) ?? null
    pushChild(parentId, row.rowId)
  }

  const matchedIds = new Set<DataGridRowId>()
  for (const row of inputRows) {
    if (dropped.has(row.rowId)) {
      continue
    }
    if (rowMatchesFilter(row)) {
      matchedIds.add(row.rowId)
    }
  }

  const includeIds = new Set<DataGridRowId>()
  const includeWithAncestors = (rowId: DataGridRowId) => {
    includeIds.add(rowId)
    let cursor = rawParentById.get(rowId) ?? null
    while (cursor != null) {
      includeIds.add(cursor)
      cursor = rawParentById.get(cursor) ?? null
    }
  }
  const includeDescendants = (rowId: DataGridRowId) => {
    const stack: DataGridRowId[] = [rowId]
    const visited = new Set<DataGridRowId>()
    while (stack.length > 0) {
      const current = stack.pop()
      if (typeof current === "undefined" || visited.has(current)) {
        continue
      }
      visited.add(current)
      includeIds.add(current)
      const children = childrenById.get(current) ?? []
      for (const childId of children) {
        stack.push(childId)
      }
    }
  }

  if (treeData.filterMode === "leaf-only") {
    for (const rowId of matchedIds) {
      const children = childrenById.get(rowId) ?? []
      if (children.length === 0) {
        includeIds.add(rowId)
      }
    }
  } else if (treeData.filterMode === "include-descendants") {
    for (const rowId of matchedIds) {
      includeWithAncestors(rowId)
      includeDescendants(rowId)
    }
  } else {
    for (const rowId of matchedIds) {
      includeWithAncestors(rowId)
    }
  }

  if (includeIds.size === 0) {
    return {
      diagnostics,
      rowById,
      parentById: new Map<DataGridRowId, DataGridRowId | null>(),
      includedChildrenById: new Map<DataGridRowId, DataGridRowId[]>(),
      groupRowIdByGroupKey: new Map<string, DataGridRowId>(),
      rootIncluded: [],
      aggregatesByGroupRowId: new Map<DataGridRowId, Record<string, unknown>>(),
      aggregateStateByGroupRowId: new Map<DataGridRowId, DataGridIncrementalAggregationGroupState>(),
      leafContributionById: (computeAggregates || createLeafContribution)
        ? new Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>()
        : undefined,
      dirtyBranchRootIds: new Set<DataGridRowId>(),
    }
  }

  const parentById = new Map<DataGridRowId, DataGridRowId | null>()
  for (const rowId of includeIds) {
    parentById.set(rowId, rawParentById.get(rowId) ?? null)
  }

  const includedChildrenById = new Map<DataGridRowId, DataGridRowId[]>()
  for (const rowId of includeIds) {
    const children = childrenById.get(rowId) ?? []
    if (children.length === 0) {
      continue
    }
    const includedChildren = children.filter(childId => includeIds.has(childId))
    if (includedChildren.length > 0) {
      includedChildrenById.set(rowId, includedChildren)
    }
  }

  const rootIncluded: DataGridRowId[] = []
  for (const row of inputRows) {
    const rowId = row.rowId
    if (!includeIds.has(rowId)) {
      continue
    }
    const parentId = rawParentById.get(rowId) ?? null
    if (parentId == null || !includeIds.has(parentId)) {
      rootIncluded.push(rowId)
    }
  }

  const groupRowIdByGroupKey = new Map<string, DataGridRowId>()
  for (const [rowId, children] of includedChildrenById.entries()) {
    if (children.length === 0) {
      continue
    }
    groupRowIdByGroupKey.set(createTreeParentGroupKey(rowId), rowId)
  }

  const aggregatesByGroupRowId = new Map<DataGridRowId, Record<string, unknown>>()
  const aggregateStateByGroupRowId = (
    createLeafContribution &&
    createEmptyGroupState &&
    applyContributionDelta &&
    finalizeGroupState
  )
    ? new Map<DataGridRowId, DataGridIncrementalAggregationGroupState>()
    : undefined
  const leafContributionById = (computeAggregates || createLeafContribution)
    ? new Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>()
    : undefined
  if (
    aggregateStateByGroupRowId &&
    leafContributionById &&
    createLeafContribution &&
    createEmptyGroupState &&
    applyContributionDelta &&
    finalizeGroupState
  ) {
    const aggregateChildrenById = aggregationBasis === "source"
      ? childrenById
      : includedChildrenById
    const collectLeafContributions = (
      rowId: DataGridRowId,
    ): DataGridIncrementalAggregationLeafContribution[] => {
      const children = aggregateChildrenById.get(rowId) ?? []
      if (children.length === 0) {
        const leaf = rowById.get(rowId)
        if (!leaf) {
          return []
        }
        const contribution = createLeafContribution(leaf)
        if (!contribution) {
          return []
        }
        leafContributionById.set(rowId, contribution)
        return [contribution]
      }
      const contributions: DataGridIncrementalAggregationLeafContribution[] = []
      for (const childId of children) {
        contributions.push(...collectLeafContributions(childId))
      }
      const groupState = createEmptyGroupState()
      if (!groupState) {
        return contributions
      }
      for (const contribution of contributions) {
        applyContributionDelta(groupState, null, contribution)
      }
      aggregateStateByGroupRowId.set(rowId, groupState)
      const aggregates = finalizeGroupState(groupState)
      if (Object.keys(aggregates).length > 0) {
        aggregatesByGroupRowId.set(rowId, { ...aggregates })
      }
      return contributions
    }
    for (const rootId of rootIncluded) {
      collectLeafContributions(rootId)
    }
  } else if (computeAggregates) {
    const aggregateChildrenById = aggregationBasis === "source"
      ? childrenById
      : includedChildrenById
    const leafRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()
    for (const [rowId, row] of rowById.entries()) {
      if ((aggregateChildrenById.get(rowId) ?? []).length === 0) {
        leafRowsById.set(rowId, row)
        if (leafContributionById) {
          leafContributionById.set(rowId, {})
        }
      }
    }
    const leafMemo = new Map<DataGridRowId, DataGridRowNode<T>[]>()
    const collectLeafRows = (rowId: DataGridRowId): DataGridRowNode<T>[] => {
      const cached = leafMemo.get(rowId)
      if (cached) {
        return cached
      }
      const children = aggregateChildrenById.get(rowId) ?? []
      if (children.length === 0) {
        const leaf = leafRowsById.get(rowId)
        const leafRows = leaf ? [leaf] : []
        leafMemo.set(rowId, leafRows)
        return leafRows
      }
      const leafRows: DataGridRowNode<T>[] = []
      for (const childId of children) {
        leafRows.push(...collectLeafRows(childId))
      }
      const aggregates = computeAggregates(leafRows)
      if (aggregates && Object.keys(aggregates).length > 0) {
        aggregatesByGroupRowId.set(rowId, { ...aggregates })
      }
      leafMemo.set(rowId, leafRows)
      return leafRows
    }
    for (const rootId of rootIncluded) {
      collectLeafRows(rootId)
    }
  }

  return {
    diagnostics,
    rowById,
    parentById,
    includedChildrenById,
    groupRowIdByGroupKey,
    rootIncluded,
    aggregatesByGroupRowId,
    aggregateStateByGroupRowId,
    leafContributionById,
    dirtyBranchRootIds: new Set<DataGridRowId>(),
  }
}

function createTreeParentGroupNode<T>(
  row: DataGridRowNode<T>,
  rowId: DataGridRowId,
  level: number,
  childrenCount: number,
  expanded: boolean,
  aggregates?: Record<string, unknown>,
): DataGridRowNode<T> {
  return {
    ...row,
    kind: "group",
    state: {
      ...row.state,
      group: true,
      expanded,
    },
    groupMeta: {
      groupKey: createTreeParentGroupKey(rowId),
      groupField: "parent",
      groupValue: String(rowId),
      level,
      childrenCount,
      ...(aggregates ? { aggregates } : {}),
    },
  }
}

function appendTreeParentRow<T>(
  cache: TreeParentProjectionCache<T>,
  rowId: DataGridRowId,
  level: number,
  expansionSnapshot: ReturnType<typeof buildGroupExpansionSnapshot>,
  expansionToggledKeys: ReadonlySet<string>,
  output: DataGridRowNode<T>[],
): void {
  const row = cache.rowById.get(rowId)
  if (!row) {
    return
  }
  const children = cache.includedChildrenById.get(rowId) ?? []
  if (children.length === 0) {
    output.push(row)
    return
  }
  const groupKey = createTreeParentGroupKey(rowId)
  const expanded = isGroupExpanded(expansionSnapshot, groupKey, expansionToggledKeys)
  output.push(
    createTreeParentGroupNode(
      row,
      rowId,
      level,
      children.length,
      expanded,
      cache.aggregatesByGroupRowId.get(rowId),
    ),
  )
  if (!expanded) {
    return
  }
  appendTreeParentRowChildren(cache, rowId, level, expansionSnapshot, expansionToggledKeys, output)
}

function appendTreeParentRowChildren<T>(
  cache: TreeParentProjectionCache<T>,
  rowId: DataGridRowId,
  level: number,
  expansionSnapshot: ReturnType<typeof buildGroupExpansionSnapshot>,
  expansionToggledKeys: ReadonlySet<string>,
  output: DataGridRowNode<T>[],
): void {
  const children = cache.includedChildrenById.get(rowId) ?? []
  for (const childId of children) {
    appendTreeParentRow(cache, childId, level + 1, expansionSnapshot, expansionToggledKeys, output)
  }
}

function materializeTreeParentProjection<T>(
  cache: TreeParentProjectionCache<T>,
  expansionSnapshot: ReturnType<typeof buildGroupExpansionSnapshot>,
  precomputedExpansionToggledKeys?: ReadonlySet<string>,
): TreeProjectionResult<T> {
  if (cache.rootIncluded.length === 0) {
    return {
      rows: [],
      diagnostics: cache.diagnostics,
    }
  }
  const projected: DataGridRowNode<T>[] = []
  const expansionToggledKeys = precomputedExpansionToggledKeys ?? new Set<string>(expansionSnapshot.toggledGroupKeys)
  for (const rootId of cache.rootIncluded) {
    appendTreeParentRow(cache, rootId, 0, expansionSnapshot, expansionToggledKeys, projected)
  }
  return {
    rows: projected,
    diagnostics: cache.diagnostics,
  }
}

function resolveSingleExpansionDelta(
  previousSnapshot: DataGridGroupExpansionSnapshot,
  nextSnapshot: DataGridGroupExpansionSnapshot,
): string | null {
  if (previousSnapshot.expandedByDefault !== nextSnapshot.expandedByDefault) {
    return null
  }
  const previous = new Set<string>(previousSnapshot.toggledGroupKeys)
  const next = new Set<string>(nextSnapshot.toggledGroupKeys)
  let changedKey: string | null = null
  let changedCount = 0
  for (const key of previous) {
    if (!next.has(key)) {
      changedCount += 1
      if (changedCount > 1) {
        return null
      }
      changedKey = key
    }
  }
  for (const key of next) {
    if (!previous.has(key)) {
      changedCount += 1
      if (changedCount > 1) {
        return null
      }
      changedKey = key
    }
  }
  return changedCount === 1 ? changedKey : null
}

function projectionSegmentMatches<T>(
  rows: readonly DataGridRowNode<T>[],
  startIndex: number,
  expectedRows: readonly DataGridRowNode<T>[],
): boolean {
  if (startIndex < 0 || startIndex + expectedRows.length > rows.length) {
    return false
  }
  for (let index = 0; index < expectedRows.length; index += 1) {
    const current = rows[startIndex + index]
    const expected = expectedRows[index]
    if (!current || !expected) {
      return false
    }
    if (current.rowId !== expected.rowId || current.kind !== expected.kind) {
      return false
    }
  }
  return true
}

function buildGroupRowIndexByRowId<T>(
  rows: readonly DataGridRowNode<T>[],
): Map<DataGridRowId, number> {
  const indexByRowId = new Map<DataGridRowId, number>()
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!row || row.kind !== "group") {
      continue
    }
    indexByRowId.set(row.rowId, index)
  }
  return indexByRowId
}

function resolveGroupRowIndexByRowId<T>(
  rows: readonly DataGridRowNode<T>[],
  groupRowId: DataGridRowId,
  groupIndexByRowId?: ReadonlyMap<DataGridRowId, number>,
): number {
  const indexed = groupIndexByRowId?.get(groupRowId)
  if (typeof indexed === "number") {
    const candidate = rows[indexed]
    if (candidate?.kind === "group" && candidate.rowId === groupRowId) {
      return indexed
    }
  }
  return rows.findIndex(row => row.kind === "group" && row.rowId === groupRowId)
}

function tryProjectTreePathSubtreeToggle<T>(
  rows: readonly DataGridRowNode<T>[],
  cacheState: TreePathProjectionCacheState<T>,
  treeData: Extract<DataGridTreeDataResolvedSpec<T>, { mode: "path" }>,
  previousExpansionSnapshot: DataGridGroupExpansionSnapshot,
  nextExpansionSnapshot: DataGridGroupExpansionSnapshot,
  groupIndexByRowId?: ReadonlyMap<DataGridRowId, number>,
): TreeProjectionResult<T> | null {
  if (treeData.filterMode === "leaf-only") {
    return null
  }
  const changedGroupKey = resolveSingleExpansionDelta(previousExpansionSnapshot, nextExpansionSnapshot)
  if (!changedGroupKey) {
    return null
  }
  const branch = cacheState.cache.branchByKey.get(changedGroupKey)
  if (!branch || branch.matchedLeaves <= 0) {
    return null
  }
  const previousExpanded = isGroupExpanded(previousExpansionSnapshot, changedGroupKey, new Set<string>(previousExpansionSnapshot.toggledGroupKeys))
  const nextExpanded = isGroupExpanded(nextExpansionSnapshot, changedGroupKey, new Set<string>(nextExpansionSnapshot.toggledGroupKeys))
  const groupIndex = resolveGroupRowIndexByRowId(rows, changedGroupKey, groupIndexByRowId)
  if (groupIndex < 0) {
    return null
  }

  const previousDescendants: DataGridRowNode<T>[] = []
  const previousExpandedKeys = new Set<string>(previousExpansionSnapshot.toggledGroupKeys)
  if (previousExpanded) {
    appendTreePathBranchChildren(
      cacheState.cache,
      branch,
      previousExpansionSnapshot,
      previousExpandedKeys,
      previousDescendants,
    )
  }

  const nextDescendants: DataGridRowNode<T>[] = []
  const nextExpandedKeys = new Set<string>(nextExpansionSnapshot.toggledGroupKeys)
  if (nextExpanded) {
    appendTreePathBranchChildren(
      cacheState.cache,
      branch,
      nextExpansionSnapshot,
      nextExpandedKeys,
      nextDescendants,
    )
  }

  const replaceStart = groupIndex + 1
  if (!projectionSegmentMatches(rows, replaceStart, previousDescendants)) {
    return null
  }
  const nextRows = rows.slice()
  const currentGroup = nextRows[groupIndex]
  if (currentGroup && currentGroup.kind === "group") {
    nextRows[groupIndex] = {
      ...currentGroup,
      state: {
        ...currentGroup.state,
        expanded: nextExpanded,
      },
    }
  }
  nextRows.splice(replaceStart, previousDescendants.length, ...nextDescendants)
  return {
    rows: nextRows,
    diagnostics: cacheState.cache.diagnostics,
  }
}

function tryProjectTreeParentSubtreeToggle<T>(
  rows: readonly DataGridRowNode<T>[],
  cacheState: TreeParentProjectionCacheState<T>,
  previousExpansionSnapshot: DataGridGroupExpansionSnapshot,
  nextExpansionSnapshot: DataGridGroupExpansionSnapshot,
  groupIndexByRowId?: ReadonlyMap<DataGridRowId, number>,
): TreeProjectionResult<T> | null {
  const changedGroupKey = resolveSingleExpansionDelta(previousExpansionSnapshot, nextExpansionSnapshot)
  if (!changedGroupKey) {
    return null
  }
  const rowId = cacheState.cache.groupRowIdByGroupKey.get(changedGroupKey)
  if (typeof rowId === "undefined") {
    return null
  }
  const previousExpanded = isGroupExpanded(previousExpansionSnapshot, changedGroupKey, new Set<string>(previousExpansionSnapshot.toggledGroupKeys))
  const nextExpanded = isGroupExpanded(nextExpansionSnapshot, changedGroupKey, new Set<string>(nextExpansionSnapshot.toggledGroupKeys))
  const groupIndex = resolveGroupRowIndexByRowId(rows, rowId, groupIndexByRowId)
  if (groupIndex < 0) {
    return null
  }
  const groupRow = rows[groupIndex]
  const baseLevel = groupRow?.groupMeta?.level
  if (typeof baseLevel !== "number") {
    return null
  }

  const previousDescendants: DataGridRowNode<T>[] = []
  const previousExpandedKeys = new Set<string>(previousExpansionSnapshot.toggledGroupKeys)
  if (previousExpanded) {
    appendTreeParentRowChildren(
      cacheState.cache,
      rowId,
      baseLevel,
      previousExpansionSnapshot,
      previousExpandedKeys,
      previousDescendants,
    )
  }

  const nextDescendants: DataGridRowNode<T>[] = []
  const nextExpandedKeys = new Set<string>(nextExpansionSnapshot.toggledGroupKeys)
  if (nextExpanded) {
    appendTreeParentRowChildren(
      cacheState.cache,
      rowId,
      baseLevel,
      nextExpansionSnapshot,
      nextExpandedKeys,
      nextDescendants,
    )
  }

  const replaceStart = groupIndex + 1
  if (!projectionSegmentMatches(rows, replaceStart, previousDescendants)) {
    return null
  }
  const nextRows = rows.slice()
  const currentGroup = nextRows[groupIndex]
  if (currentGroup && currentGroup.kind === "group") {
    nextRows[groupIndex] = {
      ...currentGroup,
      state: {
        ...currentGroup.state,
        expanded: nextExpanded,
      },
    }
  }
  nextRows.splice(replaceStart, previousDescendants.length, ...nextDescendants)
  return {
    rows: nextRows,
    diagnostics: cacheState.cache.diagnostics,
  }
}

function normalizeLeafRow<T>(row: DataGridRowNode<T>): DataGridRowNode<T> {
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

function assignDisplayIndexes<T>(rows: readonly DataGridRowNode<T>[]): DataGridRowNode<T>[] {
  const projected: DataGridRowNode<T>[] = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!row) {
      continue
    }
    if (row.displayIndex === index) {
      projected.push(row)
    } else {
      projected.push({
        ...row,
        displayIndex: index,
      })
    }
  }
  return projected
}

function reindexSourceRows<T>(rows: readonly DataGridRowNode<T>[]): DataGridRowNode<T>[] {
  const normalized: DataGridRowNode<T>[] = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!row) {
      continue
    }
    normalized.push({
      ...row,
      sourceIndex: index,
      originalIndex: index,
      displayIndex: index,
    })
  }
  return normalized
}

function createEmptyTreeDataDiagnostics(
  overrides?: Partial<DataGridTreeDataDiagnostics>,
): DataGridTreeDataDiagnostics {
  return {
    orphans: 0,
    cycles: 0,
    duplicates: 0,
    lastError: null,
    ...overrides,
  }
}

function findDuplicateRowIds<T>(rows: readonly DataGridRowNode<T>[]): DataGridRowId[] {
  const seen = new Set<DataGridRowId>()
  const duplicates = new Set<DataGridRowId>()
  for (const row of rows) {
    const rowId = row.rowId
    if (seen.has(rowId)) {
      duplicates.add(rowId)
      continue
    }
    seen.add(rowId)
  }
  return [...duplicates]
}

export function createClientRowModel<T>(
  options: CreateClientRowModelOptions<T> = {},
): ClientRowModel<T> {
  const structuredCloneRef = (globalThis as typeof globalThis & {
    structuredClone?: <U>(value: U) => U
  }).structuredClone

  const cloneSortModel = (input: readonly DataGridSortState[]): readonly DataGridSortState[] =>
    input.map(item => ({ ...item }))

  const cloneFilterModel = (input: DataGridFilterSnapshot | null): DataGridFilterSnapshot | null => {
    if (!input) {
      return null
    }
    if (typeof structuredCloneRef === "function") {
      try {
        return structuredCloneRef(input)
      } catch {
        // Fall through to deterministic JS clone for non-cloneable payloads.
      }
    }
    return cloneFilterSnapshot(input)
  }

  const resolveRowId = options.resolveRowId
  const treeData = normalizeTreeDataSpec(options.initialTreeData ?? null)
  const projectionPolicy = options.projectionPolicy ?? createDataGridProjectionPolicy({
    performanceMode: options.performanceMode,
    dependencies: options.fieldDependencies,
  })
  if (options.projectionPolicy && Array.isArray(options.fieldDependencies)) {
    for (const dependency of options.fieldDependencies) {
      projectionPolicy.dependencyGraph.registerDependency(
        dependency.sourceField,
        dependency.dependentField,
      )
    }
  }
  let treeDataDiagnostics: DataGridTreeDataDiagnostics | null = treeData ? createEmptyTreeDataDiagnostics() : null

  const normalizeSourceRows = (inputRows: readonly DataGridRowNodeInput<T>[] | null | undefined): DataGridRowNode<T>[] => {
    const normalized = Array.isArray(inputRows)
      ? reindexSourceRows(inputRows.map((row, index) => normalizeRowNode(withResolvedRowIdentity(row, index, resolveRowId), index)))
      : []
    if (!treeData) {
      return normalized
    }
    const duplicates = findDuplicateRowIds(normalized)
    if (duplicates.length === 0) {
      return normalized
    }
    const message = `[DataGridTreeData] Duplicate rowId detected (${duplicates.map(value => String(value)).join(", ")}).`
    treeDataDiagnostics = createEmptyTreeDataDiagnostics({
      duplicates: duplicates.length,
      lastError: message,
      orphans: treeDataDiagnostics?.orphans ?? 0,
      cycles: treeDataDiagnostics?.cycles ?? 0,
    })
    throw new Error(message)
  }

  let sourceRows: DataGridRowNode<T>[] = normalizeSourceRows(options.rows ?? [])
  const runtimeStateStore = createClientRowRuntimeStateStore<T>()
  const runtimeState = runtimeStateStore.state
  let sortModel: readonly DataGridSortState[] = options.initialSortModel ? cloneSortModel(options.initialSortModel) : []
  let filterModel: DataGridFilterSnapshot | null = cloneFilterModel(options.initialFilterModel ?? null)
  let groupBy: DataGridGroupBySpec | null = treeData
    ? null
    : normalizeGroupBySpec(options.initialGroupBy ?? null)
  let aggregationModel: DataGridAggregationModel<T> | null = cloneAggregationModel(options.initialAggregationModel ?? null)
  const aggregationEngine = createDataGridAggregationEngine<T>(aggregationModel)
  let expansionExpandedByDefault = Boolean(treeData?.expandedByDefault ?? groupBy?.expandedByDefault)
  let paginationInput = normalizePaginationInput(options.initialPagination ?? null)
  let pagination = buildPaginationSnapshot(0, paginationInput)
  const toggledGroupKeys = new Set<string>()
  let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, runtimeState.rows.length)
  const lifecycle = createClientRowLifecycle<T>()
  let cachedFilterPredicateKey = "__none__"
  let cachedFilterPredicate: ((rowNode: DataGridRowNode<T>) => boolean) | null = null
  let rowVersionById = createRowVersionIndex(sourceRows)
  const sortValueCache = new Map<DataGridRowId, SortValueCacheEntry>()
  let sortValueCacheKey = "__none__"
  const groupValueCache = new Map<string, string>()
  let groupValueCacheKey = "__none__"
  const derivedCacheDiagnostics: DataGridClientRowModelDerivedCacheDiagnostics = {
    revisions: {
      row: runtimeState.rowRevision,
      sort: runtimeState.sortRevision,
      filter: runtimeState.filterRevision,
      group: runtimeState.groupRevision,
    },
    filterPredicateHits: 0,
    filterPredicateMisses: 0,
    sortValueHits: 0,
    sortValueMisses: 0,
    groupValueHits: 0,
    groupValueMisses: 0,
  }
  let treeCacheRevision = 0
  let treePathProjectionCacheState: TreePathProjectionCacheState<T> | null = null
  let treeParentProjectionCacheState: TreeParentProjectionCacheState<T> | null = null
  let groupByAggregateStateByGroupKey = new Map<string, DataGridIncrementalAggregationGroupState>()
  let groupByAggregatesByGroupKey = new Map<string, Record<string, unknown>>()
  let groupByAggregatePathByRowId = new Map<DataGridRowId, readonly string[]>()
  let groupByLeafContributionByRowId = new Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>()
  let groupedProjectionGroupIndexByRowId = new Map<DataGridRowId, number>()
  let lastTreeProjectionCacheKey: string | null = null
  let lastTreeExpansionSnapshot: DataGridGroupExpansionSnapshot | null = null
  const projectionEngine = createClientRowProjectionEngine<T>()

  function ensureActive() {
    lifecycle.ensureActive()
  }

  function invalidateTreeProjectionCaches(): void {
    treeCacheRevision += 1
    treePathProjectionCacheState = null
    treeParentProjectionCacheState = null
    lastTreeProjectionCacheKey = null
    lastTreeExpansionSnapshot = null
  }

  function patchTreeProjectionCacheRowsByIdentity(changedRowIds: readonly DataGridRowId[] = []): void {
    if (!treeData || (!treePathProjectionCacheState && !treeParentProjectionCacheState)) {
      return
    }
    const sourceById = buildRowIdIndex(sourceRows)
    if (treePathProjectionCacheState) {
      treePathProjectionCacheState = {
        key: treePathProjectionCacheState.key,
        cache: patchTreePathProjectionCacheRowsByIdentity(
          treePathProjectionCacheState.cache,
          sourceById,
          changedRowIds,
        ),
      }
    }
    if (treeParentProjectionCacheState) {
      treeParentProjectionCacheState = {
        key: treeParentProjectionCacheState.key,
        cache: patchTreeParentProjectionCacheRowsByIdentity(
          treeParentProjectionCacheState.cache,
          sourceById,
          changedRowIds,
        ),
      }
    }
  }

  function resetGroupByIncrementalAggregationState(): void {
    groupByAggregateStateByGroupKey = new Map<string, DataGridIncrementalAggregationGroupState>()
    groupByAggregatesByGroupKey = new Map<string, Record<string, unknown>>()
    groupByAggregatePathByRowId = new Map<DataGridRowId, readonly string[]>()
    groupByLeafContributionByRowId = new Map<DataGridRowId, DataGridIncrementalAggregationLeafContribution>()
  }

  function patchRuntimeGroupAggregates(
    resolveAggregates: (groupKey: string) => Record<string, unknown> | undefined,
  ): void {
    runtimeState.groupedRowsProjection = patchGroupRowsAggregatesByGroupKey(
      runtimeState.groupedRowsProjection,
      resolveAggregates,
    )
    runtimeState.aggregatedRowsProjection = patchGroupRowsAggregatesByGroupKey(
      runtimeState.aggregatedRowsProjection,
      resolveAggregates,
    )
    runtimeState.paginatedRowsProjection = patchGroupRowsAggregatesByGroupKey(
      runtimeState.paginatedRowsProjection,
      resolveAggregates,
    )
    runtimeState.rows = patchGroupRowsAggregatesByGroupKey(runtimeState.rows, resolveAggregates)
  }

  function applyIncrementalGroupByAggregationDelta(
    changedRowIds: readonly DataGridRowId[],
    previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  ): boolean {
    if (
      groupByAggregateStateByGroupKey.size === 0 ||
      groupByAggregatePathByRowId.size === 0 ||
      !aggregationEngine.isIncrementalAggregationSupported()
    ) {
      return false
    }
    const sourceById = buildRowIdIndex(sourceRows)
    const dirtyGroupKeys = new Set<string>()
    for (const rowId of changedRowIds) {
      const groupPath = groupByAggregatePathByRowId.get(rowId)
      if (!groupPath || groupPath.length === 0) {
        continue
      }
      const previousRow = previousRowsById.get(rowId)
      const previousContribution = groupByLeafContributionByRowId.get(rowId)
        ?? (previousRow ? aggregationEngine.createLeafContribution(previousRow) : null)
      const nextRow = sourceById.get(rowId)
      const nextContribution = nextRow
        ? aggregationEngine.createLeafContribution(nextRow)
        : null
      if (nextContribution) {
        groupByLeafContributionByRowId.set(rowId, nextContribution)
      } else {
        groupByLeafContributionByRowId.delete(rowId)
      }
      for (const groupKey of groupPath) {
        const state = groupByAggregateStateByGroupKey.get(groupKey)
        if (!state) {
          continue
        }
        aggregationEngine.applyContributionDelta(
          state,
          previousContribution ?? null,
          nextContribution,
        )
        dirtyGroupKeys.add(groupKey)
      }
    }
    if (dirtyGroupKeys.size === 0) {
      return false
    }
    for (const groupKey of dirtyGroupKeys) {
      const state = groupByAggregateStateByGroupKey.get(groupKey)
      if (!state) {
        continue
      }
      const aggregates = aggregationEngine.finalizeGroupState(state)
      if (Object.keys(aggregates).length > 0) {
        groupByAggregatesByGroupKey.set(groupKey, aggregates)
      } else {
        groupByAggregatesByGroupKey.delete(groupKey)
      }
    }
    patchRuntimeGroupAggregates(groupKey => groupByAggregatesByGroupKey.get(groupKey))
    return true
  }

  function applyIncrementalTreePathAggregationDelta(
    changedRowIds: readonly DataGridRowId[],
    previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  ): boolean {
    const cache = treePathProjectionCacheState?.cache
    if (
      !cache ||
      !cache.aggregateStateByGroupKey ||
      !cache.leafContributionById ||
      !aggregationEngine.isIncrementalAggregationSupported()
    ) {
      return false
    }
    const sourceById = buildRowIdIndex(sourceRows)
    const dirtyGroupKeys = new Set<string>()
    for (const rowId of changedRowIds) {
      const groupPath = cache.branchPathByLeafRowId.get(rowId)
      if (!groupPath || groupPath.length === 0) {
        continue
      }
      const previousRow = previousRowsById.get(rowId)
      const previousContribution = cache.leafContributionById.get(rowId)
        ?? (previousRow ? aggregationEngine.createLeafContribution(previousRow) : null)
      const nextRow = sourceById.get(rowId)
      const nextContribution = nextRow
        ? aggregationEngine.createLeafContribution(nextRow)
        : null
      if (nextContribution) {
        cache.leafContributionById.set(rowId, nextContribution)
      } else {
        cache.leafContributionById.delete(rowId)
      }
      for (const groupKey of groupPath) {
        const state = cache.aggregateStateByGroupKey.get(groupKey)
        if (!state) {
          continue
        }
        aggregationEngine.applyContributionDelta(
          state,
          previousContribution ?? null,
          nextContribution,
        )
        dirtyGroupKeys.add(groupKey)
        cache.dirtyBranchKeys.add(groupKey)
      }
    }
    if (dirtyGroupKeys.size === 0) {
      return false
    }
    for (const groupKey of dirtyGroupKeys) {
      const state = cache.aggregateStateByGroupKey.get(groupKey)
      if (!state) {
        continue
      }
      const aggregates = aggregationEngine.finalizeGroupState(state)
      if (Object.keys(aggregates).length > 0) {
        cache.aggregatesByGroupKey.set(groupKey, aggregates)
      } else {
        cache.aggregatesByGroupKey.delete(groupKey)
      }
    }
    patchRuntimeGroupAggregates(groupKey => cache.aggregatesByGroupKey.get(groupKey))
    cache.dirtyBranchKeys.clear()
    return true
  }

  function applyIncrementalTreeParentAggregationDelta(
    changedRowIds: readonly DataGridRowId[],
    previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  ): boolean {
    const cache = treeParentProjectionCacheState?.cache
    if (
      !cache ||
      !cache.aggregateStateByGroupRowId ||
      !cache.leafContributionById ||
      !aggregationEngine.isIncrementalAggregationSupported()
    ) {
      return false
    }
    const sourceById = buildRowIdIndex(sourceRows)
    const dirtyGroupRowIds = new Set<DataGridRowId>()
    for (const rowId of changedRowIds) {
      const previousRow = previousRowsById.get(rowId)
      const previousContribution = cache.leafContributionById.get(rowId)
        ?? (previousRow ? aggregationEngine.createLeafContribution(previousRow) : null)
      const nextRow = sourceById.get(rowId)
      const nextContribution = nextRow
        ? aggregationEngine.createLeafContribution(nextRow)
        : null
      if (nextContribution) {
        cache.leafContributionById.set(rowId, nextContribution)
      } else {
        cache.leafContributionById.delete(rowId)
      }
      let cursor: DataGridRowId | null = rowId
      while (cursor != null) {
        const state = cache.aggregateStateByGroupRowId.get(cursor)
        if (state) {
          aggregationEngine.applyContributionDelta(
            state,
            previousContribution ?? null,
            nextContribution,
          )
          dirtyGroupRowIds.add(cursor)
          cache.dirtyBranchRootIds.add(cursor)
        }
        cursor = cache.parentById.get(cursor) ?? null
      }
    }
    if (dirtyGroupRowIds.size === 0) {
      return false
    }
    for (const rowId of dirtyGroupRowIds) {
      const state = cache.aggregateStateByGroupRowId.get(rowId)
      if (!state) {
        continue
      }
      const aggregates = aggregationEngine.finalizeGroupState(state)
      if (Object.keys(aggregates).length > 0) {
        cache.aggregatesByGroupRowId.set(rowId, aggregates)
      } else {
        cache.aggregatesByGroupRowId.delete(rowId)
      }
    }
    patchRuntimeGroupAggregates(groupKey => {
      const groupRowId = cache.groupRowIdByGroupKey.get(groupKey)
      if (typeof groupRowId === "undefined") {
        return undefined
      }
      return cache.aggregatesByGroupRowId.get(groupRowId)
    })
    cache.dirtyBranchRootIds.clear()
    return true
  }

  function applyIncrementalAggregationPatch(
    changeSet: ReturnType<typeof analyzeRowPatchChangeSet<T>>,
    previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  ): boolean {
    if (!aggregationModel || aggregationModel.columns.length === 0) {
      return false
    }
    if (
      !changeSet.stageImpact.affectsAggregation ||
      changeSet.stageImpact.affectsFilter ||
      changeSet.stageImpact.affectsSort ||
      changeSet.stageImpact.affectsGroup
    ) {
      return false
    }
    aggregationEngine.setModel(aggregationModel)
    if (!aggregationEngine.isIncrementalAggregationSupported()) {
      return false
    }
    if (treeData) {
      return applyIncrementalTreePathAggregationDelta(changeSet.changedRowIds, previousRowsById)
        || applyIncrementalTreeParentAggregationDelta(changeSet.changedRowIds, previousRowsById)
    }
    if (!groupBy) {
      return false
    }
    return applyIncrementalGroupByAggregationDelta(changeSet.changedRowIds, previousRowsById)
  }

  function resolveFilterPredicate(
    options: { ignoreColumnFilterKey?: string } = {},
  ): (rowNode: DataGridRowNode<T>) => boolean {
    const ignoredColumnKey = typeof options.ignoreColumnFilterKey === "string"
      ? options.ignoreColumnFilterKey.trim()
      : ""
    if (ignoredColumnKey) {
      derivedCacheDiagnostics.filterPredicateMisses += 1
      return createFilterPredicate(filterModel, { ignoreColumnFilterKey: ignoredColumnKey })
    }

    const filterKey = String(runtimeState.filterRevision)
    return filterKey === cachedFilterPredicateKey && cachedFilterPredicate
      ? (() => {
          derivedCacheDiagnostics.filterPredicateHits += 1
          return cachedFilterPredicate as (rowNode: DataGridRowNode<T>) => boolean
        })()
      : (() => {
          const next = createFilterPredicate(filterModel)
          cachedFilterPredicateKey = filterKey
          cachedFilterPredicate = next
          derivedCacheDiagnostics.filterPredicateMisses += 1
          return next
        })()
  }

  function runFilterStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runFilterStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runFilterStage"]> {
    const shouldRecomputeFilter = context.shouldRecompute || runtimeState.filteredRowsProjection.length === 0
    let filteredRowIds = new Set<DataGridRowId>()
    if (shouldRecomputeFilter) {
      const filterPredicate = context.filterPredicate ?? resolveFilterPredicate()
      const nextFilteredRows: DataGridRowNode<T>[] = []
      for (const row of sourceRows) {
        if (!filterPredicate(row)) {
          continue
        }
        nextFilteredRows.push(row)
        filteredRowIds.add(row.rowId)
      }
      runtimeState.filteredRowsProjection = nextFilteredRows
    } else {
      runtimeState.filteredRowsProjection = remapRowsByIdentity(runtimeState.filteredRowsProjection, context.sourceById)
      for (const row of runtimeState.filteredRowsProjection) {
        filteredRowIds.add(row.rowId)
      }
    }
    return {
      filteredRowIds,
      recomputed: shouldRecomputeFilter,
    }
  }

  function runSortStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runSortStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runSortStage"]> {
    const rowsForSort = treeData
      ? (shouldUseFilteredRowsForTreeSort(treeData, filterModel)
          ? runtimeState.filteredRowsProjection
          : sourceRows)
      : runtimeState.filteredRowsProjection
    const shouldRecomputeSort = context.shouldRecompute || runtimeState.sortedRowsProjection.length === 0
    if (shouldRecomputeSort) {
      const shouldCacheSortValues = projectionPolicy.shouldCacheSortValues()
      const maxSortValueCacheSize = projectionPolicy.maxSortValueCacheSize(sourceRows.length)
      const sortKey = serializeSortValueModelForCache(sortModel, { includeDirection: false })
      if (sortKey !== sortValueCacheKey || !shouldCacheSortValues || maxSortValueCacheSize <= 0) {
        sortValueCache.clear()
        sortValueCacheKey = sortKey
      }
      runtimeState.sortedRowsProjection = sortLeafRows(rowsForSort, sortModel, (row, descriptors) => {
        if (!shouldCacheSortValues || maxSortValueCacheSize <= 0) {
          derivedCacheDiagnostics.sortValueMisses += 1
          return descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field))
        }
        const currentRowVersion = rowVersionById.get(row.rowId) ?? 0
        const cached = sortValueCache.get(row.rowId)
        if (cached && cached.rowVersion === currentRowVersion) {
          sortValueCache.delete(row.rowId)
          sortValueCache.set(row.rowId, cached)
          derivedCacheDiagnostics.sortValueHits += 1
          return cached.values
        }
        const resolved = descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field))
        sortValueCache.set(row.rowId, {
          rowVersion: currentRowVersion,
          values: resolved,
        })
        enforceCacheCap(sortValueCache, maxSortValueCacheSize)
        derivedCacheDiagnostics.sortValueMisses += 1
        return resolved
      })
    } else {
      runtimeState.sortedRowsProjection = preserveRowOrder(runtimeState.sortedRowsProjection, rowsForSort)
    }
    return shouldRecomputeSort
  }

  function runGroupStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runGroupStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runGroupStage"]> {
    const expansionSpec = getExpansionSpec()
    const expansionSnapshot = buildGroupExpansionSnapshot(expansionSpec, toggledGroupKeys)
    const nextGroupValueCacheKey = groupBy
      ? `${runtimeState.rowRevision}:${runtimeState.groupRevision}:${groupBy.fields.join("|")}`
      : "__none__"
    const groupValueCounters = {
      hits: derivedCacheDiagnostics.groupValueHits,
      misses: derivedCacheDiagnostics.groupValueMisses,
    }
    let groupedResult: TreeProjectionResult<T> | null = null
    let recomputedGroupStage = false
    if (treeData) {
      const treeCacheKey = buildTreeProjectionCacheKey(
        treeCacheRevision,
        runtimeState.filterRevision,
        runtimeState.sortRevision,
        treeData,
      )
      const shouldRecomputeGroup = context.shouldRecompute || runtimeState.groupedRowsProjection.length === 0
      if (shouldRecomputeGroup) {
        const aggregationBasis: "filtered" | "source" = aggregationModel?.basis === "source"
          ? "source"
          : "filtered"
        let treeRowsForProjection = runtimeState.sortedRowsProjection
        let treeRowMatchesFilter = context.rowMatchesFilter
        if (
          isTreePathSpec(treeData) &&
          shouldUseFilteredRowsForTreeSort(treeData, filterModel) &&
          aggregationBasis !== "source"
        ) {
          if (runtimeState.sortedRowsProjection.length === runtimeState.filteredRowsProjection.length) {
            treeRowMatchesFilter = alwaysMatchesFilter
          } else {
            const filteredSortedRows: DataGridRowNode<T>[] = []
            for (const row of runtimeState.sortedRowsProjection) {
              if (!context.rowMatchesFilter(row)) {
                continue
              }
              filteredSortedRows.push(row)
            }
            treeRowsForProjection = filteredSortedRows
            treeRowMatchesFilter = alwaysMatchesFilter
          }
        }
        const hasTreeAggregationModel = Boolean(aggregationModel && aggregationModel.columns.length > 0)
        if (hasTreeAggregationModel) {
          aggregationEngine.setModel(aggregationModel)
        }
        const computeTreeAggregates = hasTreeAggregationModel
          ? ((rows: readonly DataGridRowNode<T>[]) => aggregationEngine.computeAggregatesForLeaves(rows))
          : undefined
        const supportsIncrementalTreeAggregation = hasTreeAggregationModel
          && aggregationEngine.isIncrementalAggregationSupported()
        const createTreeLeafContribution = supportsIncrementalTreeAggregation
          ? ((row: DataGridRowNode<T>) => aggregationEngine.createLeafContribution(row))
          : undefined
        const createTreeGroupState = supportsIncrementalTreeAggregation
          ? (() => aggregationEngine.createEmptyGroupState())
          : undefined
        const applyTreeContributionDelta = supportsIncrementalTreeAggregation
          ? ((
            groupState: DataGridIncrementalAggregationGroupState,
            previous: DataGridIncrementalAggregationLeafContribution | null,
            next: DataGridIncrementalAggregationLeafContribution | null,
          ) => {
            aggregationEngine.applyContributionDelta(groupState, previous, next)
          })
          : undefined
        const finalizeTreeGroupState = supportsIncrementalTreeAggregation
          ? ((groupState: DataGridIncrementalAggregationGroupState) => aggregationEngine.finalizeGroupState(groupState))
          : undefined
        if (
          context.shouldRecompute &&
          runtimeState.groupedRowsProjection.length > 0 &&
          lastTreeProjectionCacheKey === treeCacheKey &&
          lastTreeExpansionSnapshot
        ) {
          if (treeData.mode === "path" && treePathProjectionCacheState?.key === treeCacheKey) {
            groupedResult = tryProjectTreePathSubtreeToggle(
              runtimeState.groupedRowsProjection,
              treePathProjectionCacheState,
              treeData,
              lastTreeExpansionSnapshot,
              expansionSnapshot,
              groupedProjectionGroupIndexByRowId,
            )
          } else if (treeData.mode === "parent" && treeParentProjectionCacheState?.key === treeCacheKey) {
            groupedResult = tryProjectTreeParentSubtreeToggle(
              runtimeState.groupedRowsProjection,
              treeParentProjectionCacheState,
              lastTreeExpansionSnapshot,
              expansionSnapshot,
              groupedProjectionGroupIndexByRowId,
            )
          }
        }
        if (!groupedResult) {
          try {
            const projected = projectTreeDataRowsFromCache(
              treeRowsForProjection,
              treeData,
              expansionSnapshot,
              toggledGroupKeys,
              treeRowMatchesFilter,
              treePathProjectionCacheState,
              treeParentProjectionCacheState,
              treeCacheKey,
              computeTreeAggregates,
              aggregationBasis,
              createTreeLeafContribution,
              createTreeGroupState,
              applyTreeContributionDelta,
              finalizeTreeGroupState,
            )
            groupedResult = projected.result
            treePathProjectionCacheState = projected.pathCache
            treeParentProjectionCacheState = projected.parentCache
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            treeDataDiagnostics = createEmptyTreeDataDiagnostics({
              duplicates: treeDataDiagnostics?.duplicates ?? 0,
              lastError: message,
            })
            throw error
          }
        }
        runtimeState.groupedRowsProjection = groupedResult.rows
        lastTreeProjectionCacheKey = treeCacheKey
        lastTreeExpansionSnapshot = expansionSnapshot
        recomputedGroupStage = true
      } else {
        runtimeState.groupedRowsProjection = patchProjectedRowsByIdentity(runtimeState.groupedRowsProjection, context.sourceById)
      }
      if (shouldRecomputeGroup || groupedResult) {
        treeDataDiagnostics = createEmptyTreeDataDiagnostics({
          duplicates: 0,
          lastError: null,
          orphans: groupedResult?.diagnostics.orphans ?? 0,
          cycles: groupedResult?.diagnostics.cycles ?? 0,
        })
      }
    } else if (groupBy) {
      const shouldRecomputeGroup = context.shouldRecompute || runtimeState.groupedRowsProjection.length === 0
      if (shouldRecomputeGroup) {
        const shouldCacheGroupValues = projectionPolicy.shouldCacheGroupValues()
        const maxGroupValueCacheSize = projectionPolicy.maxGroupValueCacheSize(sourceRows.length)
        if (nextGroupValueCacheKey !== groupValueCacheKey) {
          groupValueCache.clear()
          groupValueCacheKey = nextGroupValueCacheKey
        }
        if (!shouldCacheGroupValues || maxGroupValueCacheSize <= 0) {
          groupValueCache.clear()
        }
        runtimeState.groupedRowsProjection = buildGroupedRowsProjection({
          inputRows: runtimeState.sortedRowsProjection,
          groupBy,
          expansionSnapshot,
          readRowField: (row, key, field) => readRowField(row, key, field),
          normalizeText,
          normalizeLeafRow,
          groupValueCache: shouldCacheGroupValues && maxGroupValueCacheSize > 0
            ? groupValueCache
            : undefined,
          groupValueCounters: shouldCacheGroupValues && maxGroupValueCacheSize > 0
            ? groupValueCounters
            : undefined,
          maxGroupValueCacheSize: shouldCacheGroupValues && maxGroupValueCacheSize > 0
            ? maxGroupValueCacheSize
            : undefined,
        })
        if (shouldCacheGroupValues) {
          enforceCacheCap(groupValueCache, maxGroupValueCacheSize)
        }
        recomputedGroupStage = true
      } else {
        runtimeState.groupedRowsProjection = patchProjectedRowsByIdentity(runtimeState.groupedRowsProjection, context.sourceById)
      }
    } else {
      runtimeState.groupedRowsProjection = runtimeState.sortedRowsProjection
      recomputedGroupStage = context.shouldRecompute
    }
    if (recomputedGroupStage) {
      groupedProjectionGroupIndexByRowId = buildGroupRowIndexByRowId(runtimeState.groupedRowsProjection)
    }
    derivedCacheDiagnostics.groupValueHits = groupValueCounters.hits
    derivedCacheDiagnostics.groupValueMisses = groupValueCounters.misses
    return recomputedGroupStage
  }

  function runPaginateStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runPaginateStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runPaginateStage"]> {
    const shouldRecomputePaginate = context.shouldRecompute || runtimeState.paginatedRowsProjection.length === 0
    if (shouldRecomputePaginate) {
      pagination = buildPaginationSnapshot(runtimeState.aggregatedRowsProjection.length, paginationInput)
      if (pagination.enabled && pagination.startIndex >= 0 && pagination.endIndex >= pagination.startIndex) {
        runtimeState.paginatedRowsProjection = runtimeState.aggregatedRowsProjection.slice(pagination.startIndex, pagination.endIndex + 1)
      } else {
        runtimeState.paginatedRowsProjection = runtimeState.aggregatedRowsProjection
      }
    } else {
      runtimeState.paginatedRowsProjection = patchProjectedRowsByIdentity(runtimeState.paginatedRowsProjection, context.sourceById)
    }
    return shouldRecomputePaginate
  }

  function runAggregateStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runAggregateStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runAggregateStage"]> {
    const shouldRecomputeAggregate = context.shouldRecompute || runtimeState.aggregatedRowsProjection.length === 0
    if (!shouldRecomputeAggregate) {
      runtimeState.aggregatedRowsProjection = patchProjectedRowsByIdentity(runtimeState.aggregatedRowsProjection, context.sourceById)
      return false
    }

    const activeGroupBy = groupBy
    const activeAggregationModel = aggregationModel
    const hasAggregationModel = Boolean(activeAggregationModel && activeAggregationModel.columns.length > 0)
    if (treeData || !activeGroupBy || !hasAggregationModel || !activeAggregationModel) {
      resetGroupByIncrementalAggregationState()
      runtimeState.aggregatedRowsProjection = runtimeState.groupedRowsProjection
      return true
    }

    aggregationEngine.setModel(activeAggregationModel)
    const aggregationBasis: "filtered" | "source" = activeAggregationModel.basis === "source"
      ? "source"
      : "filtered"
    const sourceRowsForAggregation = sortModel.length > 0
      ? sortLeafRows(sourceRows, sortModel, (row, descriptors) => {
          return descriptors.map(descriptor => readRowField(row, descriptor.key, descriptor.field))
        })
      : sourceRows
    const rowsForAggregation = aggregationBasis === "source"
      ? sourceRowsForAggregation
      : runtimeState.sortedRowsProjection

    let aggregatesByGroupKey: ReadonlyMap<string, Record<string, unknown>>
    if (aggregationEngine.isIncrementalAggregationSupported()) {
      const incremental = computeGroupByIncrementalAggregation(
        rowsForAggregation,
        activeGroupBy,
        (row, field) => normalizeText(readRowField(row, field)),
        row => aggregationEngine.createLeafContribution(row),
        () => aggregationEngine.createEmptyGroupState(),
        (groupState, previous, next) => aggregationEngine.applyContributionDelta(groupState, previous, next),
        groupState => aggregationEngine.finalizeGroupState(groupState),
      )
      groupByAggregateStateByGroupKey = incremental.statesByGroupKey
      groupByAggregatesByGroupKey = incremental.aggregatesByGroupKey
      groupByAggregatePathByRowId = incremental.groupPathByRowId
      groupByLeafContributionByRowId = incremental.leafContributionByRowId
      aggregatesByGroupKey = groupByAggregatesByGroupKey
    } else {
      resetGroupByIncrementalAggregationState()
      aggregatesByGroupKey = computeGroupByAggregatesMap(
        rowsForAggregation,
        activeGroupBy,
        (row, field) => normalizeText(readRowField(row, field)),
        rows => aggregationEngine.computeAggregatesForLeaves(rows),
      )
      groupByAggregatesByGroupKey = new Map(aggregatesByGroupKey)
    }

    runtimeState.aggregatedRowsProjection = patchGroupRowsAggregatesByGroupKey(
      runtimeState.groupedRowsProjection,
      groupKey => aggregatesByGroupKey.get(groupKey),
    )
    return true
  }

  function runVisibleStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runVisibleStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runVisibleStage"]> {
    const shouldRecomputeVisible = context.shouldRecompute || runtimeState.rows.length === 0
    if (shouldRecomputeVisible) {
      runtimeState.rows = assignDisplayIndexes(runtimeState.paginatedRowsProjection)
    } else {
      runtimeState.rows = patchProjectedRowsByIdentity(runtimeState.rows, context.sourceById)
    }
    return shouldRecomputeVisible
  }

  function finalizeProjectionRecompute(meta: DataGridClientProjectionFinalizeMeta): void {
    paginationInput = {
      pageSize: pagination.pageSize,
      currentPage: pagination.currentPage,
    }
    viewportRange = normalizeViewportRange(viewportRange, runtimeState.rows.length)
    derivedCacheDiagnostics.revisions = {
      row: runtimeState.rowRevision,
      sort: runtimeState.sortRevision,
      filter: runtimeState.filterRevision,
      group: runtimeState.groupRevision,
    }
    runtimeStateStore.commitProjectionCycle(meta.hadActualRecompute)
  }

  const projectionStageHandlers: DataGridClientProjectionStageHandlers<T> = {
    buildSourceById: () => buildRowIdIndex(sourceRows),
    getCurrentFilteredRowIds: () => {
      const rowIds = new Set<DataGridRowId>()
      for (const row of runtimeState.filteredRowsProjection) {
        rowIds.add(row.rowId)
      }
      return rowIds
    },
    resolveFilterPredicate,
    runFilterStage,
    runSortStage,
    runGroupStage,
    runAggregateStage,
    runPaginateStage,
    runVisibleStage,
    finalizeProjectionRecompute,
  }
  const projectionOrchestrator = createClientRowProjectionOrchestrator(
    projectionEngine,
    projectionStageHandlers,
  )

  function getProjectionDiagnostics(): DataGridProjectionDiagnostics {
    return runtimeStateStore.getProjectionDiagnostics(() => projectionOrchestrator.getStaleStages())
  }

  function getSnapshot(): DataGridRowModelSnapshot<T> {
    viewportRange = normalizeViewportRange(viewportRange, runtimeState.rows.length)
    const expansionSpec = getExpansionSpec()
    return {
      revision: runtimeState.revision,
      kind: "client",
      rowCount: runtimeState.rows.length,
      loading: false,
      error: null,
      ...(treeData ? { treeDataDiagnostics: createEmptyTreeDataDiagnostics(treeDataDiagnostics ?? undefined) } : {}),
      projection: getProjectionDiagnostics(),
      viewportRange,
      pagination,
      sortModel: cloneSortModel(sortModel),
      filterModel: cloneFilterModel(filterModel),
      groupBy: treeData ? null : cloneGroupBySpec(groupBy),
      groupExpansion: buildGroupExpansionSnapshot(expansionSpec, toggledGroupKeys),
    }
  }

  function emit() {
    lifecycle.emit(getSnapshot)
  }

  function getExpansionSpec(): DataGridGroupBySpec | null {
    if (treeData) {
      return {
        fields: ["__tree__"],
        expandedByDefault: expansionExpandedByDefault,
      }
    }
    if (!groupBy) {
      return null
    }
    return {
      fields: groupBy.fields,
      expandedByDefault: expansionExpandedByDefault,
    }
  }

  function applyGroupExpansion(nextExpansion: DataGridGroupExpansionSnapshot | null): boolean {
    const expansionSpec = getExpansionSpec()
    if (!expansionSpec) {
      return false
    }
    const normalizedSnapshot = buildGroupExpansionSnapshot(
      {
        fields: expansionSpec.fields,
        expandedByDefault: nextExpansion?.expandedByDefault ?? expansionSpec.expandedByDefault,
      },
      nextExpansion?.toggledGroupKeys ?? [],
    )
    const currentSnapshot = buildGroupExpansionSnapshot(expansionSpec, toggledGroupKeys)
    if (isSameGroupExpansionSnapshot(currentSnapshot, normalizedSnapshot)) {
      return false
    }
    expansionExpandedByDefault = normalizedSnapshot.expandedByDefault
    toggledGroupKeys.clear()
    for (const groupKey of normalizedSnapshot.toggledGroupKeys) {
      toggledGroupKeys.add(groupKey)
    }
    return true
  }

  projectionOrchestrator.recomputeFromStage("filter")

  return {
    kind: "client",
    getSnapshot,
    getRowCount() {
      return runtimeState.rows.length
    },
    getRow(index: number) {
      if (!Number.isFinite(index)) {
        return undefined
      }
      return runtimeState.rows[Math.max(0, Math.trunc(index))]
    },
    getRowsInRange(range: DataGridViewportRange) {
      const normalized = normalizeViewportRange(range, runtimeState.rows.length)
      if (runtimeState.rows.length === 0) {
        return []
      }
      return runtimeState.rows.slice(normalized.start, normalized.end + 1)
    },
    setRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      ensureActive()
      const nextSourceRows = normalizeSourceRows(nextRows ?? [])
      rowVersionById = rebuildRowVersionIndex(rowVersionById, nextSourceRows)
      sourceRows = nextSourceRows
      pruneSortCacheRows(sortValueCache, sourceRows)
      runtimeStateStore.bumpRowRevision()
      resetGroupByIncrementalAggregationState()
      invalidateTreeProjectionCaches()
      projectionOrchestrator.recomputeFromStage("filter")
      emit()
    },
    patchRows(
      updates: readonly DataGridClientRowPatch<T>[],
      options: DataGridClientRowPatchOptions = {},
    ) {
      ensureActive()
      if (!Array.isArray(updates) || updates.length === 0) {
        return
      }
      const updatesById = new Map<DataGridRowId, Partial<T>>()
      for (const update of updates) {
        if (!update || !isDataGridRowId(update.rowId) || typeof update.data === "undefined" || update.data === null) {
          continue
        }
        const existing = updatesById.get(update.rowId)
        if (existing) {
          updatesById.set(update.rowId, mergeRowPatch(existing, update.data))
          continue
        }
        updatesById.set(update.rowId, update.data)
      }
      if (updatesById.size === 0) {
        return
      }
      let changed = false
      const changedRowIds: DataGridRowId[] = []
      const changedUpdatesById = new Map<DataGridRowId, Partial<T>>()
      const previousRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()
      sourceRows = sourceRows.map(row => {
        const patch = updatesById.get(row.rowId)
        if (!patch) {
          return row
        }
        const nextData = applyRowDataPatch(row.data, patch)
        if (nextData === row.data) {
          return row
        }
        changed = true
        changedRowIds.push(row.rowId)
        changedUpdatesById.set(row.rowId, patch)
        previousRowsById.set(row.rowId, row)
        return {
          ...row,
          data: nextData,
          row: nextData,
        }
      })
      if (!changed || changedUpdatesById.size === 0) {
        return
      }
      bumpRowVersions(rowVersionById, changedRowIds)
      runtimeStateStore.bumpRowRevision()
      const filterActive = hasActiveFilterModel(filterModel)
      const sortActive = sortModel.length > 0
      const groupActive = Boolean(treeData) || Boolean(groupBy)
      const aggregationActive = Boolean(aggregationModel && aggregationModel.columns.length > 0)
      const allowFilterRecompute = options.recomputeFilter === true
      const allowSortRecompute = options.recomputeSort === true
      const allowGroupRecompute = options.recomputeGroup === true
      const filterFields = filterActive ? collectFilterModelFields(filterModel) : new Set<string>()
      const sortFields = sortActive ? collectSortModelFields(sortModel) : new Set<string>()
      const groupFields = groupActive && !treeData ? collectGroupByFields(groupBy) : new Set<string>()
      const aggregationFields = aggregationActive ? collectAggregationModelFields(aggregationModel) : new Set<string>()
      const treeDataDependencyFields = treeData ? collectTreeDataDependencyFields(treeData) : new Set<string>()
      const changeSet = analyzeRowPatchChangeSet({
        updatesById: changedUpdatesById,
        dependencyGraph: projectionPolicy.dependencyGraph,
        filterActive,
        sortActive,
        groupActive,
        aggregationActive,
        filterFields,
        sortFields,
        groupFields,
        aggregationFields,
        treeDataDependencyFields,
        hasTreeData: Boolean(treeData),
      })
      if (changeSet.cacheEvictionPlan.clearSortValueCache) {
        sortValueCache.clear()
      } else if (changeSet.cacheEvictionPlan.evictSortValueRowIds.length > 0) {
        for (const rowId of changeSet.cacheEvictionPlan.evictSortValueRowIds) {
          sortValueCache.delete(rowId)
        }
      }
      if (changeSet.cacheEvictionPlan.invalidateTreeProjectionCaches) {
        invalidateTreeProjectionCaches()
      } else if (changeSet.cacheEvictionPlan.patchTreeProjectionCacheRowsByIdentity) {
        patchTreeProjectionCacheRowsByIdentity(changedRowIds)
      }
      const appliedIncrementalAggregation = !allowGroupRecompute
        && applyIncrementalAggregationPatch(changeSet, previousRowsById)
      const effectiveChangeSet = appliedIncrementalAggregation
        ? {
            ...changeSet,
            stageImpact: {
              ...changeSet.stageImpact,
              affectsAggregation: false,
            },
          }
        : changeSet
      const staleStagesBeforeRequest = new Set<DataGridClientProjectionStage>(projectionOrchestrator.getStaleStages())
      const allStages: readonly DataGridClientProjectionStage[] = DATAGRID_CLIENT_ALL_PROJECTION_STAGES
      const projectionExecutionPlan = buildPatchProjectionExecutionPlan({
        changeSet: effectiveChangeSet,
        recomputePolicy: {
          filter: allowFilterRecompute,
          sort: allowSortRecompute,
          group: allowGroupRecompute,
        },
        staleStages: staleStagesBeforeRequest,
        allStages,
        expandStages: expandClientProjectionStages,
      })
      // Always request a projection refresh pass so every stage can patch row identity
      // even when no expensive stage recompute is needed.
      projectionOrchestrator.recomputeWithExecutionPlan(projectionExecutionPlan)
      if (options.emit !== false) {
        emit()
      }
    },
    reorderRows(input: DataGridClientRowReorderInput) {
      ensureActive()
      const length = sourceRows.length
      if (length <= 1) {
        return false
      }
      if (!Number.isFinite(input.fromIndex) || !Number.isFinite(input.toIndex)) {
        return false
      }
      const fromIndex = Math.max(0, Math.min(length - 1, Math.trunc(input.fromIndex)))
      const count = Number.isFinite(input.count) ? Math.max(1, Math.trunc(input.count as number)) : 1
      const maxCount = Math.max(1, Math.min(count, length - fromIndex))
      const toIndexRaw = Math.max(0, Math.min(length, Math.trunc(input.toIndex)))
      const rows = sourceRows.slice()
      const moved = rows.splice(fromIndex, maxCount)
      if (moved.length === 0) {
        return false
      }
      const adjustedTarget = toIndexRaw > fromIndex ? Math.max(0, toIndexRaw - moved.length) : toIndexRaw
      rows.splice(adjustedTarget, 0, ...moved)
      sourceRows = reindexSourceRows(rows)
      runtimeStateStore.bumpRowRevision()
      invalidateTreeProjectionCaches()
      projectionOrchestrator.recomputeFromStage("filter")
      emit()
      return true
    },
    setViewportRange(range: DataGridViewportRange) {
      ensureActive()
      const nextRange = normalizeViewportRange(range, runtimeState.rows.length)
      if (nextRange.start === viewportRange.start && nextRange.end === viewportRange.end) {
        return
      }
      viewportRange = nextRange
      emit()
    },
    setPagination(nextPagination: DataGridPaginationInput | null) {
      ensureActive()
      const normalized = normalizePaginationInput(nextPagination)
      if (
        normalized.pageSize === paginationInput.pageSize &&
        normalized.currentPage === paginationInput.currentPage
      ) {
        return
      }
      paginationInput = normalized
      projectionOrchestrator.recomputeFromStage("paginate")
      emit()
    },
    setPageSize(pageSize: number | null) {
      ensureActive()
      const normalizedPageSize = normalizePaginationInput({ pageSize: pageSize ?? 0, currentPage: 0 }).pageSize
      if (normalizedPageSize === paginationInput.pageSize) {
        return
      }
      paginationInput = {
        pageSize: normalizedPageSize,
        currentPage: 0,
      }
      projectionOrchestrator.recomputeFromStage("paginate")
      emit()
    },
    setCurrentPage(page: number) {
      ensureActive()
      const normalizedPage = normalizePaginationInput({ pageSize: paginationInput.pageSize, currentPage: page }).currentPage
      if (normalizedPage === paginationInput.currentPage) {
        return
      }
      paginationInput = {
        ...paginationInput,
        currentPage: normalizedPage,
      }
      projectionOrchestrator.recomputeFromStage("paginate")
      emit()
    },
    setSortModel(nextSortModel: readonly DataGridSortState[]) {
      ensureActive()
      const normalizedSortModel = Array.isArray(nextSortModel) ? cloneSortModel(nextSortModel) : []
      if (isSameSortModel(sortModel, normalizedSortModel)) {
        return
      }
      sortModel = normalizedSortModel
      runtimeStateStore.bumpSortRevision()
      projectionOrchestrator.recomputeFromStage("sort")
      emit()
    },
    setFilterModel(nextFilterModel: DataGridFilterSnapshot | null) {
      ensureActive()
      const normalizedFilterModel = cloneFilterModel(nextFilterModel ?? null)
      if (isSameFilterModel(filterModel, normalizedFilterModel)) {
        return
      }
      filterModel = normalizedFilterModel
      runtimeStateStore.bumpFilterRevision()
      projectionOrchestrator.recomputeFromStage("filter")
      emit()
    },
    setSortAndFilterModel(input: DataGridSortAndFilterModelInput) {
      ensureActive()
      const normalizedSortModel = Array.isArray(input?.sortModel) ? cloneSortModel(input.sortModel) : []
      const normalizedFilterModel = cloneFilterModel(input?.filterModel ?? null)
      const sortChanged = !isSameSortModel(sortModel, normalizedSortModel)
      const filterChanged = !isSameFilterModel(filterModel, normalizedFilterModel)
      if (!sortChanged && !filterChanged) {
        return
      }
      sortModel = normalizedSortModel
      filterModel = normalizedFilterModel
      if (filterChanged) {
        runtimeStateStore.bumpFilterRevision()
      }
      if (sortChanged) {
        runtimeStateStore.bumpSortRevision()
      }
      projectionOrchestrator.recomputeFromStage(filterChanged ? "filter" : "sort")
      emit()
    },
    setGroupBy(nextGroupBy: DataGridGroupBySpec | null) {
      ensureActive()
      if (treeData) {
        return
      }
      const normalized = normalizeGroupBySpec(nextGroupBy)
      if (isSameGroupBySpec(groupBy, normalized)) {
        return
      }
      groupBy = normalized
      expansionExpandedByDefault = Boolean(normalized?.expandedByDefault)
      toggledGroupKeys.clear()
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("group")
      emit()
    },
    setAggregationModel(nextAggregationModel: DataGridAggregationModel<T> | null) {
      ensureActive()
      const normalized = cloneAggregationModel(nextAggregationModel ?? null)
      if (isSameAggregationModel(aggregationModel, normalized)) {
        return
      }
      aggregationModel = normalized
      if (treeData) {
        invalidateTreeProjectionCaches()
        projectionOrchestrator.recomputeFromStage("group")
      } else {
        projectionOrchestrator.recomputeFromStage("aggregate")
      }
      emit()
    },
    getAggregationModel() {
      return cloneAggregationModel(aggregationModel)
    },
    getColumnHistogram(columnId: string, options?: DataGridColumnHistogramOptions) {
      ensureActive()
      const normalizedColumnId = columnId.trim()
      if (normalizedColumnId.length === 0) {
        return []
      }

      const scope = options?.scope ?? "filtered"
      if (scope === "sourceAll") {
        return buildColumnHistogram(sourceRows, normalizedColumnId, options)
      }

      if (options?.ignoreSelfFilter === true) {
        const filterPredicate = resolveFilterPredicate({ ignoreColumnFilterKey: normalizedColumnId })
        const rowsForHistogram: DataGridRowNode<T>[] = []
        for (const row of sourceRows) {
          if (filterPredicate(row)) {
            rowsForHistogram.push(row)
          }
        }
        return buildColumnHistogram(rowsForHistogram, normalizedColumnId, options)
      }

      return buildColumnHistogram(runtimeState.filteredRowsProjection, normalizedColumnId, options)
    },
    setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null) {
      ensureActive()
      if (!applyGroupExpansion(expansion)) {
        return
      }
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("group")
      emit()
    },
    toggleGroup(groupKey: string) {
      ensureActive()
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      if (!toggleGroupExpansionKey(toggledGroupKeys, groupKey)) {
        return
      }
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("group")
      emit()
    },
    expandGroup(groupKey: string) {
      ensureActive()
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      if (!setGroupExpansionKey(toggledGroupKeys, groupKey, expansionExpandedByDefault, true)) {
        return
      }
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("group")
      emit()
    },
    collapseGroup(groupKey: string) {
      ensureActive()
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      if (!setGroupExpansionKey(toggledGroupKeys, groupKey, expansionExpandedByDefault, false)) {
        return
      }
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("group")
      emit()
    },
    expandAllGroups() {
      ensureActive()
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      if (expansionExpandedByDefault && toggledGroupKeys.size === 0) {
        return
      }
      expansionExpandedByDefault = true
      toggledGroupKeys.clear()
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("group")
      emit()
    },
    collapseAllGroups() {
      ensureActive()
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      if (!expansionExpandedByDefault && toggledGroupKeys.size === 0) {
        return
      }
      expansionExpandedByDefault = false
      toggledGroupKeys.clear()
      runtimeStateStore.bumpGroupRevision()
      projectionOrchestrator.recomputeFromStage("group")
      emit()
    },
    refresh(_reason?: DataGridRowModelRefreshReason) {
      ensureActive()
      projectionOrchestrator.refresh()
      emit()
    },
    subscribe(listener: DataGridRowModelListener<T>) {
      return lifecycle.subscribe(listener)
    },
    getDerivedCacheDiagnostics() {
      return {
        revisions: { ...derivedCacheDiagnostics.revisions },
        filterPredicateHits: derivedCacheDiagnostics.filterPredicateHits,
        filterPredicateMisses: derivedCacheDiagnostics.filterPredicateMisses,
        sortValueHits: derivedCacheDiagnostics.sortValueHits,
        sortValueMisses: derivedCacheDiagnostics.sortValueMisses,
        groupValueHits: derivedCacheDiagnostics.groupValueHits,
        groupValueMisses: derivedCacheDiagnostics.groupValueMisses,
      }
    },
    dispose() {
      if (!lifecycle.dispose()) {
        return
      }
      sourceRows = []
      runtimeState.rows = []
      runtimeState.filteredRowsProjection = []
      runtimeState.sortedRowsProjection = []
      runtimeState.groupedRowsProjection = []
      runtimeState.aggregatedRowsProjection = []
      runtimeState.paginatedRowsProjection = []
      rowVersionById.clear()
      resetGroupByIncrementalAggregationState()
      groupedProjectionGroupIndexByRowId.clear()
      sortValueCache.clear()
      groupValueCache.clear()
      invalidateTreeProjectionCaches()
      cachedFilterPredicate = null
      cachedFilterPredicateKey = "__none__"
    },
  }
}
