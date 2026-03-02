import type {
  DataGridAggregationModel,
  DataGridFilterSnapshot,
  DataGridGroupExpansionSnapshot,
  DataGridGroupBySpec,
  DataGridPaginationSnapshot,
  DataGridPivotColumn,
  DataGridPivotColumnPathSegment,
  DataGridPivotSpec,
  DataGridRowId,
  DataGridRowGroupMeta,
  DataGridRowKind,
  DataGridRowNodeState,
  DataGridSortState,
  DataGridViewportRange,
} from "./rowModel.js"

export type DataGridDataSourcePullPriority = "critical" | "normal" | "background"

export type DataGridDataSourcePullReason =
  | "mount"
  | "viewport-change"
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
  pivotColumns?: readonly DataGridPivotColumn[]
  cursor?: string | null
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

export type DataGridDataSourceInvalidation =
  | DataGridDataSourceInvalidationAll
  | DataGridDataSourceInvalidationRange

export interface DataGridDataSourcePushUpsertEvent<T = unknown> {
  type: "upsert"
  rows: readonly DataGridDataSourceRowEntry<T>[]
  total?: number | null
  pivotColumns?: readonly DataGridPivotColumn[]
  cursor?: string | null
}

export interface DataGridDataSourcePushRemoveEvent {
  type: "remove"
  indexes: readonly number[]
  total?: number | null
}

export interface DataGridDataSourcePushInvalidateEvent {
  type: "invalidate"
  invalidation: DataGridDataSourceInvalidation
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
  hasPendingPull: boolean
  rowCacheSize: number
  rowCacheLimit: number
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
