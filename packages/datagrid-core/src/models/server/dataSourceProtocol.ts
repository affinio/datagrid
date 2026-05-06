import type {
  DataGridAggregationModel,
  DataGridColumnHistogram,
  DataGridColumnHistogramOptions,
  DataGridFilterSnapshot,
  DataGridGroupExpansionSnapshot,
  DataGridGroupBySpec,
  DataGridPaginationSnapshot,
  DataGridRowId,
  DataGridRowGroupMeta,
  DataGridRowKind,
  DataGridRowNodeState,
  DataGridSortState,
  DataGridViewportRange,
} from "../rowModel.js"
import type { DataGridClientRowPatch } from "../clientRowModel.js"
import type {
  DataGridPivotColumn,
  DataGridPivotColumnPathSegment,
  DataGridPivotSpec,
} from "@affino/datagrid-pivot"

export type DataGridDataSourcePullPriority = "critical" | "normal" | "background"

export type DataGridDataSourcePullReason =
  | "mount"
  | "viewport-change"
  | "prefetch"
  | "refresh"
  | "sort-change"
  | "filter-change"
  | "group-change"
  | "invalidation"
  | "push-invalidation"

export type DataGridDataSourceTreePullOperation =
  | "set-group-by"
  | "set-group-expansion"
  | "toggle-group"
  | "expand-group"
  | "collapse-group"
  | "expand-all-groups"
  | "collapse-all-groups"

export type DataGridDataSourceTreePullScope = "all" | "branch"

export interface DataGridDataSourceTreePullContext {
  operation: DataGridDataSourceTreePullOperation
  scope: DataGridDataSourceTreePullScope
  groupKeys: readonly string[]
}

export interface DataGridDataSourcePivotPullContext {
  pivotModel: DataGridPivotSpec | null
  aggregationModel: DataGridAggregationModel<any> | null
}

export interface DataGridDataSourcePaginationPullContext {
  snapshot: DataGridPaginationSnapshot
  cursor: string | null
}

export interface DataGridDataSourceFillProjectionContext {
  sortModel: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
  groupBy: DataGridGroupBySpec | null
  groupExpansion: DataGridGroupExpansionSnapshot
  treeData: DataGridDataSourceTreePullContext | null
  pivot: DataGridDataSourcePivotPullContext | null
  pagination: DataGridDataSourcePaginationPullContext
}

export interface DataGridDataSourceResolveFillBoundaryRequest {
  direction: "up" | "down" | "left" | "right"
  baseRange: DataGridViewportRange
  fillColumns: readonly string[]
  referenceColumns: readonly string[]
  projection: DataGridDataSourceFillProjectionContext
  startRowIndex: number
  startColumnIndex: number
  limit?: number | null
}

export interface DataGridDataSourceResolveFillBoundaryResult {
  endRowIndex: number | null
  endRowId?: DataGridRowId | null
  boundaryKind: "data-end" | "gap" | "cache-boundary" | "projection-end" | "unresolved"
  scannedRowCount?: number
  truncated?: boolean
  revision?: string | null
  projectionHash?: string | null
  boundaryToken?: string | null
}

export interface DataGridDataSourcePullRequest {
  range: DataGridViewportRange
  priority: DataGridDataSourcePullPriority
  reason: DataGridDataSourcePullReason
  signal: AbortSignal
  sortModel: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
  groupBy: DataGridGroupBySpec | null
  groupExpansion: DataGridGroupExpansionSnapshot
  treeData: DataGridDataSourceTreePullContext | null
  pivot: DataGridDataSourcePivotPullContext | null
  pagination: DataGridDataSourcePaginationPullContext
}

export interface DataGridDataSourceColumnHistogramRequest {
  columnId: string
  options: DataGridColumnHistogramOptions
  signal: AbortSignal
  sortModel: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
  groupBy: DataGridGroupBySpec | null
  groupExpansion: DataGridGroupExpansionSnapshot
  treeData: DataGridDataSourceTreePullContext | null
  pivot: DataGridDataSourcePivotPullContext | null
  pagination: DataGridDataSourcePaginationPullContext
}

