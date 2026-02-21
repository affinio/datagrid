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
  type DataGridFilterSnapshot,
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
  cloneDataGridFilterSnapshot as cloneFilterSnapshot,
  evaluateDataGridAdvancedFilterExpression,
} from "./advancedFilter.js"
import {
  analyzeRowPatchChangeSet,
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
  recomputeSort?: boolean
  recomputeFilter?: boolean
  recomputeGroup?: boolean
  emit?: boolean
}

export interface ClientRowModel<T> extends DataGridRowModel<T> {
  setRows(rows: readonly DataGridRowNodeInput<T>[]): void
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

interface NormalizedColumnFilterEntry {
  key: string
  values: readonly string[]
}

function normalizeColumnFilterEntries(
  columnFilters: Record<string, readonly unknown[]>,
): NormalizedColumnFilterEntry[] {
  const normalized: NormalizedColumnFilterEntry[] = []
  for (const [rawKey, rawValues] of Object.entries(columnFilters ?? {})) {
    if (!Array.isArray(rawValues) || rawValues.length === 0) {
      continue
    }
    const key = rawKey.trim()
    if (key.length === 0) {
      continue
    }
    const seen = new Set<string>()
    const values: string[] = []
    for (const rawValue of rawValues) {
      const value = normalizeText(rawValue)
      if (seen.has(value)) {
        continue
      }
      seen.add(value)
      values.push(value)
    }
    if (values.length === 0) {
      continue
    }
    normalized.push({ key, values })
  }
  return normalized
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

function createFilterPredicate<T>(
  filterModel: DataGridFilterSnapshot | null,
): (rowNode: DataGridRowNode<T>) => boolean {
  if (!filterModel) {
    return () => true
  }

  const columnFilters = normalizeColumnFilterEntries(
    (filterModel.columnFilters ?? {}) as Record<string, readonly unknown[]>,
  ).map(entry => {
    return [entry.key, new Set<string>(entry.values)] as const
  })
  const advancedExpression = resolveAdvancedExpression(filterModel)

  return (rowNode: DataGridRowNode<T>) => {
    for (const [key, valueSet] of columnFilters) {
      const candidate = normalizeText(readRowField(rowNode, key))
      if (!valueSet.has(candidate)) {
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
  if (columnFilters.some(values => Array.isArray(values) && values.length > 0)) {
    return true
  }
  const advancedKeys = Object.keys(filterModel.advancedFilters ?? {})
  if (advancedKeys.length > 0) {
    return true
  }
  return resolveAdvancedExpression(filterModel) !== null
}

function serializeSortValueModelForCache(sortModel: readonly DataGridSortState[]): string {
  if (!Array.isArray(sortModel) || sortModel.length === 0) {
    return "__none__"
  }
  return sortModel
    .map(descriptor => `${descriptor.key}:${descriptor.field ?? ""}`)
    .join("|")
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
  rootLeaves: DataGridRowNode<T>[]
  matchedLeafRowIds: Set<DataGridRowId>
  leafOnlyRows: DataGridRowNode<T>[]
}

interface TreeParentProjectionCache<T> {
  diagnostics: TreeProjectionDiagnostics
  rowById: Map<DataGridRowId, DataGridRowNode<T>>
  includedChildrenById: Map<DataGridRowId, DataGridRowId[]>
  groupRowIdByGroupKey: Map<string, DataGridRowId>
  rootIncluded: DataGridRowId[]
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
  return cache
}

function patchTreeParentProjectionCacheRowsByIdentity<T>(
  cache: TreeParentProjectionCache<T>,
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
): TreeParentProjectionCache<T> {
  for (const [rowId, row] of cache.rowById.entries()) {
    const next = sourceById.get(rowId)
    if (!next || (next.data === row.data && next.row === row.row)) {
      continue
    }
    cache.rowById.set(rowId, normalizeLeafRow(next))
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
): TreePathProjectionCache<T> {
  const diagnostics: TreeProjectionDiagnostics = {
    orphans: 0,
    cycles: 0,
  }
  const rootGroups = new Map<string, TreePathBranch<T>>()
  const branchByKey = new Map<string, TreePathBranch<T>>()
  const rootLeaves: DataGridRowNode<T>[] = []
  const matchedLeafRowIds = new Set<DataGridRowId>()
  const leafOnlyRows: DataGridRowNode<T>[] = []

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
      traversed.push(next)
      currentGroups = next.groups
    }
    const target = traversed[traversed.length - 1]
    if (target) {
      target.leaves.push(normalizedLeaf)
    }
    for (const branch of traversed) {
      if (matches) {
        branch.matchedLeaves += 1
      }
    }
  }

  return {
    diagnostics,
    rootGroups,
    branchByKey,
    rootLeaves,
    matchedLeafRowIds,
    leafOnlyRows,
  }
}

function createTreePathGroupNode<T>(
  branch: TreePathBranch<T>,
  expanded: boolean,
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
  output.push(createTreePathGroupNode(branch, expanded))
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
          cache: buildTreePathProjectionCache(inputRows, treeData, rowMatchesFilter),
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
        cache: buildTreeParentProjectionCache(inputRows, treeData, rowMatchesFilter),
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
      includedChildrenById: new Map<DataGridRowId, DataGridRowId[]>(),
      groupRowIdByGroupKey: new Map<string, DataGridRowId>(),
      rootIncluded: [],
    }
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

  return {
    diagnostics,
    rowById,
    includedChildrenById,
    groupRowIdByGroupKey,
    rootIncluded,
  }
}

function createTreeParentGroupNode<T>(
  row: DataGridRowNode<T>,
  rowId: DataGridRowId,
  level: number,
  childrenCount: number,
  expanded: boolean,
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
  output.push(createTreeParentGroupNode(row, rowId, level, children.length, expanded))
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

function tryProjectTreePathSubtreeToggle<T>(
  rows: readonly DataGridRowNode<T>[],
  cacheState: TreePathProjectionCacheState<T>,
  treeData: Extract<DataGridTreeDataResolvedSpec<T>, { mode: "path" }>,
  previousExpansionSnapshot: DataGridGroupExpansionSnapshot,
  nextExpansionSnapshot: DataGridGroupExpansionSnapshot,
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
  const groupIndex = rows.findIndex(row => row.kind === "group" && row.rowId === changedGroupKey)
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
  const groupIndex = rows.findIndex(
    row => row.kind === "group" && row.groupMeta?.groupKey === changedGroupKey,
  )
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

  function patchTreeProjectionCacheRowsByIdentity(): void {
    if (!treeData || (!treePathProjectionCacheState && !treeParentProjectionCacheState)) {
      return
    }
    const sourceById = buildRowIdIndex(sourceRows)
    if (treePathProjectionCacheState) {
      treePathProjectionCacheState = {
        key: treePathProjectionCacheState.key,
        cache: patchTreePathProjectionCacheRowsByIdentity(treePathProjectionCacheState.cache, sourceById),
      }
    }
    if (treeParentProjectionCacheState) {
      treeParentProjectionCacheState = {
        key: treeParentProjectionCacheState.key,
        cache: patchTreeParentProjectionCacheRowsByIdentity(treeParentProjectionCacheState.cache, sourceById),
      }
    }
  }

  function resolveFilterPredicate(): (rowNode: DataGridRowNode<T>) => boolean {
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
    if (shouldRecomputeFilter) {
      const filterPredicate = context.filterPredicate ?? resolveFilterPredicate()
      runtimeState.filteredRowsProjection = sourceRows.filter(filterPredicate)
    } else {
      runtimeState.filteredRowsProjection = remapRowsByIdentity(runtimeState.filteredRowsProjection, context.sourceById)
    }
    const filteredRowIds = new Set<DataGridRowId>()
    for (const row of runtimeState.filteredRowsProjection) {
      filteredRowIds.add(row.rowId)
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
      ? sourceRows
      : runtimeState.filteredRowsProjection
    const shouldRecomputeSort = context.shouldRecompute || runtimeState.sortedRowsProjection.length === 0
    if (shouldRecomputeSort) {
      const shouldCacheSortValues = projectionPolicy.shouldCacheSortValues()
      const maxSortValueCacheSize = projectionPolicy.maxSortValueCacheSize(sourceRows.length)
      const sortKey = `${runtimeState.sortRevision}:${serializeSortValueModelForCache(sortModel)}`
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
            )
          } else if (treeData.mode === "parent" && treeParentProjectionCacheState?.key === treeCacheKey) {
            groupedResult = tryProjectTreeParentSubtreeToggle(
              runtimeState.groupedRowsProjection,
              treeParentProjectionCacheState,
              lastTreeExpansionSnapshot,
              expansionSnapshot,
            )
          }
        }
        if (!groupedResult) {
          try {
            const projected = projectTreeDataRowsFromCache(
              runtimeState.sortedRowsProjection,
              treeData,
              expansionSnapshot,
              toggledGroupKeys,
              context.rowMatchesFilter,
              treePathProjectionCacheState,
              treeParentProjectionCacheState,
              treeCacheKey,
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
    derivedCacheDiagnostics.groupValueHits = groupValueCounters.hits
    derivedCacheDiagnostics.groupValueMisses = groupValueCounters.misses
    return recomputedGroupStage
  }

  function runPaginateStage(
    context: Parameters<DataGridClientProjectionStageHandlers<T>["runPaginateStage"]>[0],
  ): ReturnType<DataGridClientProjectionStageHandlers<T>["runPaginateStage"]> {
    const shouldRecomputePaginate = context.shouldRecompute || runtimeState.paginatedRowsProjection.length === 0
    if (shouldRecomputePaginate) {
      pagination = buildPaginationSnapshot(runtimeState.groupedRowsProjection.length, paginationInput)
      if (pagination.enabled && pagination.startIndex >= 0 && pagination.endIndex >= pagination.startIndex) {
        runtimeState.paginatedRowsProjection = runtimeState.groupedRowsProjection.slice(pagination.startIndex, pagination.endIndex + 1)
      } else {
        runtimeState.paginatedRowsProjection = runtimeState.groupedRowsProjection
      }
    } else {
      runtimeState.paginatedRowsProjection = patchProjectedRowsByIdentity(runtimeState.paginatedRowsProjection, context.sourceById)
    }
    return shouldRecomputePaginate
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
        return {
          ...row,
          data: nextData,
          row: nextData,
        }
      })
      if (!changed) {
        return
      }
      bumpRowVersions(rowVersionById, changedRowIds)
      runtimeStateStore.bumpRowRevision()
      const filterActive = hasActiveFilterModel(filterModel)
      const sortActive = sortModel.length > 0
      const groupActive = Boolean(treeData) || Boolean(groupBy)
      const allowFilterRecompute = options.recomputeFilter !== false
      const allowSortRecompute = options.recomputeSort !== false
      const allowGroupRecompute = options.recomputeGroup !== false
      const filterFields = filterActive ? collectFilterModelFields(filterModel) : new Set<string>()
      const sortFields = sortActive ? collectSortModelFields(sortModel) : new Set<string>()
      const groupFields = groupActive && !treeData ? collectGroupByFields(groupBy) : new Set<string>()
      const treeDataDependencyFields = treeData ? collectTreeDataDependencyFields(treeData) : new Set<string>()
      const changeSet = analyzeRowPatchChangeSet({
        updatesById,
        dependencyGraph: projectionPolicy.dependencyGraph,
        filterActive,
        sortActive,
        groupActive,
        filterFields,
        sortFields,
        groupFields,
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
        patchTreeProjectionCacheRowsByIdentity()
      }
      const staleStagesBeforeRequest = new Set<DataGridClientProjectionStage>(projectionOrchestrator.getStaleStages())
      const allStages: readonly DataGridClientProjectionStage[] = DATAGRID_CLIENT_ALL_PROJECTION_STAGES
      const projectionExecutionPlan = buildPatchProjectionExecutionPlan({
        changeSet,
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
      sortModel = Array.isArray(nextSortModel) ? cloneSortModel(nextSortModel) : []
      runtimeStateStore.bumpSortRevision()
      projectionOrchestrator.recomputeFromStage("sort")
      emit()
    },
    setFilterModel(nextFilterModel: DataGridFilterSnapshot | null) {
      ensureActive()
      filterModel = cloneFilterModel(nextFilterModel ?? null)
      runtimeStateStore.bumpFilterRevision()
      projectionOrchestrator.recomputeFromStage("filter")
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
      runtimeState.paginatedRowsProjection = []
      rowVersionById.clear()
      sortValueCache.clear()
      groupValueCache.clear()
      invalidateTreeProjectionCaches()
      cachedFilterPredicate = null
      cachedFilterPredicateKey = "__none__"
    },
  }
}
