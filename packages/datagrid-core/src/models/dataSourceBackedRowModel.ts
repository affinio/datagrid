import {
  buildGroupExpansionSnapshot,
  buildPaginationSnapshot,
  cloneGroupBySpec,
  isSameGroupExpansionSnapshot,
  isSameGroupBySpec,
  normalizePaginationInput,
  normalizeGroupBySpec,
  normalizeRowNode,
  normalizeViewportRange,
  setGroupExpansionKey,
  toggleGroupExpansionKey,
  type DataGridGroupExpansionSnapshot,
  type DataGridPaginationInput,
  type DataGridFilterSnapshot,
  type DataGridGroupBySpec,
  type DataGridAggregationModel,
  type DataGridColumnHistogram,
  type DataGridColumnHistogramOptions,
  type DataGridColumnHistogramResult,
  type DataGridRowId,
  type DataGridRowNode,
  type DataGridRowIdResolver,
  type DataGridRowModel,
  type DataGridRowModelListener,
  type DataGridRowModelRefreshReason,
  type DataGridRowModelSnapshot,
  type DataGridSparseRowModelDiagnostics,
  type DataGridSortState,
  type DataGridViewportRange,
} from "./rowModel.js"
import {
  clonePivotSpec,
  isSamePivotSpec,
  normalizePivotSpec,
} from "@affino/datagrid-pivot"
import type {
  DataGridPivotColumn,
  DataGridPivotSpec,
} from "@affino/datagrid-pivot"
import { cloneDataGridFilterSnapshot } from "./filters/advancedFilter.js"
import { isSameFilterModel, isSameSortModel } from "./projection/clientRowProjectionPrimitives.js"
import { applyRowDataPatch, mergeRowPatch } from "./clientRowRuntimeUtils.js"
import {
  collectAggregationModelFields,
  collectChangedFieldsFromPatches,
  collectFilterModelFields,
  collectGroupByFields,
  collectPivotModelFields,
  collectSortModelFields,
  doFieldPathsIntersect,
} from "./mutation/rowPatchAnalyzer.js"
import {
  clonePullAggregationModel,
  clonePivotColumnsSnapshot,
  isSamePivotColumnsSnapshot,
  isSamePullAggregationModel,
  normalizePivotColumnsFromUnknown,
} from "./server/pullRowModelSerialization.js"
import type {
  DataGridDataSource,
  DataGridDataSourceBackpressureDiagnostics,
  DataGridDataSourceInvalidation,
  DataGridDataSourcePivotPullContext,
  DataGridDataSourcePullPriority,
  DataGridDataSourcePullReason,
  DataGridDataSourceTreePullContext,
  DataGridDataSourcePushEvent,
  DataGridDataSourceRowEntry,
} from "./server/dataSourceProtocol.js"

export interface CreateDataSourceBackedRowModelOptions<T = unknown> {
  dataSource: DataGridDataSource<T>
  resolveRowId?: DataGridRowIdResolver<T>
  initialSortModel?: readonly DataGridSortState[]
  initialFilterModel?: DataGridFilterSnapshot | null
  initialGroupBy?: DataGridGroupBySpec | null
  initialPivotModel?: DataGridPivotSpec | null
  initialPagination?: DataGridPaginationInput | null
  initialTotal?: number
  rowCacheLimit?: number
  prefetch?: DataGridDataSourcePrefetchOptions
}

export interface DataGridDataSourcePrefetchOptions {
  enabled?: boolean
  triggerViewportFactor?: number
  windowViewportFactor?: number
  minBatchSize?: number
  maxBatchSize?: number
  directionalBias?: "forward" | "backward" | "symmetric" | "scroll-direction"
}

export interface DataSourceBackedRowModel<T = unknown> extends DataGridRowModel<T> {
  readonly dataSource: DataGridDataSource<T>
  patchRows?: (
    updates: readonly import("./mutation/clientRowPatchRuntime.js").DataGridClientRowPatchLike<T>[],
  ) => void | Promise<void>
  getSparseRowModelDiagnostics(): DataGridSparseRowModelDiagnostics
  invalidateRange(range: DataGridViewportRange): void
  invalidateRows(rowIds: readonly DataGridRowId[]): void
  invalidateAll(): void
  pauseBackpressure(): boolean
  resumeBackpressure(): boolean
  flushBackpressure(): Promise<void>
  getBackpressureDiagnostics(): DataGridDataSourceBackpressureDiagnostics
  getColumnHistogram?: (columnId: string, options?: DataGridColumnHistogramOptions) => DataGridColumnHistogramResult
}

interface InFlightPull {
  requestId: number
  controller: AbortController
  key: string
  stateKey: string
  range: DataGridViewportRange
  promise: Promise<void>
  priority: DataGridDataSourcePullPriority
  reason: DataGridDataSourcePullReason
  affectsLoading: boolean
}

interface PendingPull {
  range: DataGridViewportRange
  reason: DataGridDataSourcePullReason
  priority: DataGridDataSourcePullPriority
  key: string
  stateKey: string
  treeData: DataGridDataSourceTreePullContext | null
}

interface PullRangeOptions {
  replaceCacheOnSuccess?: boolean
  affectsLoading?: boolean
}

interface OptimisticEditTransaction<T> {
  id: number
  updatesByRowId: Map<DataGridRowId, Partial<T>>
  baselinesByRowId: Map<DataGridRowId, DataGridRowNode<T>>
}

const DEFAULT_ROW_CACHE_LIMIT = 4096
const DEFAULT_PREFETCH_MAX_BATCH_SIZE = 512
const DEFAULT_PREFETCH_TRIGGER_VIEWPORT_FACTOR = 1
const DEFAULT_PREFETCH_WINDOW_VIEWPORT_FACTOR = 3

function isAbortError(error: unknown): boolean {
  if (!error) {
    return false
  }
  const named = error as { name?: unknown }
  return named.name === "AbortError"
}

function normalizeRequestedRange(range: DataGridViewportRange): DataGridViewportRange {
  const start = Number.isFinite(range.start) ? Math.max(0, Math.trunc(range.start)) : 0
  const endCandidate = Number.isFinite(range.end) ? Math.max(0, Math.trunc(range.end)) : start
  return {
    start,
    end: Math.max(start, endCandidate),
  }
}

function rangesOverlap(left: DataGridViewportRange, right: DataGridViewportRange): boolean {
  return left.start <= right.end && right.start <= left.end
}

function rangeContains(container: DataGridViewportRange, target: DataGridViewportRange): boolean {
  return container.start <= target.start && container.end >= target.end
}

function normalizeTotal(total: number | null | undefined): number | null {
  if (!Number.isFinite(total)) {
    return null
  }
  return Math.max(0, Math.trunc(total as number))
}


function serializePullState(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ""
  } catch {
    return ""
  }
}

function resolvePriorityRank(priority: DataGridDataSourcePullPriority): number {
  switch (priority) {
    case "critical":
      return 3
    case "normal":
      return 2
    case "background":
      return 1
    default:
      return 0
  }
}

function normalizeTreePullContext(
  treeData: DataGridDataSourceTreePullContext | null | undefined,
): DataGridDataSourceTreePullContext | null {
  if (!treeData) {
    return null
  }
  const seenGroupKeys = new Set<string>()
  const groupKeys: string[] = []
  for (const rawGroupKey of treeData.groupKeys ?? []) {
    if (typeof rawGroupKey !== "string") {
      continue
    }
    const normalizedGroupKey = rawGroupKey.trim()
    if (normalizedGroupKey.length === 0 || seenGroupKeys.has(normalizedGroupKey)) {
      continue
    }
    seenGroupKeys.add(normalizedGroupKey)
    groupKeys.push(normalizedGroupKey)
  }
  return {
    operation: treeData.operation,
    scope: treeData.scope,
    groupKeys,
  }
}

function normalizeHistogramOptions(options: DataGridColumnHistogramOptions | undefined): DataGridColumnHistogramOptions {
  const search = String(options?.search ?? "").trim()
  return {
    ...(options ?? {}),
    ...(search.length > 0 ? { search } : {}),
  }
}

function cloneFilterSnapshotForHistogram(
  filterModel: DataGridFilterSnapshot | null,
  columnId: string,
  options: DataGridColumnHistogramOptions,
): DataGridFilterSnapshot | null {
  const cloned = cloneDataGridFilterSnapshot(filterModel)
  if (!cloned || options.ignoreSelfFilter !== true) {
    return cloned
  }
  const ignoredColumnId = columnId.trim()
  if (ignoredColumnId.length === 0) {
    return cloned
  }
  const columnFilters: NonNullable<DataGridFilterSnapshot["columnFilters"]> = {}
  for (const [rawKey, entry] of Object.entries(cloned.columnFilters ?? {})) {
    if (rawKey.trim() !== ignoredColumnId) {
      columnFilters[rawKey] = entry
    }
  }
  const columnStyleFilters: NonNullable<DataGridFilterSnapshot["columnStyleFilters"]> = {}
  for (const [rawKey, entry] of Object.entries(cloned.columnStyleFilters ?? {})) {
    if (rawKey.trim() !== ignoredColumnId) {
      columnStyleFilters[rawKey] = entry
    }
  }
  const advancedFilters: NonNullable<DataGridFilterSnapshot["advancedFilters"]> = {}
  for (const [rawKey, entry] of Object.entries(cloned.advancedFilters ?? {})) {
    if (rawKey.trim() !== ignoredColumnId) {
      advancedFilters[rawKey] = entry
    }
  }
  return {
    columnFilters,
    columnStyleFilters,
    advancedFilters,
    advancedExpression: cloned.advancedExpression ?? null,
  }
}

