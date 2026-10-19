import {
  buildGroupExpansionSnapshot,
  cloneGroupBySpec,
  isSameGroupExpansionSnapshot,
  isSameGroupBySpec,
  normalizePaginationInput,
  normalizeGroupBySpec,
  normalizeViewportRange,
  setGroupExpansionKey,
  toggleGroupExpansionKey,
  type DataGridGroupExpansionSnapshot,
  type DataGridPaginationInput,
  type DataGridFilterSnapshot,
  type DataGridGroupBySpec,
  type DataGridAggregationModel,
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
import {
  cloneFilterSnapshotForHistogram,
  normalizeColumnHistogramOptions,
  normalizeColumnHistogramResult,
} from "./dataSourceBackedRowModelHistogram.js"
import { isSameFilterModel, isSameSortModel } from "./projection/clientRowProjectionPrimitives.js"
import { applyRowDataPatch } from "./clientRowRuntimeUtils.js"
import {
  shouldRefreshAfterExternalUpdate as resolveExternalProjectionRefresh,
  shouldRefreshAfterOptimisticCommit as resolveOptimisticProjectionRefresh,
} from "./server/dataSourceProjectionRefreshPolicy.js"
import {
  clonePullAggregationModel,
  clonePivotColumnsSnapshot,
  isSamePivotColumnsSnapshot,
  isSamePullAggregationModel,
  normalizePivotColumnsFromUnknown,
} from "./server/pullRowModelSerialization.js"
import {
  resolveDataGridVelocityOverscanRange,
  type DataGridVelocityOverscanSample,
} from "./server/velocityOverscan.js"
import {
  isAbortError,
  normalizeRequestedRange,
  normalizeTreePullContext,
  rangeContains,
  rangesOverlap,
  type DataGridDataSourceInFlightPull as InFlightPull,
  type DataGridDataSourcePendingPull as PendingPull,
  type DataGridDataSourcePullRangeOptions as PullRangeOptions,
} from "./server/dataSourceTransportCoordinator.js"
import {
  buildDataSourceCacheStoreKey,
  buildDataSourcePullStateKey,
  buildDataSourceRequestKey,
} from "./server/dataSourceRequestIdentity.js"
import { createDataSourceOptimisticPatchRuntime } from "./server/dataSourceOptimisticPatchRuntime.js"
import { createDataSourceOptimisticCommitRuntime } from "./server/dataSourceOptimisticCommitRuntime.js"
import {
  createDataSourceExternalUpdateRuntime,
  type DataGridExternalRowUpdate,
  type DataGridExternalRowUpdateOptions,
} from "./server/dataSourceExternalUpdateRuntime.js"
import { createDataSourceTelemetryRuntime } from "./server/dataSourceTelemetryRuntime.js"
import { createDataSourcePullSchedulingRuntime } from "./server/dataSourcePullSchedulingRuntime.js"
import { resolveDataSourcePullRequestPolicy } from "./server/dataSourcePullRequestPolicy.js"
import { createDataSourceRangeMappingRuntime } from "./server/dataSourceRangeMappingRuntime.js"
import {
  countCoveredRowsBackward as countCoveredRowsBackwardPolicy,
  countCoveredRowsForward as countCoveredRowsForwardPolicy,
  measureDataSourceViewportCoverage,
  measureDataSourceViewportLoading,
} from "./server/dataSourceCoveragePolicy.js"
import {
  createDataSourceOptimisticMutationEngine,
  type DataSourceOptimisticEditTransaction as OptimisticEditTransaction,
} from "./server/dataSourceOptimisticMutationEngine.js"
import {
  rangeFromIndexes,
  resolveVisibleRangeInvalidation,
} from "./server/dataSourceInvalidationEngine.js"
import { createDataSourceCacheStoreRuntime } from "./server/dataSourceCacheStoreRuntime.js"
import { createDataSourcePendingPullRuntime } from "./server/dataSourcePendingPullRuntime.js"
import { createDataSourcePrefetchRuntime } from "./server/dataSourcePrefetchPolicy.js"
import { createDataSourceCacheInvalidationRuntime } from "./server/dataSourceCacheInvalidationRuntime.js"
import { createDataSourcePushInvalidationRuntime } from "./server/dataSourcePushInvalidationRuntime.js"
import { createDataSourcePushEventRuntime } from "./server/dataSourcePushEventRuntime.js"
import { normalizeDataSourceRowEntry } from "./server/dataSourceRowEntry.js"
import { createDataSourcePlaceholderRow } from "./server/dataSourcePlaceholderRow.js"
import { createDataSourcePullScheduler } from "./server/dataSourceScheduler.js"
import {
  createDataSourceRuntimeLifecycle,
  type DataSourceRuntimeLifecycle,
} from "./server/dataSourceRuntimeLifecycle.js"
import { createDataSourceRuntimeSignals } from "./server/dataSourceRuntimeSignals.js"
import { resolveDataSourceRuntimeState } from "./server/dataSourceRuntimeStateMachine.js"
import type {
  DataGridDataSource,
  DataGridDataSourceBackpressureDiagnostics,
  DataGridDataSourceInvalidation,
  DataGridDataSourcePivotPullContext,
  DataGridDataSourcePullPriority,
  DataGridDataSourcePullReason,
  DataGridDataSourceTreePullContext,
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
  rowCacheMaxBytes?: number
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
  applyExternalUpdates?: (
    updates: readonly DataGridExternalRowUpdate<T>[],
    options?: DataGridExternalRowUpdateOptions,
  ) => void | Promise<void>
  getSparseRowModelDiagnostics(): DataGridSparseRowModelDiagnostics
  getLoadedRowIntervals(range: DataGridViewportRange): DataGridViewportRange[]
  invalidateRange(range: DataGridViewportRange): void
  invalidateRows(rowIds: readonly DataGridRowId[]): void
  invalidateAll(): void
  pauseBackpressure(): boolean
  resumeBackpressure(): boolean
  flushBackpressure(): Promise<void>
  getBackpressureDiagnostics(): DataGridDataSourceBackpressureDiagnostics
  getColumnHistogram?: (columnId: string, options?: DataGridColumnHistogramOptions) => DataGridColumnHistogramResult
}

export type { DataGridExternalRowUpdate, DataGridExternalRowUpdateOptions } from "./server/dataSourceExternalUpdateRuntime.js"

const DEFAULT_ROW_CACHE_LIMIT = 4096
const DEFAULT_PREFETCH_MAX_BATCH_SIZE = 512
const DEFAULT_PREFETCH_TRIGGER_VIEWPORT_FACTOR = 1
const DEFAULT_PREFETCH_WINDOW_VIEWPORT_FACTOR = 3
const DEFAULT_RANGE_CACHE_CHUNK_SIZE = 256
const DATA_SOURCE_VELOCITY_OVERSCAN_EXPECTED_LOAD_MS = 180
const DATA_SOURCE_VELOCITY_OVERSCAN_MAX_ROWS = 512
const DATA_SOURCE_VELOCITY_OVERSCAN_MIN_SAMPLE_MS = 12
function normalizeTotal(total: number | null | undefined): number | null {
  if (!Number.isFinite(total)) {
    return null
  }
  return Math.max(0, Math.trunc(total as number))
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
  const optimisticMutationEngine = createDataSourceOptimisticMutationEngine<T>()
  let backpressurePaused = false
  let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, rowCount)
  let lastViewportDirection: -1 | 0 | 1 = 0
  let lastViewportOverscanSample: DataGridVelocityOverscanSample | null = null
  let viewportOverscanSampleTimestampMs = 0
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

  const cacheStoreRuntime = createDataSourceCacheStoreRuntime<T>({
    rowCacheLimit,
    rowCacheMaxBytes: options.rowCacheMaxBytes,
    rangeCacheChunkSize: DEFAULT_RANGE_CACHE_CHUNK_SIZE,
    maxStores: 8,
  })
  let activeCacheStore = cacheStoreRuntime.activeCacheStore
  let cacheManager = activeCacheStore.cacheManager
  let rowCache = cacheManager.rowCache
  let staleRetainedRowIndexes = cacheManager.staleRetainedRowIndexes
  let rangeCache = cacheManager.rangeCache
  let cacheStateKeyByIndex = activeCacheStore.cacheStateKeyByIndex
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
    placeholderExposureActiveRows: 0,
    placeholderExposureEvents: 0,
    placeholderExposureTotalMs: 0,
    placeholderExposureMaxMs: 0,
    placeholderExposureLastMs: 0,
    viewportDataAvailabilityEvents: 0,
    viewportDataAvailabilityTotalMs: 0,
    viewportDataAvailabilityMaxMs: 0,
    viewportDataAvailabilityLastMs: 0,
    viewportCacheHitRows: 0,
    viewportCacheMissRows: 0,
    viewportCacheHitRatio: 1,
    blankViewportActive: false,
    blankViewportEvents: 0,
    pullDurationEvents: 0,
    pullDurationTotalMs: 0,
    pullDurationMaxMs: 0,
    pullDurationLastMs: 0,
  }
  const telemetry = createDataSourceTelemetryRuntime(diagnostics)
  const scheduler = createDataSourcePullScheduler(diagnostics)
  const signals = createDataSourceRuntimeSignals()
  const transportCoordinatorLifecycle = createDataSourceRuntimeLifecycle({
    service: "transport-coordinator",
  })
  const invalidationEngineLifecycle = createDataSourceRuntimeLifecycle({
    service: "invalidation-engine",
  })
  const runtimeServices: DataSourceRuntimeLifecycle[] = [
    signals,
    scheduler,
    transportCoordinatorLifecycle,
    cacheManager,
    invalidationEngineLifecycle,
    telemetry,
    optimisticMutationEngine,
  ]
  for (const service of runtimeServices) {
    service.init()
    service.attach()
  }
  signals.subscribe("pullStarted", event => {
    if (event.priority !== "background") {
      markViewportDataAvailabilityRequested(event.range)
    }
  })
  signals.subscribe("cacheInvalidated", event => {
    if (event.preserveRange) {
      telemetry.finishPlaceholderExposuresOutsideRange(event.preserveRange)
      return
    }
    if (event.kind === "all") {
      telemetry.finishAllPlaceholderExposures()
    }
  })
  signals.subscribe("viewportCoverageChanged", event => {
    reconcilePlaceholderExposure(event.sourceViewport)
    finishViewportDataAvailability()
  })
  signals.subscribe("optimisticMutationStarted", () => {
    updateLoadingState()
  })
  signals.subscribe("optimisticMutationSettled", () => {
    updateLoadingState()
  })

  const unsubscribePush = typeof dataSource.subscribe === "function"
    ? dataSource.subscribe(event => {
        applyPushEvent(event)
      })
    : null

  function enforceGlobalCacheRowBudget(): void {
    cacheStoreRuntime.enforceGlobalCacheRowBudget()
  }

  function activateCacheStore(key: string): void {
    if (activeCacheStore.key === key) return
    activeCacheStore = cacheStoreRuntime.activateCacheStore(key)
    cacheManager = activeCacheStore.cacheManager
    rowCache = cacheManager.rowCache
    staleRetainedRowIndexes = cacheManager.staleRetainedRowIndexes
    rangeCache = cacheManager.rangeCache
    cacheStateKeyByIndex = activeCacheStore.cacheStateKeyByIndex
  }

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
    maybeAdd(readPendingPull("critical")?.range)
    maybeAdd(readPendingPull("background")?.range)
    return protectedRanges
  }

  function enforceRowCacheLimit() {
    cacheManager.enforceLimit({
      rowCacheLimit,
      protectedRanges: getProtectedSourceRanges(),
      onEvict: () => {
        diagnostics.rowCacheEvicted += 1
      },
    })
    diagnostics.rowCacheSize = rowCache.size
  }

  function bumpRevision() {
    revision += 1
  }

  function updateLoadingState() {
    const runtimeState = resolveDataSourceRuntimeState({
      cachedRows: rowCache.size,
      criticalInFlight: Boolean(criticalInFlight),
      criticalAffectsLoading: Boolean(criticalInFlight?.affectsLoading),
      backgroundInFlight: Boolean(backgroundInFlight),
      invalidating: criticalInFlight?.reason === "invalidation" || criticalInFlight?.reason === "push-invalidation",
      optimisticMutating: optimisticMutationEngine.getPendingCount() > 0,
      staleRetainedRows: staleRetainedRowIndexes.size,
      error,
      disposed,
    })
    initialLoading = runtimeState.initialLoading
    refreshing = runtimeState.refreshing
    loading = runtimeState.loading
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

  function writeRowCache(index: number, row: DataGridRowNode<T>, stateKey: string = buildRequestStateKey()) {
    if (rowCache.has(index)) {
      rowCache.delete(index)
    }
    telemetry.finishPlaceholderExposure(index)
    staleRetainedRowIndexes.delete(index)
    rowCache.set(index, row)
    cacheStateKeyByIndex.set(index, stateKey)
    rangeCache.setRow(index, row)
    enforceRowCacheLimit()
    diagnostics.rowCacheSize = rowCache.size
    updateLoadingState()
    finishViewportDataAvailability()
  }

  function writeRowCacheWithOptimisticOverlay(index: number, row: DataGridRowNode<T>, stateKey?: string) {
    const next = applyPendingOptimisticEditsToNode(row)
    writeRowCache(index, next, stateKey)
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

  function applyPendingOptimisticEditsToNode(
    node: DataGridRowNode<T>,
    excludeTransactionId?: number,
  ): DataGridRowNode<T> {
    return optimisticMutationEngine.applyPendingEditsToNode(node, applyRowDataPatch, excludeTransactionId)
  }

  function shouldRefreshAfterOptimisticCommit(transaction: OptimisticEditTransaction<T>): boolean {
    return resolveOptimisticProjectionRefresh(transaction, {
      sortModel,
      filterModel,
      groupBy,
      pivotModel,
      aggregationModel,
    })
  }

  function shouldRefreshAfterExternalUpdate(
    changedFields: ReadonlySet<string>,
    recompute: DataGridExternalRowUpdateOptions["recompute"],
  ): boolean {
    return resolveExternalProjectionRefresh(changedFields, recompute, {
      sortModel,
      filterModel,
      groupBy,
      pivotModel,
      aggregationModel,
    })
  }

  function rollbackOptimisticTransaction(
    transaction: OptimisticEditTransaction<T>,
    rowIds: readonly DataGridRowId[] = [...transaction.baselinesByRowId.keys()],
  ): boolean {
    let changed = false
    const affectedRows = new Set(rowIds)
    optimisticMutationEngine.remove(transaction.id)
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

  function pruneRowCacheByRowCount() {
    for (const index of rowCache.keys()) {
      if (index >= rowCount) {
        rowCache.delete(index)
        staleRetainedRowIndexes.delete(index)
        rangeCache.deleteRow(index)
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

  const rangeMappingRuntime = createDataSourceRangeMappingRuntime({
    getRowCount: () => rowCount,
    getPaginationInput: () => paginationInput,
    getLoadedIntervals: range => rangeCache.getLoadedIntervals(range),
  })
  const {
    getPaginationSnapshot,
    getVisibleRowCount,
    toSourceIndex,
    toSourceRange,
    toVisibleLoadedIntervals,
  } = rangeMappingRuntime

  function isRangeFullyCached(range: DataGridViewportRange, stateKey?: string): boolean {
    for (let index = range.start; index <= range.end; index += 1) {
      if (!isIndexCached(index, stateKey)) {
        return false
      }
    }
    return true
  }

  function isIndexCached(index: number, stateKey?: string): boolean {
    return rowCache.has(index)
      && (stateKey == null || cacheStateKeyByIndex.get(index) === stateKey)
      && !staleRetainedRowIndexes.has(index)
  }

  function reconcilePlaceholderExposure(sourceViewport: DataGridViewportRange = toSourceRange(viewportRange)): void {
    telemetry.reconcilePlaceholderExposure({
      sourceViewport,
      rowCount,
      hasCachedRow: index => isIndexCached(index),
    })
  }

  function finishViewportDataAvailability(): void {
    telemetry.finishViewportDataAvailability({
      visibleRowCount: getVisibleRowCount(),
      isViewportFullyCached: () => isRangeFullyCached(toSourceRange(viewportRange)),
    })
  }

  function markViewportDataAvailabilityRequested(range: DataGridViewportRange): void {
    telemetry.markViewportDataAvailabilityRequested({
      range,
      rowCount,
      sourceViewport: toSourceRange(viewportRange),
      rangesOverlap,
      isViewportFullyCached: () => isRangeFullyCached(toSourceRange(viewportRange)),
    })
  }

  function countCoveredRowsForward(startIndex: number, upperBound: number): number {
    return countCoveredRowsForwardPolicy(startIndex, upperBound, isIndexCached)
  }

  function countCoveredRowsBackward(startIndex: number, lowerBound: number): number {
    return countCoveredRowsBackwardPolicy(startIndex, lowerBound, isIndexCached)
  }

  function updateCachedCoverageDiagnostics(sourceViewport: DataGridViewportRange): void {
    if (rowCount <= 0) {
      diagnostics.cachedAheadRows = 0
      diagnostics.cachedBehindRows = 0
      diagnostics.viewportCacheHitRows = 0
      diagnostics.viewportCacheMissRows = 0
      diagnostics.viewportCacheHitRatio = 1
      diagnostics.blankViewportActive = false
      signals.emit("viewportCoverageChanged", {
        sourceViewport,
        visibleRowCount: 0,
        hitRows: 0,
        missRows: 0,
        hitRatio: 1,
        blankViewportActive: false,
      })
      return
    }
    const coverage = measureDataSourceViewportCoverage(sourceViewport, rowCount, isIndexCached)
    const { hitRows, missRows, blankViewportActive } = coverage
    if (blankViewportActive && !diagnostics.blankViewportActive) {
      diagnostics.blankViewportEvents += 1
    }
    diagnostics.viewportCacheHitRows = hitRows
    diagnostics.viewportCacheMissRows = missRows
    diagnostics.viewportCacheHitRatio = coverage.hitRatio
    diagnostics.blankViewportActive = blankViewportActive
    diagnostics.cachedAheadRows = countCoveredRowsForward(
      sourceViewport.end + 1,
      Math.max(0, rowCount - 1),
    )
    diagnostics.cachedBehindRows = countCoveredRowsBackward(
      sourceViewport.start - 1,
      0,
    )
    signals.emit("viewportCoverageChanged", {
      sourceViewport,
      visibleRowCount: getVisibleRowCount(),
      hitRows,
      missRows,
      hitRatio: diagnostics.viewportCacheHitRatio,
      blankViewportActive,
    })
  }

  function resolveVelocityAwareSourceRange(sourceViewport: DataGridViewportRange): DataGridViewportRange {
    viewportOverscanSampleTimestampMs += DATA_SOURCE_VELOCITY_OVERSCAN_MIN_SAMPLE_MS
    const sample = {
      range: sourceViewport,
      timestampMs: viewportOverscanSampleTimestampMs,
    }
    const result = resolveDataGridVelocityOverscanRange(sample, lastViewportOverscanSample, {
      expectedLoadMs: DATA_SOURCE_VELOCITY_OVERSCAN_EXPECTED_LOAD_MS,
      maxRows: DATA_SOURCE_VELOCITY_OVERSCAN_MAX_ROWS,
      minSampleMs: DATA_SOURCE_VELOCITY_OVERSCAN_MIN_SAMPLE_MS,
      totalRows: rowCount,
    })
    lastViewportOverscanSample = sample
    return result.range
  }

  function resolveViewportLoadingDiagnostics(): Pick<
    DataGridSparseRowModelDiagnostics,
    "viewportRowCount" | "viewportLoadedRowCount" | "viewportLoadingRowCount" | "viewportLoadingRowRatio"
  > {
    return measureDataSourceViewportLoading(
      viewportRange,
      getVisibleRowCount(),
      toSourceIndex,
      index => rowCache.has(index),
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

  function applyRows(rows: readonly DataGridDataSourceRowEntry<T>[], stateKey: string = buildRequestStateKey()): boolean {
    if (rows.length === 0) {
      return false
    }
    for (const entry of rows) {
      const normalized = normalizeDataSourceRowEntry(entry, resolveRowId)
      writeRowCacheWithOptimisticOverlay(normalized.index, normalized.node, stateKey)
    }
    updateTotalFromRows(rows)
    enforceGlobalCacheRowBudget()
    return true
  }

  function hasStaleRowsInRange(range: DataGridViewportRange): boolean {
    for (let index = range.start; index <= range.end; index += 1) {
      if (staleRetainedRowIndexes.has(index)) {
        return true
      }
    }
    return false
  }

  function replaceCacheWithRows(rows: readonly DataGridDataSourceRowEntry<T>[], stateKey: string = buildRequestStateKey()): boolean {
    const normalizedRows = rows.map(entry => normalizeDataSourceRowEntry(entry, resolveRowId))
    const freshIndexes = new Set(normalizedRows.map(entry => entry.index))
    const preserveRange = toSourceRange(viewportRange)
    const preservedRows: { index: number; node: DataGridRowNode<T> }[] = []

    for (const [index, node] of rowCache.entries()) {
      if (
        index < rowCount
        && index >= preserveRange.start
        && index <= preserveRange.end
        && !freshIndexes.has(index)
      ) {
        preservedRows.push({ index, node })
      }
    }

    const previousSize = rowCache.size
    rowCache.clear()
    cacheStateKeyByIndex.clear()
    staleRetainedRowIndexes.clear()
    rangeCache.reset()
    const removedRows = Math.max(0, previousSize - preservedRows.length)
    diagnostics.invalidatedRows += removedRows
    if (removedRows > 0) {
      signals.emit("cacheInvalidated", {
        kind: "replace",
        removedRows,
        preserveRange,
        reason: "replace-cache",
      })
    }

    for (const preserved of preservedRows) {
      writeRowCache(preserved.index, preserved.node)
      if (rowCache.has(preserved.index)) {
        staleRetainedRowIndexes.add(preserved.index)
      }
    }
    for (const normalized of normalizedRows) {
      writeRowCacheWithOptimisticOverlay(normalized.index, normalized.node, stateKey)
    }
    updateTotalFromRows(rows)
    diagnostics.rowCacheSize = rowCache.size
    updateLoadingState()
    enforceGlobalCacheRowBudget()
    return previousSize > 0 || normalizedRows.length > 0
  }

  const cacheInvalidationRuntime = createDataSourceCacheInvalidationRuntime({
    getRowCache: () => rowCache,
    getStaleRetainedRowIndexes: () => staleRetainedRowIndexes,
    getCacheStateKeyByIndex: () => cacheStateKeyByIndex,
    getRangeCache: () => rangeCache,
    diagnostics,
    getRowCount: () => rowCount,
    bumpRevision,
    emitCacheInvalidated: payload => signals.emit("cacheInvalidated", payload),
    updateLoadingState,
    updateViewportCoverage: () => updateCachedCoverageDiagnostics(toSourceRange(viewportRange)),
    resetViewportDataAvailability: () => telemetry.resetViewportDataAvailability(),
    onRowRemoved: index => {
      if (backgroundInFlight && index >= backgroundInFlight.range.start && index <= backgroundInFlight.range.end) {
        clearBackgroundPrefetchState("stale")
      }
      const pendingBackgroundPull = readPendingPull("background")
      if (pendingBackgroundPull && index >= pendingBackgroundPull.range.start && index <= pendingBackgroundPull.range.end) {
        diagnostics.prefetchDroppedStale += 1
        writePendingPull("background", null)
      }
    },
  })
  const clearRange = cacheInvalidationRuntime.clearRange
  const clearRowsById = (rowIds: readonly DataGridRowId[], preserveRange?: DataGridViewportRange | null) =>
    cacheInvalidationRuntime.clearRowsById(rowIds, {
      preserveRange,
      sourceViewport: toSourceRange(viewportRange),
    })

  function invalidateRows(rowIds: readonly DataGridRowId[]) {
    ensureActive()
    const sourceViewport = toSourceRange(viewportRange)
    const { changed, touchedViewport, touchedViewportIndexes } = clearRowsById(rowIds, sourceViewport)
    if (!changed && !touchedViewport) {
      return
    }
    if (touchedViewport) {
      void pullRange(
        rangeFromIndexes(touchedViewportIndexes) ?? sourceViewport,
        "invalidation",
        "normal",
        createProjectionRefreshTreePullContext(),
        { affectsLoading: false },
      )
      return
    }
    emit()
  }

  const clearAll = cacheInvalidationRuntime.clearAll

  const prefetchRuntime = createDataSourcePrefetchRuntime({
    policy: prefetchOptions,
    diagnostics,
    isDisposed: () => disposed,
    getVisibleRowCount,
    getRowCount: () => rowCount,
    getSourceViewport: () => toSourceRange(viewportRange),
    getLastViewportDirection: () => lastViewportDirection,
    updateCoverage: updateCachedCoverageDiagnostics,
    countCachedForward: countCoveredRowsForward,
    countCachedBackward: countCoveredRowsBackward,
    isRangeFullyCached,
    pullRange,
  })
  const scheduleViewportPrefetch = prefetchRuntime.schedule

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
    return scheduler.read(priority === "background" ? "background" : "critical")
  }

  function updatePendingPullDiagnostics(): void {
    diagnostics.hasPendingPull = scheduler.hasPending()
  }

  function writePendingPull(priority: DataGridDataSourcePullPriority, value: PendingPull | null): void {
    scheduler.write(priority === "background" ? "background" : "critical", value)
  }

  function suspendRuntimeServices(): boolean {
    let changed = false
    for (const service of runtimeServices) {
      changed = service.suspend() || changed
    }
    return changed
  }

  function resumeRuntimeServices(): boolean {
    let changed = false
    for (const service of runtimeServices) {
      changed = service.resume() || changed
    }
    return changed
  }

  function disposeRuntimeServices(): void {
    for (const service of runtimeServices) {
      service.dispose()
    }
  }

  function abortLaneInFlight(priority: DataGridDataSourcePullPriority, reason: "stale" | "preempted" = "preempted") {
    const active = readLaneInFlight(priority)
    if (!active) {
      return
    }
    rangeCache.cancelLoad(active.rangeCacheToken)
    if (!active.controller.signal.aborted) {
      active.controller.abort()
      signals.emit("pullSettled", {
        requestId: active.requestId,
        range: active.range,
        priority: active.priority,
        reason: active.reason,
        status: "aborted",
      })
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
    scheduler.clearBackground(reason)
  }

  function clearScheduledViewportPull(): void {
    scheduler.clearScheduledViewport()
  }

  function buildRequestStateKey(): string {
    return buildDataSourcePullStateKey({
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

  function buildCacheStoreKey(
    treePullContext: DataGridDataSourceTreePullContext | null,
  ): string {
    return buildDataSourceCacheStoreKey(activeCacheStore.key, groupBy, treePullContext)
  }

  function buildRequestKey(
    requestRange: DataGridViewportRange,
    reason: DataGridDataSourcePullReason,
    priority: DataGridDataSourcePullPriority,
    treePullContext: DataGridDataSourceTreePullContext | null,
    stateKey: string,
  ): string {
    return buildDataSourceRequestKey({
      range: requestRange,
      reason,
      priority,
      treePullContext,
      stateKey,
    })
  }

  const pendingPullRuntime = createDataSourcePendingPullRuntime({
    diagnostics,
    readLaneInFlight,
    readPendingPull,
    writePendingPull,
    buildRequestKey,
    emit,
  })

  const queuePendingPull = pendingPullRuntime.queue
  const pullSchedulingRuntime = createDataSourcePullSchedulingRuntime({
    scheduler,
    diagnostics,
    isDisposed: () => disposed,
    buildRequestKey,
    readLaneInFlight,
    readPendingPull,
    writePendingPull,
    pullRange,
    emit,
  })
  const scheduleViewportPull = pullSchedulingRuntime.scheduleViewportPull
  const drainCriticalBackpressureQueue = pullSchedulingRuntime.drainCriticalBackpressureQueue

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
    if (priority !== "background" && reason !== "viewport-change") {
      clearScheduledViewportPull()
    }
    const requestRange = normalizeRequestedRange(range)
    const treePullContext = normalizeTreePullContext(treeData)
    const requestStateKey = buildRequestStateKey()
    const cacheStoreKey = buildCacheStoreKey(treePullContext)
    activateCacheStore(cacheStoreKey)
    const requestKey = buildRequestKey(requestRange, reason, priority, treePullContext, requestStateKey)
    const laneInFlight = readLaneInFlight(priority)

    if (priority === "background" && isRangeFullyCached(requestRange, requestStateKey)) {
      diagnostics.prefetchSkippedCached += 1
      return
    }

    if (backpressurePaused) {
      return queuePendingPull(requestRange, reason, priority, requestKey, requestStateKey, treePullContext)
    }

    const pullRequestPolicy = resolveDataSourcePullRequestPolicy({
      range: requestRange,
      key: requestKey,
      stateKey: requestStateKey,
      reason,
      priority,
      laneInFlight,
      backgroundInFlight,
      criticalInFlight,
      pendingBackgroundPull: readPendingPull("background"),
    })
    if (pullRequestPolicy.kind === "coalesce") {
      diagnostics.pullCoalesced += 1
      if (pullRequestPolicy.countPrefetch) {
        diagnostics.prefetchCoalesced += 1
      }
      return pullRequestPolicy.promise
    }
    if (pullRequestPolicy.kind === "queue") {
      return queuePendingPull(requestRange, reason, pullRequestPolicy.priority, requestKey, requestStateKey, treePullContext)
    }
    if (pullRequestPolicy.abortBackground) {
      abortLaneInFlight("background", pullRequestPolicy.abortBackground)
    }
    if (pullRequestPolicy.dropPendingBackground) {
      diagnostics.prefetchDroppedStale += 1
      writePendingPull("background", null)
    }
    if (pullRequestPolicy.abortLane) {
      abortLaneInFlight(priority, "preempted")
    }

    const requestId = requestCounter + 1
    requestCounter = requestId
    const controller = new AbortController()
    const rangeCacheToken = rangeCache.beginLoad(requestRange)
    const requestPromise = (async () => {
      let settledStatus: "completed" | "failed" | "dropped" = "completed"
      let settledError: Error | undefined
      signals.emit("pullStarted", {
        requestId,
        range: requestRange,
        priority,
        reason,
      })
      diagnostics.paused = backpressurePaused
      diagnostics.pullRequested += 1
      if (priority === "background") {
        diagnostics.prefetchStarted += 1
      }
      error = priority === "background" ? error : null
      const pullStartedAtMs = telemetry.readNowMs()

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
        telemetry.recordPullDuration(pullStartedAtMs)

        const active = readLaneInFlight(priority)
        if (disposed || !active || active.requestId !== requestId || controller.signal.aborted) {
          settledStatus = "dropped"
          diagnostics.pullDropped += 1
          if (priority === "background") {
            diagnostics.prefetchDroppedStale += 1
          }
          return
        }

        let changed = false
        activateCacheStore(cacheStoreKey)
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
          changed = replaceCacheWithRows(result.rows, requestStateKey) || changed
          const currentViewport = toSourceRange(viewportRange)
          if (hasStaleRowsInRange(currentViewport)) {
            scheduleViewportPull(currentViewport, buildRequestStateKey())
          }
        } else {
          changed = applyRows(result.rows, requestStateKey) || changed
        }
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
        rangeCache.completeLoad(rangeCacheToken)
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
        telemetry.recordPullDuration(pullStartedAtMs)
        const active = readLaneInFlight(priority)
        if (disposed || !active || active.requestId !== requestId || controller.signal.aborted) {
          settledStatus = "dropped"
          diagnostics.pullDropped += 1
          if (priority === "background") {
            diagnostics.prefetchDroppedStale += 1
          }
          return
        }
        if (priority !== "background") {
          error = reasonError instanceof Error ? reasonError : new Error(String(reasonError))
          settledError = error
          rangeCache.failLoad(rangeCacheToken, error)
        } else {
          settledError = reasonError instanceof Error ? reasonError : new Error(String(reasonError))
          rangeCache.cancelLoad(rangeCacheToken)
        }
        settledStatus = "failed"
      } finally {
        const active = readLaneInFlight(priority)
        if (active && active.requestId === requestId) {
          signals.emit("pullSettled", {
            requestId,
            range: requestRange,
            priority,
            reason,
            status: settledStatus,
            ...(settledError ? { error: settledError } : {}),
          })
          writeLaneInFlight(priority, null)
          updateLoadingState()
          if (!disposed && !backpressurePaused) {
            const pendingCriticalPull = readPendingPull("critical")
            const pendingBackgroundPull = readPendingPull("background")
            if (!criticalInFlight && pendingCriticalPull) {
              const next = pendingCriticalPull
              writePendingPull("critical", null)
              void pullRange(next.range, next.reason, next.priority, next.treeData)
            } else if (!backgroundInFlight && !criticalInFlight && pendingBackgroundPull) {
              const next = pendingBackgroundPull
              writePendingPull("background", null)
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
      rangeCacheToken,
    })

    return requestPromise
  }

  const pushInvalidationRuntime = createDataSourcePushInvalidationRuntime({
    invalidateDataSource: invalidation => {
      if (typeof dataSource.invalidate === "function") {
        void Promise.resolve(dataSource.invalidate(invalidation))
      }
    },
    getSourceViewport: () => toSourceRange(viewportRange),
    clearAll,
    clearRange,
    invalidateRows,
    resolveVisibleRange: (range, viewport) => resolveVisibleRangeInvalidation(normalizeRequestedRange(range), viewport),
    isBackgroundRangeOverlapping: range => Boolean(backgroundInFlight && rangesOverlap(backgroundInFlight.range, normalizeRequestedRange(range))),
    clearBackgroundPrefetch: () => clearBackgroundPrefetchState("stale"),
    pullRange: (range, projectionRefresh) => {
      if (projectionRefresh) {
        void pullRange(range, "push-invalidation", "normal", createProjectionRefreshTreePullContext(), { affectsLoading: false })
      } else {
        void pullRange(range, "push-invalidation", "normal")
      }
    },
    emit,
  })
  const applyPushInvalidation = pushInvalidationRuntime.apply

  const pushEventRuntime = createDataSourcePushEventRuntime<T>({
    isDisposed: () => disposed,
    recordPushApplied: () => { diagnostics.pushApplied += 1 },
    updateDatasetVersion: version => {
      if (typeof version === "undefined" || version === datasetVersion) return false
      datasetVersion = version ?? null
      return true
    },
    applyRows,
    setCursor: cursor => {
      if (typeof cursor === "undefined") return
      const normalizedCursor = cursor == null ? null : String(cursor)
      if (normalizedCursor !== paginationCursor) paginationCursor = normalizedCursor
    },
    applyTotal: total => {
      const previousRowCount = rowCount
      const nextTotal = normalizeTotal(total)
      if (nextTotal == null) return false
      rowCount = nextTotal
      resolvedEmptyTotal = nextTotal === 0
      pruneRowCacheByRowCount()
      viewportRange = normalizeViewportRange(viewportRange, getVisibleRowCount())
      return rowCount !== previousRowCount
    },
    applyPivotColumns: columns => {
      if (pivotModel) {
        const normalizedPivotColumns = normalizePivotColumnsFromUnknown(columns)
        if (normalizedPivotColumns && !isSamePivotColumnsSnapshot(pivotColumns, normalizedPivotColumns)) {
          pivotColumns = normalizedPivotColumns
          return true
        }
      } else if (pivotColumns.length > 0) {
        pivotColumns = []
        return true
      }
      return false
    },
    removeIndexes: indexes => {
      let changed = false
      for (const rawIndex of indexes) {
        const index = Number.isFinite(rawIndex) ? Math.max(0, Math.trunc(rawIndex)) : -1
        if (index >= 0) {
          const deleted = rowCache.delete(index)
          if (deleted) staleRetainedRowIndexes.delete(index)
          changed = deleted || changed
          rangeCache.deleteRow(index)
        }
      }
      diagnostics.rowCacheSize = rowCache.size
      return changed
    },
    bumpRevision,
    updateCoverage: () => updateCachedCoverageDiagnostics(toSourceRange(viewportRange)),
    emit,
    applyInvalidation: applyPushInvalidation,
  })
  const applyPushEvent = pushEventRuntime.apply

  function updateDatasetVersionFromMutation(version: string | number | null | undefined): boolean {
    if (typeof version === "undefined" || version === datasetVersion) {
      return false
    }
    if (typeof version === "number" && typeof datasetVersion === "number" && version < datasetVersion) {
      return false
    }
    datasetVersion = version ?? null
    return true
  }

  function readMutationRows(result: {
    rows?: readonly DataGridDataSourceRowEntry<T>[]
    updatedRows?: readonly DataGridDataSourceRowEntry<T>[]
  }): readonly DataGridDataSourceRowEntry<T>[] {
    return Array.isArray(result.rows) && result.rows.length > 0
      ? result.rows
      : (Array.isArray(result.updatedRows) ? result.updatedRows : [])
  }

  function applyMutationResult(result: {
    rows?: readonly DataGridDataSourceRowEntry<T>[]
    updatedRows?: readonly DataGridDataSourceRowEntry<T>[]
    invalidation?: DataGridDataSourceInvalidation | null
    datasetVersion?: string | number | null
  }): boolean {
    let changed = updateDatasetVersionFromMutation(result.datasetVersion)
    const rows = readMutationRows(result)
    if (rows.length > 0) {
      changed = applyRows(rows) || changed
      return changed
    }
    if (result.invalidation) {
      applyPushInvalidation(result.invalidation)
      return true
    }
    return changed
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

  function createProjectionRefreshTreePullContext(): DataGridDataSourceTreePullContext | null {
    if (!getExpansionSpec()) {
      return null
    }
    return createTreePullContext("set-group-expansion", Array.from(toggledGroupKeys), "all")
  }

  function getPivotPullContext(): DataGridDataSourcePivotPullContext {
    return {
      pivotModel: clonePivotSpec(pivotModel),
      aggregationModel: clonePullAggregationModel(aggregationModel),
    }
  }

  const getDataSourceColumnHistogram = dataSource.getColumnHistogram
  const getDataSourceCommitEdits = dataSource.commitEdits
  const processOptimisticCommit = createDataSourceOptimisticCommitRuntime<T>({
    commitEdits: request => getDataSourceCommitEdits!(request),
    getDatasetVersion: () => datasetVersion,
    isDisposed: () => disposed,
    removeTransaction: transactionId => optimisticMutationEngine.remove(transactionId),
    rollbackTransaction: rollbackOptimisticTransaction,
    settleMutation: (transaction, status, error) => signals.emit("optimisticMutationSettled", {
      transactionId: transaction.id,
      rowIds: Array.from(transaction.updatesByRowId.keys()),
      status,
      ...(error ? { error } : {}),
    }),
    setError: nextError => { error = nextError },
    applyMutationResult,
    shouldRefreshAfterCommit: shouldRefreshAfterOptimisticCommit,
    refreshVisibleRows: () => pullRange(toSourceRange(viewportRange), "refresh", "critical"),
    updateCachedCoverage: () => updateCachedCoverageDiagnostics(toSourceRange(viewportRange)),
    bumpRevision,
    emit,
  })
  const histogramMethods: Pick<DataSourceBackedRowModel<T>, "getColumnHistogram"> =
    typeof getDataSourceColumnHistogram === "function"
      ? {
          getColumnHistogram(columnId: string, histogramOptions?: DataGridColumnHistogramOptions) {
            ensureActive()
            const normalizedColumnId = String(columnId ?? "").trim()
            if (normalizedColumnId.length === 0) {
              return []
            }
            const options = normalizeColumnHistogramOptions(histogramOptions)
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
      ? createDataSourceOptimisticPatchRuntime({
          ensureActive,
          mutationEngine: optimisticMutationEngine,
          findCachedRowById,
          writeRowCache,
          onMutationStarted(transaction) {
            signals.emit("optimisticMutationStarted", {
              transactionId: transaction.id,
              rowIds: Array.from(transaction.updatesByRowId.keys()),
            })
          },
          bumpRevision,
          emit,
          processCommit: processOptimisticCommit,
        })
      : {}
  const externalUpdateMethods: Pick<DataSourceBackedRowModel<T>, "applyExternalUpdates"> = createDataSourceExternalUpdateRuntime({
    ensureActive,
    findCachedRowById,
    applyRows,
    writeRowCache,
    bumpRevision,
    shouldRefresh: shouldRefreshAfterExternalUpdate,
    refreshVisibleRows: () => pullRange(toSourceRange(viewportRange), "refresh", "normal", null, { affectsLoading: false }),
    updateCachedCoverage: () => updateCachedCoverageDiagnostics(toSourceRange(viewportRange)),
    emit,
  })

  return {
    kind: "server",
    dataSource,
    ...histogramMethods,
    ...patchMethods,
    ...externalUpdateMethods,
    getSparseRowModelDiagnostics() {
      updateCachedCoverageDiagnostics(toSourceRange(viewportRange))
      reconcilePlaceholderExposure()
      finishViewportDataAvailability()
      return {
        kind: "data-source",
        rowCount: getVisibleRowCount(),
        viewportRange: { ...viewportRange },
        cachedRowCount: rowCache.size,
        cacheLimit: rowCacheLimit,
        ...resolveViewportLoadingDiagnostics(),
        placeholderExposureActiveRows: diagnostics.placeholderExposureActiveRows,
        placeholderExposureEvents: diagnostics.placeholderExposureEvents,
        placeholderExposureTotalMs: diagnostics.placeholderExposureTotalMs,
        placeholderExposureMaxMs: diagnostics.placeholderExposureMaxMs,
        placeholderExposureLastMs: diagnostics.placeholderExposureLastMs,
        viewportDataAvailabilityEvents: diagnostics.viewportDataAvailabilityEvents,
        viewportDataAvailabilityTotalMs: diagnostics.viewportDataAvailabilityTotalMs,
        viewportDataAvailabilityMaxMs: diagnostics.viewportDataAvailabilityMaxMs,
        viewportDataAvailabilityLastMs: diagnostics.viewportDataAvailabilityLastMs,
        viewportCacheHitRows: diagnostics.viewportCacheHitRows,
        viewportCacheMissRows: diagnostics.viewportCacheMissRows,
        viewportCacheHitRatio: diagnostics.viewportCacheHitRatio,
        blankViewportActive: diagnostics.blankViewportActive,
        blankViewportEvents: diagnostics.blankViewportEvents,
        pullDurationEvents: diagnostics.pullDurationEvents,
        pullDurationTotalMs: diagnostics.pullDurationTotalMs,
        pullDurationMaxMs: diagnostics.pullDurationMaxMs,
        pullDurationLastMs: diagnostics.pullDurationLastMs,
      }
    },
    getLoadedRowIntervals(range) {
      const visibleCount = getVisibleRowCount()
      if (visibleCount <= 0) {
        return []
      }
      const visibleRange = normalizeViewportRange(range, visibleCount)
      return toVisibleLoadedIntervals(visibleRange, toSourceRange(visibleRange))
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
      const rows: DataGridRowNode<T>[] = []
      for (let index = normalized.start; index <= normalized.end; index += 1) {
        const sourceIndex = toSourceIndex(index)
        const row = readRowCache(sourceIndex)
        if (row) {
          rows.push(row)
        } else {
          rows.push(createDataSourcePlaceholderRow<T>(index, sourceIndex, rangeCache.readIndex(sourceIndex).state))
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
      updateCachedCoverageDiagnostics(sourceViewport)

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

      let sourceLoadRange = prefetchOptions.enabled
        ? resolveVelocityAwareSourceRange(sourceViewport)
        : sourceViewport
      if (
        backgroundInFlight &&
        !backgroundInFlight.controller.signal.aborted &&
        rangesOverlap(backgroundInFlight.range, sourceLoadRange) &&
        !rangesOverlap(backgroundInFlight.range, sourceViewport)
      ) {
        sourceLoadRange = sourceViewport
      }

      if (criticalInFlight && !criticalInFlight.controller.signal.aborted) {
        const requestStateKey = buildRequestStateKey()
        if (
          criticalInFlight.stateKey === requestStateKey &&
          rangeContains(criticalInFlight.range, sourceLoadRange)
        ) {
          diagnostics.pullCoalesced += 1
          emit()
          return
        }
        scheduleViewportPull(sourceLoadRange, requestStateKey)
        return
      }

      void pullRange(sourceLoadRange, "viewport-change", "critical")
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
      clearScheduledViewportPull()
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
      clearScheduledViewportPull()
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
      clearScheduledViewportPull()
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
        {
          replaceCacheOnSuccess: true,
        },
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
        {
          replaceCacheOnSuccess: true,
        },
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
        {
          replaceCacheOnSuccess: true,
        },
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
        {
          replaceCacheOnSuccess: true,
        },
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
      if (reason === "viewport-change") {
        await Promise.resolve()
        await drainCriticalBackpressureQueue()
        const sourceViewport = toSourceRange(viewportRange)
        if (!isRangeFullyCached(sourceViewport)) {
          await pullRange(sourceViewport, "viewport-change", "critical")
        }
        return
      }
      await pullRange(toSourceRange(viewportRange), "refresh", "critical")
    },
    invalidateRange(range) {
      ensureActive()
      const sourceRange = toSourceRange(range)
      const invalidation: DataGridDataSourceInvalidation = { kind: "range", range: sourceRange, reason: "model-range" }
      const normalizedSourceRange = normalizeRequestedRange(sourceRange)
      const sourceViewport = toSourceRange(viewportRange)
      const visibleRefreshRange = resolveVisibleRangeInvalidation(normalizedSourceRange, sourceViewport)
      const touchesViewport = visibleRefreshRange !== null
      clearRange(sourceRange, touchesViewport ? { preserveRange: sourceViewport } : {})
      if (backgroundInFlight && rangesOverlap(backgroundInFlight.range, sourceRange)) {
        clearBackgroundPrefetchState("stale")
      }
      const pendingBackgroundPull = readPendingPull("background")
      if (pendingBackgroundPull && rangesOverlap(pendingBackgroundPull.range, sourceRange)) {
        diagnostics.prefetchDroppedStale += 1
        writePendingPull("background", null)
      }
      if (typeof dataSource.invalidate === "function") {
        void Promise.resolve(dataSource.invalidate(invalidation))
      }
      if (visibleRefreshRange) {
        void pullRange(visibleRefreshRange, "invalidation", "normal", createProjectionRefreshTreePullContext(), { affectsLoading: false })
      } else {
        emit()
      }
    },
    invalidateRows(rowIds) {
      ensureActive()
      const sourceViewport = toSourceRange(viewportRange)
      const { changed, touchedViewport, touchedViewportIndexes } = clearRowsById(rowIds, sourceViewport)
      if (!changed && !touchedViewport) {
        return
      }
      if (touchedViewport) {
        void pullRange(
          rangeFromIndexes(touchedViewportIndexes) ?? sourceViewport,
          "invalidation",
          "normal",
          createProjectionRefreshTreePullContext(),
          { affectsLoading: false },
        )
      } else {
        emit()
      }
    },
    invalidateAll() {
      ensureActive()
      clearAll({ preserveRange: toSourceRange(viewportRange) })
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
      suspendRuntimeServices()
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
      resumeRuntimeServices()
      backpressurePaused = false
      diagnostics.paused = false
      const pendingCriticalPull = readPendingPull("critical")
      const pendingBackgroundPull = readPendingPull("background")
      if (pendingCriticalPull && !criticalInFlight) {
        const next = pendingCriticalPull
        writePendingPull("critical", null)
        void pullRange(next.range, next.reason, next.priority, next.treeData)
      } else if (pendingBackgroundPull && !criticalInFlight && !backgroundInFlight) {
        const next = pendingBackgroundPull
        writePendingPull("background", null)
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
        resumeRuntimeServices()
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
          suspendRuntimeServices()
          backpressurePaused = true
          diagnostics.paused = true
        }
        emit()
      }
    },
    getBackpressureDiagnostics() {
      reconcilePlaceholderExposure()
      finishViewportDataAvailability()
      diagnostics.criticalInFlight = Boolean(criticalInFlight)
      diagnostics.backgroundInFlight = Boolean(backgroundInFlight)
      diagnostics.inFlight = diagnostics.criticalInFlight || diagnostics.backgroundInFlight
      updatePendingPullDiagnostics()
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
      telemetry.finishAllPlaceholderExposures()
      rowCache.clear()
      cacheStateKeyByIndex.clear()
      staleRetainedRowIndexes.clear()
      rangeCache.clear()
      telemetry.resetViewportDataAvailability()
      writePendingPull("critical", null)
      writePendingPull("background", null)
      scheduler.setScheduledViewport(null)
      pullSchedulingRuntime.reset()
      diagnostics.inFlight = false
      diagnostics.criticalInFlight = false
      diagnostics.backgroundInFlight = false
      diagnostics.paused = false
      diagnostics.hasPendingPull = false
      diagnostics.rowCacheSize = 0
      cacheStoreRuntime.disposeRetainedStores()
      disposeRuntimeServices()
      unsubscribePush?.()
    },
  }
}
