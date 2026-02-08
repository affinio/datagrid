import type {
  DataGridFilterSnapshot,
  DataGridGroupExpansionSnapshot,
  DataGridGroupBySpec,
  DataGridRowId,
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

export interface DataGridDataSourcePullRequest {
  range: DataGridViewportRange
  priority: DataGridDataSourcePullPriority
  reason: DataGridDataSourcePullReason
  signal: AbortSignal
  sortModel: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
  groupBy: DataGridGroupBySpec | null
  groupExpansion: DataGridGroupExpansionSnapshot
}

export interface DataGridDataSourceRowEntry<T = unknown> {
  index: number
  row: T
  rowId?: DataGridRowId
  state?: Partial<DataGridRowNodeState>
}

export interface DataGridDataSourcePullResult<T = unknown> {
  rows: readonly DataGridDataSourceRowEntry<T>[]
  total?: number | null
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
  pushApplied: number
  invalidatedRows: number
  inFlight: boolean
}