function normalizeColumnHistogramResult(entries: readonly unknown[]): DataGridColumnHistogram {
  const normalized = entries
    .map(entry => {
      const candidate = entry as { token?: unknown; value?: unknown; count?: unknown; text?: unknown }
      const token = String(candidate?.token ?? "").trim()
      if (token.length === 0) {
        return null
      }
      const count = Number.isFinite(candidate.count)
        ? Math.max(0, Math.trunc(candidate.count as number))
        : 0
      return {
        token,
        value: candidate.value,
        count,
        ...(typeof candidate.text === "string" ? { text: candidate.text } : {}),
      }
    })
    .filter((entry): entry is DataGridColumnHistogram[number] => entry !== null)
  return Object.freeze(normalized)
}

export function createDataSourceBackedRowModel<T = unknown>(
  options: CreateDataSourceBackedRowModelOptions<T>,
): DataSourceBackedRowModel<T> {
  const dataSource = options.dataSource
  const resolveRowId = options.resolveRowId
  let sortModel: readonly DataGridSortState[] = options.initialSortModel ? [...options.initialSortModel] : []
  let filterModel: DataGridFilterSnapshot | null = cloneDataGridFilterSnapshot(options.initialFilterModel ?? null)
  let groupBy: DataGridGroupBySpec | null = normalizeGroupBySpec(options.initialGroupBy ?? null)
  let pivotModel: DataGridPivotSpec | null = normalizePivotSpec(options.initialPivotModel ?? null)
  let pivotColumns: DataGridPivotColumn[] = []
  let aggregationModel: DataGridAggregationModel<T> | null = null
  let expansionExpandedByDefault = Boolean(groupBy?.expandedByDefault)
  let paginationInput = normalizePaginationInput(options.initialPagination ?? null)
  let paginationCursor: string | null = null
  const toggledGroupKeys = new Set<string>()
  let rowCount = Math.max(0, Math.trunc(options.initialTotal ?? 0))
  let initialLoading = false
  let refreshing = false
  let loading = false
  let error: Error | null = null
  let resolvedEmptyTotal = false
  let disposed = false
  let revision = 0
  let datasetVersion: string | number | null = null
  let requestCounter = 0
  let criticalInFlight: InFlightPull | null = null
  let backgroundInFlight: InFlightPull | null = null
  let pendingCriticalPull: PendingPull | null = null
  let pendingBackgroundPull: PendingPull | null = null
  let optimisticEditTransactionCounter = 0
  const optimisticEditTransactions = new Map<number, OptimisticEditTransaction<T>>()
  const optimisticEditTransactionOrder: number[] = []
  let optimisticEditQueue: Promise<void> = Promise.resolve()
  let backpressurePaused = false
  let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, rowCount)
  let lastViewportDirection: -1 | 0 | 1 = 0
  const rowCacheLimit =
    Number.isFinite(options.rowCacheLimit) && (options.rowCacheLimit as number) > 0
      ? Math.max(1, Math.trunc(options.rowCacheLimit as number))
      : DEFAULT_ROW_CACHE_LIMIT
  const prefetchOptions = (() => {
    const configured = options.prefetch ?? {}
    const enabled = configured.enabled === true
    const triggerViewportFactor = Number.isFinite(configured.triggerViewportFactor)
      ? Math.max(0, configured.triggerViewportFactor as number)
      : DEFAULT_PREFETCH_TRIGGER_VIEWPORT_FACTOR
    const windowViewportFactor = Number.isFinite(configured.windowViewportFactor)
      ? Math.max(1, configured.windowViewportFactor as number)
      : DEFAULT_PREFETCH_WINDOW_VIEWPORT_FACTOR
    const minBatchSize = Number.isFinite(configured.minBatchSize)
      ? Math.max(1, Math.trunc(configured.minBatchSize as number))
      : 1
    const maxBatchSize = Number.isFinite(configured.maxBatchSize)
      ? Math.max(minBatchSize, Math.trunc(configured.maxBatchSize as number))
      : Math.max(minBatchSize, DEFAULT_PREFETCH_MAX_BATCH_SIZE)
    const directionalBias = configured.directionalBias ?? "scroll-direction"
    return {
      enabled,
      triggerViewportFactor,
      windowViewportFactor,
      minBatchSize,
      maxBatchSize,
      directionalBias,
    } as const
  })()

  const rowCache = new Map<number, DataGridRowNode<T>>()
  const listeners = new Set<DataGridRowModelListener<T>>()
  const diagnostics: DataGridDataSourceBackpressureDiagnostics = {
    pullRequested: 0,
    pullCompleted: 0,
    pullAborted: 0,
    pullDropped: 0,
    pullCoalesced: 0,
    pullDeferred: 0,
    rowCacheEvicted: 0,
    pushApplied: 0,
    invalidatedRows: 0,
    inFlight: false,
    paused: false,
    hasPendingPull: false,
    rowCacheSize: 0,
    rowCacheLimit,
    prefetchScheduled: 0,
    prefetchStarted: 0,
    prefetchCompleted: 0,
    prefetchSkippedCached: 0,
    prefetchCoalesced: 0,
    prefetchDroppedStale: 0,
    prefetchAborted: 0,
    cachedAheadRows: 0,
    cachedBehindRows: 0,
    criticalInFlight: false,
    backgroundInFlight: false,
  }

  const unsubscribePush = typeof dataSource.subscribe === "function"
    ? dataSource.subscribe(event => {
        applyPushEvent(event)
      })
    : null

  function getProtectedSourceRanges(): readonly DataGridViewportRange[] {
    const protectedRanges: DataGridViewportRange[] = [toSourceRange(viewportRange)]
    const maybeAdd = (range: DataGridViewportRange | null | undefined) => {
      if (!range) {
        return
      }
      protectedRanges.push(range)
    }
    maybeAdd(criticalInFlight?.range)
    maybeAdd(backgroundInFlight?.range)
    maybeAdd(pendingCriticalPull?.range)
    maybeAdd(pendingBackgroundPull?.range)
    return protectedRanges
  }

  function isProtectedCacheIndex(index: number, protectedRanges: readonly DataGridViewportRange[]): boolean {
    for (const range of protectedRanges) {
      if (index >= range.start && index <= range.end) {
        return true
      }
    }
    return false
  }

  function enforceRowCacheLimit() {
    const protectedRanges = getProtectedSourceRanges()
    while (rowCache.size > rowCacheLimit) {
      let evictIndex: number | undefined
      for (const cachedIndex of rowCache.keys()) {
        if (!isProtectedCacheIndex(cachedIndex, protectedRanges)) {
          evictIndex = cachedIndex
          break
        }
      }
      if (typeof evictIndex === "undefined") {
        evictIndex = rowCache.keys().next().value as number | undefined
      }
      if (typeof evictIndex === "undefined") {
        break
      }
      if (rowCache.delete(evictIndex)) {
        diagnostics.rowCacheEvicted += 1
      }
    }
    diagnostics.rowCacheSize = rowCache.size
  }

  function bumpRevision() {
    revision += 1
  }

  function updateLoadingState() {
    const hasVisibleCache = rowCache.size > 0
    const criticalLoading = Boolean(criticalInFlight?.affectsLoading)
    initialLoading = !hasVisibleCache && criticalLoading
    refreshing = hasVisibleCache && criticalLoading
    loading = initialLoading || refreshing
  }

  function readRowCache(index: number): DataGridRowNode<T> | undefined {
    if (!rowCache.has(index)) {
      return undefined
    }
    const cached = rowCache.get(index)
    rowCache.delete(index)
    if (cached) {
      rowCache.set(index, cached)
    }
    return cached
  }

  function writeRowCache(index: number, row: DataGridRowNode<T>) {
    if (rowCache.has(index)) {
      rowCache.delete(index)
    }
    rowCache.set(index, row)
    enforceRowCacheLimit()
    diagnostics.rowCacheSize = rowCache.size
    updateLoadingState()
  }

  function writeRowCacheWithOptimisticOverlay(index: number, row: DataGridRowNode<T>) {
    const next = applyPendingOptimisticEditsToNode(row)
    writeRowCache(index, next)
  }

  function findCachedRowById(
    rowId: DataGridRowId,
  ): { index: number; node: DataGridRowNode<T> } | null {
    for (const [index, node] of rowCache.entries()) {
      if (node.rowId === rowId) {
        return { index, node }
      }
    }
    return null
  }

  function getPendingOptimisticTransactionsForRow(rowId: DataGridRowId): OptimisticEditTransaction<T>[] {
    const pending: OptimisticEditTransaction<T>[] = []
    for (const transactionId of optimisticEditTransactionOrder) {
      const transaction = optimisticEditTransactions.get(transactionId)
      if (!transaction || !transaction.updatesByRowId.has(rowId)) {
        continue
      }
      pending.push(transaction)
    }
    return pending
  }

  function applyPendingOptimisticEditsToNode(
    node: DataGridRowNode<T>,
    excludeTransactionId?: number,
  ): DataGridRowNode<T> {
    let nextNode = node
    for (const transaction of getPendingOptimisticTransactionsForRow(node.rowId)) {
      if (transaction.id === excludeTransactionId) {
        continue
      }
      const patch = transaction.updatesByRowId.get(node.rowId)
      if (!patch) {
        continue
      }
      const nextRow = applyRowDataPatch(nextNode.row, patch)
      if (nextRow === nextNode.row) {
        continue
      }
      nextNode = {
        ...nextNode,
        data: nextRow,
        row: nextRow,
      }
    }
    return nextNode
  }

  function removeOptimisticTransaction(transactionId: number): void {
    if (!optimisticEditTransactions.delete(transactionId)) {
      return
    }
    const orderIndex = optimisticEditTransactionOrder.indexOf(transactionId)
    if (orderIndex >= 0) {
      optimisticEditTransactionOrder.splice(orderIndex, 1)
    }
  }

  function shouldRefreshAfterOptimisticCommit(transaction: OptimisticEditTransaction<T>): boolean {
    const changedFields = collectChangedFieldsFromPatches(transaction.updatesByRowId)
    if (changedFields.size === 0) {
      return false
    }
    if (sortModel.length > 0 && doFieldPathsIntersect(changedFields, collectSortModelFields(sortModel))) {
      return true
    }
    const filterFields = collectFilterModelFields(filterModel)
    if (filterFields.size > 0 && doFieldPathsIntersect(changedFields, filterFields)) {
      return true
    }
    const groupFields = collectGroupByFields(groupBy)
    if (groupFields.size > 0 && doFieldPathsIntersect(changedFields, groupFields)) {
      return true
    }
    const pivotFields = collectPivotModelFields(pivotModel)
    if (pivotFields.size > 0 && doFieldPathsIntersect(changedFields, pivotFields)) {
      return true
    }
    const aggregationFields = collectAggregationModelFields(aggregationModel)
    if (aggregationFields.size > 0 && doFieldPathsIntersect(changedFields, aggregationFields)) {
      return true
    }
    return false
  }

  function rollbackOptimisticTransaction(
    transaction: OptimisticEditTransaction<T>,
    rowIds: readonly DataGridRowId[] = [...transaction.baselinesByRowId.keys()],
  ): boolean {
    let changed = false
    const affectedRows = new Set(rowIds)
    removeOptimisticTransaction(transaction.id)
    for (const rowId of affectedRows) {
      const baseline = transaction.baselinesByRowId.get(rowId)
      if (!baseline) {
        continue
      }
      const nextNode = applyPendingOptimisticEditsToNode(baseline)
      writeRowCache(nextNode.sourceIndex, nextNode)
      changed = true
    }
    return changed
  }

  async function processOptimisticCommit(transaction: OptimisticEditTransaction<T>): Promise<void> {
    try {
      const result = await Promise.resolve(
        getDataSourceCommitEdits!({
          edits: Array.from(transaction.updatesByRowId.entries()).map(([rowId, data]) => ({
            rowId,
            data,
          })),
        }),
      )

      if (disposed) {
        return
      }

      const rejectedRowIds = new Set<DataGridRowId>((result.rejected ?? []).map(entry => entry.rowId))
      const hasRejectedRows = rejectedRowIds.size > 0
      if (hasRejectedRows) {
        console.error("[DataGridDataSource] commitEdits returned rejected rows.", result.rejected)
        error = new Error(
          (result.rejected ?? [])
            .map(entry => entry.reason)
            .find((reason): reason is string => typeof reason === "string" && reason.length > 0)
          ?? "commitEdits returned rejected rows",
        )
        rollbackOptimisticTransaction(transaction, Array.from(rejectedRowIds))
        bumpRevision()
        emit()
        return
      }

      const needsProjectionRefresh = shouldRefreshAfterOptimisticCommit(transaction)
      removeOptimisticTransaction(transaction.id)
      error = null
      if (needsProjectionRefresh) {
        await pullRange(toSourceRange(viewportRange), "refresh", "critical")
      } else {
        updateCachedCoverageDiagnostics(toSourceRange(viewportRange))
        emit()
      }
    } catch (commitError) {
      if (disposed) {
        return
      }
      console.error("[DataGridDataSource] commitEdits failed.", commitError)
      error = commitError instanceof Error ? commitError : new Error(String(commitError))
      rollbackOptimisticTransaction(transaction)
      bumpRevision()
      emit()
    }
  }

  function pruneRowCacheByRowCount() {
    for (const index of rowCache.keys()) {
      if (index >= rowCount) {
        rowCache.delete(index)
      }
    }
    diagnostics.rowCacheSize = rowCache.size
    updateLoadingState()
  }

  function ensureActive() {
    if (disposed) {
      throw new Error("DataSourceBackedRowModel has been disposed")
    }
  }

  function getPaginationSnapshot() {
    return buildPaginationSnapshot(rowCount, paginationInput)
  }

  function getVisibleRowCount() {
    const pagination = getPaginationSnapshot()
    if (!pagination.enabled) {
      return pagination.totalRowCount
    }
    if (pagination.startIndex < 0 || pagination.endIndex < pagination.startIndex) {
      return 0
    }
    return pagination.endIndex - pagination.startIndex + 1
  }

  function toSourceIndex(index: number): number {
    const pagination = getPaginationSnapshot()
    if (!pagination.enabled || pagination.startIndex < 0) {
      return index
    }
    return pagination.startIndex + index
  }

  function toSourceRange(range: DataGridViewportRange): DataGridViewportRange {
    const visibleCount = getVisibleRowCount()
    if (visibleCount <= 0) {
      return { start: 0, end: 0 }
    }
    const normalized = normalizeViewportRange(range, visibleCount)
    return {
      start: toSourceIndex(normalized.start),
      end: toSourceIndex(normalized.end),
    }
  }

  function getViewportSize(range: DataGridViewportRange): number {
    return Math.max(0, range.end - range.start + 1)
  }

  function isRangeFullyCached(range: DataGridViewportRange): boolean {
    for (let index = range.start; index <= range.end; index += 1) {
      if (!rowCache.has(index)) {
        return false
      }
    }
    return true
  }

  function isIndexCached(index: number): boolean {
    return rowCache.has(index)
  }

  function countCoveredRowsForward(startIndex: number, upperBound: number): number {
    if (startIndex > upperBound) {
      return 0
    }
    let covered = 0
    for (let index = startIndex; index <= upperBound; index += 1) {
      if (!isIndexCached(index)) {
        break
      }
      covered += 1
    }
    return covered
  }

  function countCoveredRowsBackward(startIndex: number, lowerBound: number): number {
    if (startIndex < lowerBound) {
      return 0
    }
    let covered = 0
    for (let index = startIndex; index >= lowerBound; index -= 1) {
      if (!isIndexCached(index)) {
        break
      }
      covered += 1
    }
    return covered
  }

  function resolvePrefetchBatchSize(viewportSize: number): number {
    const scaledSize = Math.ceil(viewportSize * prefetchOptions.windowViewportFactor)
    return Math.max(
      prefetchOptions.minBatchSize,
      Math.min(prefetchOptions.maxBatchSize, Math.max(1, scaledSize)),
    )
  }

  function resolvePrefetchTriggerSize(viewportSize: number): number {
    return Math.max(1, Math.ceil(viewportSize * prefetchOptions.triggerViewportFactor))
  }

  function updateCachedCoverageDiagnostics(sourceViewport: DataGridViewportRange): void {
    if (rowCount <= 0) {
      diagnostics.cachedAheadRows = 0
      diagnostics.cachedBehindRows = 0
      return
    }
    diagnostics.cachedAheadRows = countCoveredRowsForward(
      sourceViewport.end + 1,
      Math.max(0, rowCount - 1),
    )
    diagnostics.cachedBehindRows = countCoveredRowsBackward(
      sourceViewport.start - 1,
      0,
    )
  }

  function getSnapshot(): DataGridRowModelSnapshot<T> {
    const pagination = getPaginationSnapshot()
    const visibleCount = getVisibleRowCount()
    viewportRange = normalizeViewportRange(viewportRange, visibleCount)
    return {
      revision,
      datasetVersion,
      kind: "server",
      rowCount: visibleCount,
      loading,
      initialLoading,
      refreshing,
      error,
      viewportRange,
      pagination,
      sortModel,
      filterModel: cloneDataGridFilterSnapshot(filterModel),
      groupBy: cloneGroupBySpec(groupBy),
      ...(pivotModel
        ? {
            pivotModel: clonePivotSpec(pivotModel),
            pivotColumns: clonePivotColumnsSnapshot(pivotColumns),
      }
        : {}),
      groupExpansion: buildGroupExpansionSnapshot(getExpansionSpec(), toggledGroupKeys),
    }
  }

  function getExpansionSpec(): DataGridGroupBySpec | null {
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

  function emit() {
    if (disposed || listeners.size === 0) {
      return
    }
    const snapshot = getSnapshot()
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  function updateTotalFromRows(rows: readonly DataGridDataSourceRowEntry<T>[]) {
    let maxIndex = -1
    for (const entry of rows) {
      const index = Number.isFinite(entry.index) ? Math.max(0, Math.trunc(entry.index)) : -1
      if (index > maxIndex) {
        maxIndex = index
      }
    }
    if (maxIndex >= rowCount) {
      rowCount = maxIndex + 1
    }
  }

  function normalizeRowEntry(entry: DataGridDataSourceRowEntry<T>) {
    const index = Number.isFinite(entry.index) ? Math.max(0, Math.trunc(entry.index)) : 0
    const rowId = (() => {
      if (typeof entry.rowId === "string" || typeof entry.rowId === "number") {
        return entry.rowId as DataGridRowId
      }
      if (entry.kind === "group") {
        throw new Error(
          `[DataGrid] Missing row identity for data-source group row at index ${index}. ` +
          "Server must provide deterministic rowId for group rows.",
        )
      }
      if (typeof resolveRowId === "function") {
        return resolveRowId(entry.row, index)
      }
      const fallback = (entry.row as { id?: unknown })?.id
      if (typeof fallback === "string" || typeof fallback === "number") {
        return fallback
      }
      throw new Error(
        `[DataGrid] Missing row identity for data-source row at index ${index}. Provide rowId or resolveRowId.`,
      )
    })()

    return {
      index,
      node: normalizeRowNode<T>(
        {
          row: entry.row,
          rowId,
          ...(entry.kind ? { kind: entry.kind } : {}),
          ...(entry.groupMeta ? { groupMeta: entry.groupMeta } : {}),
          originalIndex: index,
          displayIndex: index,
          state: entry.state,
        },
        index,
      ),
    }
  }

  function applyRows(rows: readonly DataGridDataSourceRowEntry<T>[]): boolean {
    if (rows.length === 0) {
      return false
    }
    for (const entry of rows) {
      const normalized = normalizeRowEntry(entry)
      writeRowCacheWithOptimisticOverlay(normalized.index, normalized.node)
    }
    updateTotalFromRows(rows)
    return true
  }

  function clearRange(
    range: DataGridViewportRange,
    options: { preserveRange?: DataGridViewportRange | null } = {},
  ) {
    const normalized = normalizeRequestedRange(range)
    const bounded = normalizeViewportRange(normalized, rowCount)
    const preserveRange = options.preserveRange ? normalizeRequestedRange(options.preserveRange) : null
    if (rowCount <= 0) {
      return
    }
    let changed = false
    for (let index = bounded.start; index <= bounded.end; index += 1) {
      if (preserveRange && index >= preserveRange.start && index <= preserveRange.end) {
        continue
      }
      if (rowCache.delete(index)) {
        diagnostics.invalidatedRows += 1
        changed = true
      }
    }
    if (changed) {
      bumpRevision()
    }
    diagnostics.rowCacheSize = rowCache.size
    updateLoadingState()
  }

  function clearRowsById(
    rowIds: readonly DataGridRowId[],
    options: { preserveRange?: DataGridViewportRange | null } = {},
  ): { changed: boolean; touchedViewport: boolean } {
    if (!Array.isArray(rowIds) || rowIds.length === 0 || rowCache.size === 0) {
      return {
        changed: false,
        touchedViewport: false,
      }
    }
    const uniqueRowIds = new Set<DataGridRowId>()
    for (const rowId of rowIds) {
      if (typeof rowId === "string" || typeof rowId === "number") {
        uniqueRowIds.add(rowId)
      }
    }
    if (uniqueRowIds.size === 0) {
      return {
        changed: false,
        touchedViewport: false,
      }
    }
    const sourceViewport = toSourceRange(viewportRange)
    const preserveRange = options.preserveRange ? normalizeRequestedRange(options.preserveRange) : null
    let changed = false
    let touchedViewport = false
    for (const [index, node] of rowCache.entries()) {
      if (!uniqueRowIds.has(node.rowId)) {
        continue
      }
      const touchesSourceViewport = index >= sourceViewport.start && index <= sourceViewport.end
      touchedViewport = touchedViewport || touchesSourceViewport
      if (preserveRange && index >= preserveRange.start && index <= preserveRange.end) {
        continue
      }
      if (rowCache.delete(index)) {
        diagnostics.invalidatedRows += 1
        changed = true
        if (backgroundInFlight && index >= backgroundInFlight.range.start && index <= backgroundInFlight.range.end) {
          clearBackgroundPrefetchState("stale")
        }
        if (pendingBackgroundPull && index >= pendingBackgroundPull.range.start && index <= pendingBackgroundPull.range.end) {
          diagnostics.prefetchDroppedStale += 1
          pendingBackgroundPull = null
          diagnostics.hasPendingPull = Boolean(pendingCriticalPull || pendingBackgroundPull)
        }
      }
    }
    if (changed) {
      bumpRevision()
    }
    diagnostics.rowCacheSize = rowCache.size
    updateLoadingState()
    return {
      changed,
      touchedViewport,
    }
  }

  function invalidateRows(rowIds: readonly DataGridRowId[]) {
    ensureActive()
    const sourceViewport = toSourceRange(viewportRange)
    const { changed, touchedViewport } = clearRowsById(rowIds, { preserveRange: sourceViewport })
    if (!changed && !touchedViewport) {
      return
    }
    if (touchedViewport) {
      void pullRange(sourceViewport, "invalidation", "normal", null, { affectsLoading: false })
      return
    }
    emit()
  }

  function clearAll() {
    if (rowCache.size > 0) {
      bumpRevision()
    }
    diagnostics.invalidatedRows += rowCache.size
    rowCache.clear()
    diagnostics.rowCacheSize = rowCache.size
    updateLoadingState()
  }

  function resolvePrefetchDirections(): readonly ("forward" | "backward")[] {
    switch (prefetchOptions.directionalBias) {
      case "forward":
        return ["forward"]
      case "backward":
        return ["backward"]
      case "symmetric":
        return ["forward", "backward"]
      case "scroll-direction":
      default:
        return lastViewportDirection < 0 ? ["backward", "forward"] : ["forward", "backward"]
    }
  }

  function buildPrefetchCandidate(
    sourceViewport: DataGridViewportRange,
    direction: "forward" | "backward",
  ): { range: DataGridViewportRange; cachedRows: number } | null {
    if (!prefetchOptions.enabled || rowCount <= 0) {
      return null
    }
    const viewportSize = getViewportSize(sourceViewport)
    if (viewportSize <= 0) {
      return null
    }
    const batchSize = resolvePrefetchBatchSize(viewportSize)
    const triggerSize = resolvePrefetchTriggerSize(viewportSize)
    if (direction === "forward") {
      if (sourceViewport.end >= rowCount - 1) {
        return null
      }
      const cachedRows = countCoveredRowsForward(sourceViewport.end + 1, rowCount - 1)
      if (cachedRows > triggerSize) {
        return null
      }
      const start = sourceViewport.end + 1 + cachedRows
      if (start >= rowCount) {
        return null
      }
      return {
        range: {
          start,
          end: Math.min(rowCount - 1, start + batchSize - 1),
        },
        cachedRows,
      }
    }
    if (sourceViewport.start <= 0) {
      return null
    }
    const cachedRows = countCoveredRowsBackward(sourceViewport.start - 1, 0)
    if (cachedRows > triggerSize) {
      return null
    }
    const end = sourceViewport.start - 1 - cachedRows
    if (end < 0) {
      return null
    }
    return {
      range: {
        start: Math.max(0, end - batchSize + 1),
        end,
      },
      cachedRows,
    }
  }

  function scheduleViewportPrefetch(): void {
    if (!prefetchOptions.enabled || disposed) {
      return
    }
    const visibleCount = getVisibleRowCount()
    if (visibleCount <= 0 || rowCount <= 0) {
      diagnostics.cachedAheadRows = 0
      diagnostics.cachedBehindRows = 0
      return
    }
    const sourceViewport = toSourceRange(viewportRange)
    updateCachedCoverageDiagnostics(sourceViewport)
    let bestCandidate: { range: DataGridViewportRange; cachedRows: number } | null = null
    for (const direction of resolvePrefetchDirections()) {
      const candidate = buildPrefetchCandidate(sourceViewport, direction)
      if (!candidate) {
        continue
      }
      if (!bestCandidate || candidate.cachedRows < bestCandidate.cachedRows) {
        bestCandidate = candidate
      }
      if (prefetchOptions.directionalBias !== "symmetric") {
        break
      }
    }
    if (!bestCandidate) {
      diagnostics.prefetchSkippedCached += 1
      return
    }
    if (isRangeFullyCached(bestCandidate.range)) {
      diagnostics.prefetchSkippedCached += 1
      return
    }
    diagnostics.prefetchScheduled += 1
    void pullRange(bestCandidate.range, "prefetch", "background")
  }

  function resetPaginationCursor(): void {
    paginationCursor = null
  }

  function readLaneInFlight(priority: DataGridDataSourcePullPriority): InFlightPull | null {
    return priority === "background" ? backgroundInFlight : criticalInFlight
  }

  function writeLaneInFlight(priority: DataGridDataSourcePullPriority, value: InFlightPull | null): void {
    if (priority === "background") {
      backgroundInFlight = value
    } else {
      criticalInFlight = value
    }
    diagnostics.criticalInFlight = Boolean(criticalInFlight)
    diagnostics.backgroundInFlight = Boolean(backgroundInFlight)
    diagnostics.inFlight = diagnostics.criticalInFlight || diagnostics.backgroundInFlight
    updateLoadingState()
  }

  function readPendingPull(priority: DataGridDataSourcePullPriority): PendingPull | null {
    return priority === "background" ? pendingBackgroundPull : pendingCriticalPull
  }

  function writePendingPull(priority: DataGridDataSourcePullPriority, value: PendingPull | null): void {
    if (priority === "background") {
      pendingBackgroundPull = value
    } else {
      pendingCriticalPull = value
    }
    diagnostics.hasPendingPull = Boolean(pendingCriticalPull || pendingBackgroundPull)
  }

  function abortLaneInFlight(priority: DataGridDataSourcePullPriority, reason: "stale" | "preempted" = "preempted") {
    const active = readLaneInFlight(priority)
    if (!active) {
      return
    }
    if (!active.controller.signal.aborted) {
      active.controller.abort()
      diagnostics.pullAborted += 1
      if (priority === "background") {
        diagnostics.prefetchAborted += 1
        if (reason === "stale") {
          diagnostics.prefetchDroppedStale += 1
        }
      }
    }
    writeLaneInFlight(priority, null)
  }

  function clearBackgroundPrefetchState(reason: "stale" | "reset" = "stale"): void {
    abortLaneInFlight("background", reason === "reset" ? "preempted" : reason)
    if (pendingBackgroundPull) {
      if (reason === "stale") {
        diagnostics.prefetchDroppedStale += 1
      }
      pendingBackgroundPull = null
    }
    diagnostics.hasPendingPull = Boolean(pendingCriticalPull || pendingBackgroundPull)
  }

  function buildRequestStateKey(): string {
    return serializePullState({
      sortModel,
      filterModel,
      groupBy,
      groupExpansion: buildGroupExpansionSnapshot(getExpansionSpec(), toggledGroupKeys),
      pivotModel,
      aggregationModel,
      pagination: getPaginationSnapshot(),
      cursor: paginationCursor,
    })
  }

  function buildRequestKey(
    requestRange: DataGridViewportRange,
    reason: DataGridDataSourcePullReason,
    priority: DataGridDataSourcePullPriority,
    treePullContext: DataGridDataSourceTreePullContext | null,
    stateKey: string,
  ): string {
    return serializePullState({
      range: requestRange,
      reason,
      priority,
      treeData: treePullContext,
      state: stateKey,
    })
  }

  function queuePendingPull(
    requestRange: DataGridViewportRange,
    reason: DataGridDataSourcePullReason,
    priority: DataGridDataSourcePullPriority,
    requestKey: string,
    requestStateKey: string,
    treePullContext: DataGridDataSourceTreePullContext | null,
  ): Promise<void> {
    const active = readLaneInFlight(priority)
    const pending = readPendingPull(priority)
    if (pending && pending.key === requestKey) {
      diagnostics.pullCoalesced += 1
      if (priority === "background") {
        diagnostics.prefetchCoalesced += 1
      }
      return active?.promise ?? Promise.resolve()
    }
    if (priority === "background" && pending && pending.stateKey === requestStateKey) {
      if (rangeContains(pending.range, requestRange)) {
        diagnostics.pullCoalesced += 1
        diagnostics.prefetchCoalesced += 1
        return active?.promise ?? Promise.resolve()
      }
      if (rangesOverlap(pending.range, requestRange) || pending.range.end + 1 === requestRange.start || requestRange.end + 1 === pending.range.start) {
        writePendingPull(priority, {
          range: {
            start: Math.min(pending.range.start, requestRange.start),
            end: Math.max(pending.range.end, requestRange.end),
          },
          reason,
          priority,
          key: buildRequestKey(
            {
              start: Math.min(pending.range.start, requestRange.start),
              end: Math.max(pending.range.end, requestRange.end),
            },
            reason,
            priority,
            treePullContext,
            requestStateKey,
          ),
          stateKey: requestStateKey,
          treeData: treePullContext,
        })
        diagnostics.pullCoalesced += 1
        diagnostics.prefetchCoalesced += 1
        diagnostics.pullDeferred += 1
        emit()
        return active?.promise ?? Promise.resolve()
      }
      diagnostics.prefetchDroppedStale += 1
    }
    const pendingRank = pending ? resolvePriorityRank(pending.priority) : -1
    const nextRank = resolvePriorityRank(priority)
    if (nextRank >= pendingRank) {
      writePendingPull(priority, {
        range: requestRange,
        reason,
        priority,
        key: requestKey,
        stateKey: requestStateKey,
        treeData: treePullContext,
      })
    }
    diagnostics.pullDeferred += 1
    emit()
    return active?.promise ?? Promise.resolve()
  }

  async function drainCriticalBackpressureQueue(): Promise<void> {
    while (!disposed) {
      const activeCritical = criticalInFlight?.promise ?? null
      if (activeCritical) {
        await activeCritical.catch(() => {})
        continue
      }
      const nextCritical = pendingCriticalPull
      if (nextCritical) {
        pendingCriticalPull = null
        diagnostics.hasPendingPull = Boolean(pendingCriticalPull || pendingBackgroundPull)
        await pullRange(nextCritical.range, nextCritical.reason, nextCritical.priority, nextCritical.treeData)
        continue
      }
      return
    }
  }

  async function pullRange(
    range: DataGridViewportRange,
    reason: DataGridDataSourcePullReason,
    priority: DataGridDataSourcePullPriority,
    treeData?: DataGridDataSourceTreePullContext | null,
    options?: PullRangeOptions,
  ): Promise<void> {
    if (disposed) {
      return
    }
    const requestRange = normalizeRequestedRange(range)
    const treePullContext = normalizeTreePullContext(treeData)
    const requestStateKey = buildRequestStateKey()
    const requestKey = buildRequestKey(requestRange, reason, priority, treePullContext, requestStateKey)
    const laneInFlight = readLaneInFlight(priority)

    if (priority === "background" && isRangeFullyCached(requestRange)) {
      diagnostics.prefetchSkippedCached += 1
      return
    }

    if (backpressurePaused) {
      return queuePendingPull(requestRange, reason, priority, requestKey, requestStateKey, treePullContext)
    }

    if (laneInFlight && !laneInFlight.controller.signal.aborted && laneInFlight.key === requestKey) {
      diagnostics.pullCoalesced += 1
      if (priority === "background") {
        diagnostics.prefetchCoalesced += 1
      }
      return laneInFlight.promise
    }

    if (
      reason === "viewport-change"
      && laneInFlight
      && !laneInFlight.controller.signal.aborted
      && laneInFlight.stateKey === requestStateKey
      && resolvePriorityRank(laneInFlight.priority) >= resolvePriorityRank(priority)
      && rangeContains(laneInFlight.range, requestRange)
    ) {
      diagnostics.pullCoalesced += 1
      return laneInFlight.promise
    }

    if (priority === "background") {
      const activeCritical = criticalInFlight
      if (activeCritical && !activeCritical.controller.signal.aborted) {
        return queuePendingPull(requestRange, reason, priority, requestKey, requestStateKey, treePullContext)
      }
      if (
        backgroundInFlight
        && !backgroundInFlight.controller.signal.aborted
        && backgroundInFlight.stateKey === requestStateKey
        && rangeContains(backgroundInFlight.range, requestRange)
      ) {
        diagnostics.pullCoalesced += 1
        diagnostics.prefetchCoalesced += 1
        return backgroundInFlight.promise
      }
      if (
        backgroundInFlight
        && !backgroundInFlight.controller.signal.aborted
        && backgroundInFlight.stateKey === requestStateKey
      ) {
        abortLaneInFlight("background", "preempted")
      }
    } else {
      if (
        backgroundInFlight
        && !backgroundInFlight.controller.signal.aborted
        && backgroundInFlight.stateKey === requestStateKey
        && rangesOverlap(backgroundInFlight.range, requestRange)
      ) {
        abortLaneInFlight("background", "preempted")
      }
      if (backgroundInFlight && backgroundInFlight.stateKey !== requestStateKey) {
        abortLaneInFlight("background", "stale")
      }
      if (pendingBackgroundPull && pendingBackgroundPull.stateKey !== requestStateKey) {
        diagnostics.prefetchDroppedStale += 1
        pendingBackgroundPull = null
        diagnostics.hasPendingPull = Boolean(pendingCriticalPull || pendingBackgroundPull)
      }
      if (criticalInFlight && !criticalInFlight.controller.signal.aborted) {
        const nextRank = resolvePriorityRank(priority)
        const activeRank = resolvePriorityRank(criticalInFlight.priority)
        if (nextRank < activeRank) {
          return queuePendingPull(requestRange, reason, priority, requestKey, requestStateKey, treePullContext)
        }
      }
    }

    if (laneInFlight && !laneInFlight.controller.signal.aborted) {
      abortLaneInFlight(priority, "preempted")
    }

    const requestId = requestCounter + 1
    requestCounter = requestId
    const controller = new AbortController()
    const requestPromise = (async () => {
      diagnostics.paused = backpressurePaused
      diagnostics.pullRequested += 1
      if (priority === "background") {
        diagnostics.prefetchStarted += 1
      }
      error = priority === "background" ? error : null

      try {
        const result = await dataSource.pull({
          range: requestRange,
          priority,
          reason,
          signal: controller.signal,
          sortModel,
          filterModel,
          groupBy: cloneGroupBySpec(groupBy),
          groupExpansion: buildGroupExpansionSnapshot(getExpansionSpec(), toggledGroupKeys),
          treeData: treePullContext,
          pivot: {
            pivotModel: clonePivotSpec(pivotModel),
            aggregationModel: clonePullAggregationModel(aggregationModel),
          },
          pagination: {
            snapshot: getPaginationSnapshot(),
            cursor: paginationCursor,
          },
        })

        const active = readLaneInFlight(priority)
        if (disposed || !active || active.requestId !== requestId || controller.signal.aborted) {
          diagnostics.pullDropped += 1
          if (priority === "background") {
            diagnostics.prefetchDroppedStale += 1
          }
          return
        }

        let changed = false
        if (typeof result.datasetVersion !== "undefined" && result.datasetVersion !== datasetVersion) {
          datasetVersion = result.datasetVersion ?? null
          changed = true
        }
        const previousRowCount = rowCount
        const nextTotal = normalizeTotal(result.total)
        if (nextTotal != null) {
          rowCount = nextTotal
          resolvedEmptyTotal = nextTotal === 0
          pruneRowCacheByRowCount()
          changed = changed || rowCount !== previousRowCount
          viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount())
        }
        if (options?.replaceCacheOnSuccess) {
          clearAll()
        }
        changed = applyRows(result.rows) || changed
        if (typeof result.cursor !== "undefined") {
          const normalizedCursor = result.cursor == null ? null : String(result.cursor)
          if (normalizedCursor !== paginationCursor) {
            paginationCursor = normalizedCursor
          }
        }
        if (pivotModel) {
          const normalizedPivotColumns = normalizePivotColumnsFromUnknown(result.pivotColumns)
          if (normalizedPivotColumns && !isSamePivotColumnsSnapshot(pivotColumns, normalizedPivotColumns)) {
            pivotColumns = normalizedPivotColumns
            changed = true
          }
        } else if (pivotColumns.length > 0) {
          pivotColumns = []
          changed = true
        }
        if (changed) {
          bumpRevision()
        }
        diagnostics.pullCompleted += 1
        if (priority === "background") {
          diagnostics.prefetchCompleted += 1
        }
        updateCachedCoverageDiagnostics(toSourceRange(viewportRange))
        if (priority !== "background") {
          scheduleViewportPrefetch()
        }
      } catch (reasonError) {
        if (isAbortError(reasonError)) {
          return
        }
        if (priority !== "background") {
          error = reasonError instanceof Error ? reasonError : new Error(String(reasonError))
        }
      } finally {
        const active = readLaneInFlight(priority)
        if (active && active.requestId === requestId) {
          writeLaneInFlight(priority, null)
          updateLoadingState()
          if (!disposed && !backpressurePaused) {
            if (!criticalInFlight && pendingCriticalPull) {
              const next = pendingCriticalPull
              pendingCriticalPull = null
              diagnostics.hasPendingPull = Boolean(pendingCriticalPull || pendingBackgroundPull)
              void pullRange(next.range, next.reason, next.priority, next.treeData)
            } else if (!backgroundInFlight && !criticalInFlight && pendingBackgroundPull) {
              const next = pendingBackgroundPull
              pendingBackgroundPull = null
              diagnostics.hasPendingPull = Boolean(pendingCriticalPull || pendingBackgroundPull)
              void pullRange(next.range, next.reason, next.priority, next.treeData)
            }
          }
        }
        updateLoadingState()
        emit()
      }
    })()

    writeLaneInFlight(priority, {
      requestId,
      controller,
      key: requestKey,
      stateKey: requestStateKey,
      range: requestRange,
      promise: requestPromise,
      priority,
      reason,
      affectsLoading: options?.affectsLoading !== false,
    })

    return requestPromise
  }

  function applyPushInvalidation(invalidation: DataGridDataSourceInvalidation) {
    if (invalidation.kind === "all") {
      clearAll()
      clearBackgroundPrefetchState("stale")
      if (typeof dataSource.invalidate === "function") {
        void Promise.resolve(dataSource.invalidate(invalidation))
      }
      void pullRange(toSourceRange(viewportRange), "push-invalidation", "normal")
      return
    }

    if (invalidation.kind === "rows") {
      invalidateRows(invalidation.rowIds)
      if (typeof dataSource.invalidate === "function") {
        void Promise.resolve(dataSource.invalidate(invalidation))
      }
      return
    }

    const normalizedInvalidationRange = normalizeRequestedRange(invalidation.range)
    const sourceViewport = toSourceRange(viewportRange)
    const touchesViewport = rangesOverlap(normalizedInvalidationRange, sourceViewport)
    clearRange(invalidation.range, touchesViewport ? { preserveRange: sourceViewport } : {})
    if (backgroundInFlight && rangesOverlap(backgroundInFlight.range, normalizedInvalidationRange)) {
      clearBackgroundPrefetchState("stale")
    }
    if (typeof dataSource.invalidate === "function") {
      void Promise.resolve(dataSource.invalidate(invalidation))
    }
    if (touchesViewport) {
      void pullRange(sourceViewport, "push-invalidation", "normal", null, { affectsLoading: false })
    } else {
      emit()
    }
  }

  function applyPushEvent(event: DataGridDataSourcePushEvent<T>) {
    if (disposed) {
      return
    }
    diagnostics.pushApplied += 1
    let versionChanged = false
    if (typeof event.datasetVersion !== "undefined" && event.datasetVersion !== datasetVersion) {
      datasetVersion = event.datasetVersion ?? null
      versionChanged = true
    }

    if (event.type === "upsert") {
      let changed = applyRows(event.rows) || versionChanged
      if (typeof event.cursor !== "undefined") {
        const normalizedCursor = event.cursor == null ? null : String(event.cursor)
        if (normalizedCursor !== paginationCursor) {
          paginationCursor = normalizedCursor
        }
      }
      const previousRowCount = rowCount
      const nextTotal = normalizeTotal(event.total)
      if (nextTotal != null) {
        rowCount = nextTotal
        resolvedEmptyTotal = nextTotal === 0
        pruneRowCacheByRowCount()
        changed = changed || rowCount !== previousRowCount
        viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount())
      }
      if (pivotModel) {
        const normalizedPivotColumns = normalizePivotColumnsFromUnknown(event.pivotColumns)
        if (normalizedPivotColumns && !isSamePivotColumnsSnapshot(pivotColumns, normalizedPivotColumns)) {
          pivotColumns = normalizedPivotColumns
          changed = true
        }
      } else if (pivotColumns.length > 0) {
        pivotColumns = []
        changed = true
      }
      if (changed) {
        bumpRevision()
      }
      updateCachedCoverageDiagnostics(toSourceRange(viewportRange))
      emit()
      return
    }

    if (event.type === "remove") {
      let changed = versionChanged
      for (const rawIndex of event.indexes) {
        const index = Number.isFinite(rawIndex) ? Math.max(0, Math.trunc(rawIndex)) : -1
        if (index >= 0) {
          changed = rowCache.delete(index) || changed
        }
      }
      diagnostics.rowCacheSize = rowCache.size
      const previousRowCount = rowCount
      const nextTotal = normalizeTotal(event.total)
      if (nextTotal != null) {
        rowCount = nextTotal
        resolvedEmptyTotal = nextTotal === 0
        pruneRowCacheByRowCount()
        changed = changed || rowCount !== previousRowCount
        viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount())
      }
      if (changed) {
        bumpRevision()
      }
      updateCachedCoverageDiagnostics(toSourceRange(viewportRange))
      emit()
      return
    }

    applyPushInvalidation(event.invalidation)
  }

  function createTreePullContext(
    operation: DataGridDataSourceTreePullContext["operation"],
    groupKeys: readonly string[],
    scope: DataGridDataSourceTreePullContext["scope"] = "branch",
  ): DataGridDataSourceTreePullContext {
    return {
      operation,
      scope,
      groupKeys: toUniqueGroupKeys(groupKeys),
    }
  }

  function toUniqueGroupKeys(groupKeys: readonly string[]): readonly string[] {
    const seen = new Set<string>()
    const normalized: string[] = []
    for (const rawGroupKey of groupKeys) {
      if (typeof rawGroupKey !== "string") {
        continue
      }
      const groupKey = rawGroupKey.trim()
      if (groupKey.length === 0 || seen.has(groupKey)) {
        continue
      }
      seen.add(groupKey)
      normalized.push(groupKey)
    }
    return normalized
  }

  function getPivotPullContext(): DataGridDataSourcePivotPullContext {
    return {
      pivotModel: clonePivotSpec(pivotModel),
      aggregationModel: clonePullAggregationModel(aggregationModel),
    }
  }

  const getDataSourceColumnHistogram = dataSource.getColumnHistogram
  const getDataSourceCommitEdits = dataSource.commitEdits
  const histogramMethods: Pick<DataSourceBackedRowModel<T>, "getColumnHistogram"> =
    typeof getDataSourceColumnHistogram === "function"
      ? {
          getColumnHistogram(columnId: string, histogramOptions?: DataGridColumnHistogramOptions) {
            ensureActive()
            const normalizedColumnId = String(columnId ?? "").trim()
            if (normalizedColumnId.length === 0) {
              return []
            }
            const options = normalizeHistogramOptions(histogramOptions)
            const controller = new AbortController()
            return getDataSourceColumnHistogram({
              columnId: normalizedColumnId,
              options,
              signal: controller.signal,
              sortModel,
              filterModel: cloneFilterSnapshotForHistogram(filterModel, normalizedColumnId, options),
              groupBy: cloneGroupBySpec(groupBy),
              groupExpansion: buildGroupExpansionSnapshot(getExpansionSpec(), toggledGroupKeys),
              treeData: null,
              pivot: getPivotPullContext(),
              pagination: {
                snapshot: getPaginationSnapshot(),
                cursor: paginationCursor,
              },
            }).then(result => normalizeColumnHistogramResult(result))
        },
      }
      : {}

  const patchMethods: Pick<DataSourceBackedRowModel<T>, "patchRows"> =
    typeof getDataSourceCommitEdits === "function"
      ? {
          patchRows(updates) {
            ensureActive()
            if (!Array.isArray(updates) || updates.length === 0) {
              return
            }
            const transactionId = ++optimisticEditTransactionCounter
            const baselinesByRowId = new Map<DataGridRowId, DataGridRowNode<T>>()
            const updatesByRowId = new Map<DataGridRowId, Partial<T>>()
            let changed = false

            for (const update of updates) {
              if (!update || typeof update.rowId !== "string" && typeof update.rowId !== "number") {
                continue
              }
              if (typeof update.data === "undefined" || update.data === null) {
                continue
              }
              const existingPatch = updatesByRowId.get(update.rowId)
              updatesByRowId.set(
                update.rowId,
                existingPatch ? mergeRowPatch(existingPatch, update.data) : update.data,
              )

              const cached = findCachedRowById(update.rowId)
              if (!cached) {
                continue
              }
              if (!baselinesByRowId.has(update.rowId)) {
                baselinesByRowId.set(update.rowId, cached.node)
              }
              const nextRow = applyRowDataPatch(cached.node.row, update.data)
              if (nextRow === cached.node.row) {
                continue
              }
              writeRowCache(cached.index, {
                ...cached.node,
                data: nextRow,
                row: nextRow,
              })
              changed = true
            }

            if (updatesByRowId.size === 0) {
              return Promise.resolve()
            }

            const transaction: OptimisticEditTransaction<T> = {
              id: transactionId,
              updatesByRowId,
              baselinesByRowId,
            }
            optimisticEditTransactions.set(transactionId, transaction)
            optimisticEditTransactionOrder.push(transactionId)

            if (changed) {
              bumpRevision()
              emit()
            }

            const previousCommitQueue = optimisticEditQueue
            const commitTask = previousCommitQueue.then(() => processOptimisticCommit(transaction))
            optimisticEditQueue = commitTask.then(() => undefined, () => undefined)
            return commitTask
          },
        }
      : {}

  return {
    kind: "server",
    dataSource,
    ...histogramMethods,
    ...patchMethods,
    getSparseRowModelDiagnostics() {
      return {
        kind: "data-source",
        rowCount: getVisibleRowCount(),
        viewportRange: { ...viewportRange },
        cachedRowCount: rowCache.size,
        cacheLimit: rowCacheLimit,
      }
    },
    getSnapshot,
    getRowCount() {
      return getVisibleRowCount()
    },
    getRow(index) {
      if (!Number.isFinite(index)) {
        return undefined
      }
      const normalized = Math.max(0, Math.trunc(index))
      const visibleCount = getVisibleRowCount()
      if (normalized >= visibleCount) {
        return undefined
      }
      return readRowCache(toSourceIndex(normalized))
    },
    getRowsInRange(range) {
      const visibleCount = getVisibleRowCount()
      const normalized = normalizeViewportRange(range, visibleCount)
      if (visibleCount <= 0) {
        return []
      }
      const rows = []
      for (let index = normalized.start; index <= normalized.end; index += 1) {
        const row = readRowCache(toSourceIndex(index))
        if (row) {
          rows.push(row)
        }
      }
      return rows
    },
    setViewportRange(range) {
      ensureActive()
      const requested = normalizeRequestedRange(range)
      const visibleCount = getVisibleRowCount()
      const nextViewport = visibleCount > 0 ? normalizeViewportRange(requested, visibleCount) : requested
      const unchanged =
        nextViewport.start === viewportRange.start &&
        nextViewport.end === viewportRange.end
      lastViewportDirection = nextViewport.start > viewportRange.start
        ? 1
        : nextViewport.start < viewportRange.start
          ? -1
          : lastViewportDirection
      viewportRange = nextViewport
      const sourceViewport = toSourceRange(nextViewport)

      if (resolvedEmptyTotal && rowCount <= 0) {
        updateCachedCoverageDiagnostics(sourceViewport)
        if (!unchanged) {
          emit()
        }
        return
      }

      if (unchanged) {
        if (isRangeFullyCached(sourceViewport)) {
          scheduleViewportPrefetch()
          return
        }
      }

      if (isRangeFullyCached(sourceViewport)) {
        scheduleViewportPrefetch()
        emit()
        return
      }

      void pullRange(sourceViewport, "viewport-change", "critical")
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
      resetPaginationCursor()
      clearBackgroundPrefetchState("stale")
      viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount())
      bumpRevision()
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
      resetPaginationCursor()
      clearBackgroundPrefetchState("stale")
      viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount())
      bumpRevision()
      emit()
    },
    setCurrentPage(page: number) {
      ensureActive()
      const normalizedPage = normalizePaginationInput({
        pageSize: paginationInput.pageSize,
        currentPage: page,
      }).currentPage
      if (normalizedPage === paginationInput.currentPage) {
        return
      }
      paginationInput = {
        ...paginationInput,
        currentPage: normalizedPage,
      }
      resetPaginationCursor()
      clearBackgroundPrefetchState("stale")
      viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount())
      bumpRevision()
      emit()
    },
    setSortModel(nextSortModel) {
      ensureActive()
      sortModel = Array.isArray(nextSortModel) ? [...nextSortModel] : []
      resetPaginationCursor()
      clearBackgroundPrefetchState("stale")
      bumpRevision()
      void pullRange(toSourceRange(viewportRange), "sort-change", "critical", null, {
        replaceCacheOnSuccess: true,
      })
      emit()
    },
    setFilterModel(nextFilterModel) {
      ensureActive()
      filterModel = cloneDataGridFilterSnapshot(nextFilterModel ?? null)
      resetPaginationCursor()
      clearBackgroundPrefetchState("stale")
      bumpRevision()
      void pullRange(toSourceRange(viewportRange), "filter-change", "critical", null, {
        replaceCacheOnSuccess: true,
      })
      emit()
    },
    setSortAndFilterModel(input) {
      ensureActive()
      const nextSortModel = Array.isArray(input?.sortModel) ? [...input.sortModel] : []
      const nextFilterModel = cloneDataGridFilterSnapshot(input?.filterModel ?? null)
      const sortChanged = !isSameSortModel(sortModel, nextSortModel)
      const filterChanged = !isSameFilterModel(filterModel, nextFilterModel)
      if (!sortChanged && !filterChanged) {
        return
      }
      sortModel = nextSortModel
      filterModel = nextFilterModel
      resetPaginationCursor()
      clearBackgroundPrefetchState("stale")
      bumpRevision()
      void pullRange(
        toSourceRange(viewportRange),
        sortChanged ? "sort-change" : "filter-change",
        "critical",
        null,
        {
          replaceCacheOnSuccess: true,
        },
      )
      emit()
    },
    setGroupBy(nextGroupBy) {
      ensureActive()
      const normalized = normalizeGroupBySpec(nextGroupBy)
      if (isSameGroupBySpec(groupBy, normalized)) {
        return
      }
      groupBy = normalized
      expansionExpandedByDefault = Boolean(normalized?.expandedByDefault)
      toggledGroupKeys.clear()
      resetPaginationCursor()
      clearBackgroundPrefetchState("stale")
      bumpRevision()
      void pullRange(
        toSourceRange(viewportRange),
        "group-change",
        "critical",
        createTreePullContext("set-group-by", [], "all"),
        {
          replaceCacheOnSuccess: true,
        },
      )
      emit()
    },
    setPivotModel(nextPivotModel) {
      ensureActive()
      const normalized = normalizePivotSpec(nextPivotModel)
      if (isSamePivotSpec(pivotModel, normalized)) {
        return
      }
      pivotModel = normalized
      pivotColumns = []
      resetPaginationCursor()
      clearBackgroundPrefetchState("stale")
      bumpRevision()
      void pullRange(toSourceRange(viewportRange), "group-change", "critical", null, {
        replaceCacheOnSuccess: true,
      })
      emit()
    },
    getPivotModel() {
      return clonePivotSpec(pivotModel)
    },
    setAggregationModel(nextAggregationModel) {
      ensureActive()
      const normalized = clonePullAggregationModel(nextAggregationModel ?? null)
      if (isSamePullAggregationModel(aggregationModel, normalized)) {
        return
      }
      aggregationModel = normalized
      resetPaginationCursor()
      clearBackgroundPrefetchState("stale")
      bumpRevision()
      void pullRange(toSourceRange(viewportRange), "group-change", "critical", null, {
        replaceCacheOnSuccess: true,
      })
      emit()
    },
    getAggregationModel() {
      return clonePullAggregationModel(aggregationModel)
    },
    setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null) {
      ensureActive()
      if (!applyGroupExpansion(expansion)) {
        return
      }
      resetPaginationCursor()
      clearBackgroundPrefetchState("stale")
      bumpRevision()
      void pullRange(
        toSourceRange(viewportRange),
        "group-change",
        "critical",
        createTreePullContext("set-group-expansion", expansion?.toggledGroupKeys ?? [], "all"),
      )
      emit()
    },
    toggleGroup(groupKey: string) {
      ensureActive()
      if (!getExpansionSpec()) {
        return
      }
      if (!toggleGroupExpansionKey(toggledGroupKeys, groupKey)) {
        return
      }
      resetPaginationCursor()
      clearBackgroundPrefetchState("stale")
      bumpRevision()
      void pullRange(
        toSourceRange(viewportRange),
        "group-change",
        "critical",
        createTreePullContext("toggle-group", [groupKey]),
      )
      emit()
    },
    expandGroup(groupKey: string) {
      ensureActive()
      if (!getExpansionSpec()) {
        return
      }
      if (!setGroupExpansionKey(toggledGroupKeys, groupKey, expansionExpandedByDefault, true)) {
        return
      }
      resetPaginationCursor()
      clearBackgroundPrefetchState("stale")
      bumpRevision()
      void pullRange(
        toSourceRange(viewportRange),
        "group-change",
        "critical",
        createTreePullContext("expand-group", [groupKey]),
      )
      emit()
    },
    collapseGroup(groupKey: string) {
      ensureActive()
      if (!getExpansionSpec()) {
        return
      }
      if (!setGroupExpansionKey(toggledGroupKeys, groupKey, expansionExpandedByDefault, false)) {
        return
      }
      resetPaginationCursor()
      clearBackgroundPrefetchState("stale")
      bumpRevision()
      void pullRange(
        toSourceRange(viewportRange),
        "group-change",
        "critical",
        createTreePullContext("collapse-group", [groupKey]),
      )
      emit()
    },
    expandAllGroups() {
      ensureActive()
      if (!getExpansionSpec()) {
        return
      }
      if (expansionExpandedByDefault && toggledGroupKeys.size === 0) {
        return
      }
      expansionExpandedByDefault = true
      toggledGroupKeys.clear()
      resetPaginationCursor()
      clearBackgroundPrefetchState("stale")
      bumpRevision()
      clearAll()
      void pullRange(
        toSourceRange(viewportRange),
        "group-change",
        "critical",
        createTreePullContext("expand-all-groups", [], "all"),
      )
      emit()
    },
    collapseAllGroups() {
      ensureActive()
      if (!getExpansionSpec()) {
        return
      }
      if (!expansionExpandedByDefault && toggledGroupKeys.size === 0) {
        return
      }
      expansionExpandedByDefault = false
      toggledGroupKeys.clear()
      resetPaginationCursor()
      clearBackgroundPrefetchState("stale")
      bumpRevision()
      clearAll()
      void pullRange(
        toSourceRange(viewportRange),
        "group-change",
        "critical",
        createTreePullContext("collapse-all-groups", [], "all"),
      )
      emit()
    },
    async refresh(reason?: DataGridRowModelRefreshReason) {
      ensureActive()
      if (reason === "reset") {
        clearAll()
        clearBackgroundPrefetchState("stale")
        if (typeof dataSource.invalidate === "function") {
          await dataSource.invalidate({ kind: "all", reason: "reset" })
        }
      }
      await pullRange(toSourceRange(viewportRange), "refresh", "critical")
    },
    invalidateRange(range) {
      ensureActive()
      const sourceRange = toSourceRange(range)
      const invalidation: DataGridDataSourceInvalidation = { kind: "range", range: sourceRange, reason: "model-range" }
      const normalizedSourceRange = normalizeRequestedRange(sourceRange)
      const sourceViewport = toSourceRange(viewportRange)
      const touchesViewport = rangesOverlap(normalizedSourceRange, sourceViewport)
      clearRange(sourceRange, touchesViewport ? { preserveRange: sourceViewport } : {})
      if (backgroundInFlight && rangesOverlap(backgroundInFlight.range, sourceRange)) {
        clearBackgroundPrefetchState("stale")
      }
      if (pendingBackgroundPull && rangesOverlap(pendingBackgroundPull.range, sourceRange)) {
        diagnostics.prefetchDroppedStale += 1
        pendingBackgroundPull = null
        diagnostics.hasPendingPull = Boolean(pendingCriticalPull || pendingBackgroundPull)
      }
      if (typeof dataSource.invalidate === "function") {
        void Promise.resolve(dataSource.invalidate(invalidation))
      }
      if (touchesViewport) {
        void pullRange(sourceViewport, "invalidation", "normal", null, { affectsLoading: false })
      } else {
        emit()
      }
    },
    invalidateRows(rowIds) {
      ensureActive()
      const sourceViewport = toSourceRange(viewportRange)
      const { changed, touchedViewport } = clearRowsById(rowIds, { preserveRange: sourceViewport })
      if (!changed && !touchedViewport) {
        return
      }
      if (touchedViewport) {
        void pullRange(sourceViewport, "invalidation", "normal", null, { affectsLoading: false })
      } else {
        emit()
      }
    },
    invalidateAll() {
      ensureActive()
      clearAll()
      clearBackgroundPrefetchState("stale")
      if (typeof dataSource.invalidate === "function") {
        void Promise.resolve(dataSource.invalidate({ kind: "all", reason: "model-all" }))
      }
      void pullRange(toSourceRange(viewportRange), "invalidation", "normal")
    },
    pauseBackpressure() {
      ensureActive()
      if (backpressurePaused) {
        return false
      }
      backpressurePaused = true
      diagnostics.paused = true
      emit()
      return true
    },
    resumeBackpressure() {
      ensureActive()
      if (!backpressurePaused) {
        return false
      }
      backpressurePaused = false
      diagnostics.paused = false
      if (pendingCriticalPull && !criticalInFlight) {
        const next = pendingCriticalPull
        pendingCriticalPull = null
        diagnostics.hasPendingPull = Boolean(pendingCriticalPull || pendingBackgroundPull)
        void pullRange(next.range, next.reason, next.priority, next.treeData)
      } else if (pendingBackgroundPull && !criticalInFlight && !backgroundInFlight) {
        const next = pendingBackgroundPull
        pendingBackgroundPull = null
        diagnostics.hasPendingPull = Boolean(pendingCriticalPull || pendingBackgroundPull)
        void pullRange(next.range, next.reason, next.priority, next.treeData)
      } else {
        emit()
      }
      return true
    },
    async flushBackpressure() {
      ensureActive()
      const wasPaused = backpressurePaused
      if (wasPaused) {
        backpressurePaused = false
        diagnostics.paused = false
      }
      // Flush is a foreground sync point; opportunistic prefetch must not keep callers waiting.
      clearBackgroundPrefetchState("reset")
      try {
        await drainCriticalBackpressureQueue()
      } finally {
        clearBackgroundPrefetchState("reset")
        if (wasPaused && !disposed) {
          backpressurePaused = true
          diagnostics.paused = true
        }
        emit()
      }
    },
    getBackpressureDiagnostics() {
      diagnostics.criticalInFlight = Boolean(criticalInFlight)
      diagnostics.backgroundInFlight = Boolean(backgroundInFlight)
      diagnostics.inFlight = diagnostics.criticalInFlight || diagnostics.backgroundInFlight
      diagnostics.hasPendingPull = Boolean(pendingCriticalPull || pendingBackgroundPull)
      diagnostics.paused = backpressurePaused
      diagnostics.rowCacheSize = rowCache.size
      updateCachedCoverageDiagnostics(toSourceRange(viewportRange))
      return { ...diagnostics }
    },
    subscribe(listener) {
      if (disposed) {
        return () => {}
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      abortLaneInFlight("critical", "stale")
      abortLaneInFlight("background", "stale")
      listeners.clear()
      rowCache.clear()
      pendingCriticalPull = null
      pendingBackgroundPull = null
      diagnostics.inFlight = false
      diagnostics.criticalInFlight = false
      diagnostics.backgroundInFlight = false
      diagnostics.paused = false
      diagnostics.hasPendingPull = false
      diagnostics.rowCacheSize = 0
      unsubscribePush?.()
    },
  }
}