export interface DataGridDataSourceRowEntry<T = unknown> {
  index: number
  row: T
  rowId?: DataGridRowId
  kind?: DataGridRowKind
  groupMeta?: Partial<DataGridRowGroupMeta>
  state?: Partial<DataGridRowNodeState>
}

export interface DataGridDataSourcePullResult<T = unknown> {
  rows: readonly DataGridDataSourceRowEntry<T>[]
  total?: number | null
  datasetVersion?: string | number | null
  pivotColumns?: readonly DataGridPivotColumn[]
  cursor?: string | null
}

export interface DataGridDataSourceCommitEditsRequest<T = unknown> {
  edits: readonly DataGridClientRowPatch<T>[]
  signal?: AbortSignal
  revision?: string | number | null
}

export interface DataGridDataSourceCommitEditsResult {
  committed?: readonly {
    rowId: DataGridRowId
    revision?: string | number | null
  }[]
  rejected?: readonly {
    rowId: DataGridRowId
    reason?: string
  }[]
  invalidation?: DataGridDataSourceInvalidation | null
}

export type DataGridFillMode = "copy" | "series"

export interface DataGridDataSourceFillProjectionContext {
  sortModel: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
  groupBy: DataGridGroupBySpec | null
  groupExpansion: DataGridGroupExpansionSnapshot
  treeData: DataGridDataSourceTreePullContext | null
  pivot: DataGridDataSourcePivotPullContext | null
  pagination: DataGridDataSourcePaginationPullContext
}

export interface DataGridDataSourceFillOperationRequest {
  operationId?: string | null
  revision?: string | number | null
  baseRevision?: string | null
  projectionHash?: string | null
  boundaryToken?: string | null
  projection: DataGridDataSourceFillProjectionContext
  sourceRange: DataGridViewportRange
  targetRange: DataGridViewportRange
  fillColumns: readonly string[]
  referenceColumns: readonly string[]
  mode: DataGridFillMode
  sourceRowIds?: readonly DataGridRowId[]
  targetRowIds?: readonly DataGridRowId[]
  metadata?: {
    origin?: "drag-fill" | "double-click-fill" | "menu-reapply"
    behaviorSource?: "default" | "explicit"
  } | null
}

export interface DataGridDataSourceFillOperationResult {
  operationId: string
  revision?: string | number | null
  affectedRowCount: number
  affectedCellCount?: number
  invalidation?: DataGridDataSourceInvalidation | null
  undoToken?: string | null
  redoToken?: string | null
  warnings?: readonly string[]
}

export interface DataGridDataSourceFillUndoRequest {
  operationId: string
  revision?: string | number | null
  projection: DataGridDataSourceFillProjectionContext
}

export interface DataGridDataSourceFillUndoResult {
  operationId: string
  revision?: string | number | null
  invalidation?: DataGridDataSourceInvalidation | null
  warnings?: readonly string[]
}

export interface DataGridDataSourceFillRedoResult {
  operationId: string
  revision?: string | number | null
  invalidation?: DataGridDataSourceInvalidation | null
  warnings?: readonly string[]
}

export interface DataGridDataSourceInvalidationAll {
  kind: "all"
  reason?: string
}

export interface DataGridDataSourceInvalidationRange {
  kind: "range"
  range: DataGridViewportRange
  reason?: string
}

export interface DataGridDataSourceInvalidationRows {
  kind: "rows"
  rowIds: readonly DataGridRowId[]
  reason?: string
}

export type DataGridDataSourceInvalidation =
  | DataGridDataSourceInvalidationAll
  | DataGridDataSourceInvalidationRange
  | DataGridDataSourceInvalidationRows

export interface DataGridDataSourcePushUpsertEvent<T = unknown> {
  type: "upsert"
  rows: readonly DataGridDataSourceRowEntry<T>[]
  total?: number | null
  datasetVersion?: string | number | null
  pivotColumns?: readonly DataGridPivotColumn[]
  cursor?: string | null
}

export interface DataGridDataSourcePushRemoveEvent {
  type: "remove"
  indexes: readonly number[]
  total?: number | null
  datasetVersion?: string | number | null
}

export interface DataGridDataSourcePushInvalidateEvent {
  type: "invalidate"
  invalidation: DataGridDataSourceInvalidation
  datasetVersion?: string | number | null
}

export type DataGridDataSourcePushEvent<T = unknown> =
  | DataGridDataSourcePushUpsertEvent<T>
  | DataGridDataSourcePushRemoveEvent
  | DataGridDataSourcePushInvalidateEvent

export type DataGridDataSourcePushListener<T = unknown> = (
  event: DataGridDataSourcePushEvent<T>,
) => void

export interface DataGridDataSource<T = unknown> {
  pull(request: DataGridDataSourcePullRequest): Promise<DataGridDataSourcePullResult<T>>
  getColumnHistogram?(request: DataGridDataSourceColumnHistogramRequest): Promise<DataGridColumnHistogram>
  commitEdits?(request: DataGridDataSourceCommitEditsRequest<T>): Promise<DataGridDataSourceCommitEditsResult>
  commitFillOperation?(request: DataGridDataSourceFillOperationRequest): Promise<DataGridDataSourceFillOperationResult>
  undoFillOperation?(request: DataGridDataSourceFillUndoRequest): Promise<DataGridDataSourceFillUndoResult>
  redoFillOperation?(request: DataGridDataSourceFillUndoRequest): Promise<DataGridDataSourceFillRedoResult>
  resolveFillBoundary?(
    request: DataGridDataSourceResolveFillBoundaryRequest,
  ): Promise<DataGridDataSourceResolveFillBoundaryResult> | DataGridDataSourceResolveFillBoundaryResult
  subscribe?(listener: DataGridDataSourcePushListener<T>): () => void
  invalidate?(invalidation: DataGridDataSourceInvalidation): Promise<void> | void
}

export interface DataGridDataSourceBackpressureDiagnostics {
  pullRequested: number
  pullCompleted: number
  pullAborted: number
  pullDropped: number
  pullCoalesced: number
  pullDeferred: number
  rowCacheEvicted: number
  pushApplied: number
  invalidatedRows: number
  inFlight: boolean
  paused: boolean
  hasPendingPull: boolean
  rowCacheSize: number
  rowCacheLimit: number
  prefetchScheduled: number
  prefetchStarted: number
  prefetchCompleted: number
  prefetchSkippedCached: number
  prefetchCoalesced: number
  prefetchDroppedStale: number
  prefetchAborted: number
  cachedAheadRows: number
  cachedBehindRows: number
  criticalInFlight: boolean
  backgroundInFlight: boolean
}

export type DataGridServerPivotRowRole = "group" | "detail" | "subtotal" | "grand-total"

export interface DataGridServerPivotRowIdInput {
  role: DataGridServerPivotRowRole
  rowPath?: readonly DataGridPivotColumnPathSegment[]
  rowDepth?: number
  marker?: string | number | null
}

/**
 * Stable row identity contract for server-side pivot rows.
 * The same semantic row (role + path + depth + marker) must always produce the same id.
 */
export function createDataGridServerPivotRowId(input: DataGridServerPivotRowIdInput): string {
  const role = input.role
  const depth = Number.isFinite(input.rowDepth) ? Math.max(0, Math.trunc(input.rowDepth as number)) : 0
  const marker = input.marker == null ? "" : String(input.marker)
  const rowPath = Array.isArray(input.rowPath) ? input.rowPath : []
  let encodedPath = ""
  for (const segment of rowPath) {
    const field = typeof segment.field === "string" ? segment.field : ""
    const value = typeof segment.value === "string" ? segment.value : ""
    encodedPath += `${field.length}:${field}${value.length}:${value}`
  }
  return `pivot:server:${role}:d${depth}:p${encodedPath}:m${marker.length}:${marker}`
}
