import type {
  DataGridColumnHistogram,
  DataGridDataSource,
  DataGridDataSourceInvalidation,
  DataGridDataSourcePushListener,
  DataGridDataSourceRowEntry,
  DataGridFilterSnapshot,
  DataGridGroupExpansionSnapshot,
  DataGridGroupBySpec,
  DataGridPaginationSnapshot,
  DataGridSortState,
  DataGridViewportRange,
} from "@affino/datagrid-vue"
import type { DataGridAggregationModel } from "@affino/datagrid-core"
import type { DataGridPivotSpec } from "@affino/datagrid-pivot"

export const SERVER_DEMO_ROW_COUNT = 100_000
export const SERVER_DEMO_PAGE_SIZE = 300
export const SERVER_DEMO_LATENCY_MS = 140

export const SERVER_DEMO_SEGMENTS = ["Core", "Growth", "Enterprise", "SMB"] as const
export const SERVER_DEMO_STATUSES = ["Active", "Paused", "Closed"] as const
export const SERVER_DEMO_REGIONS = ["AMER", "EMEA", "APAC", "LATAM"] as const

const SERVER_DEMO_INTEGER_PATTERN = /^[+-]?\d+$/

export function normalizeServerDemoValueCellInput(value: unknown): number | null {
  if (value === null || typeof value === "undefined" || value === "") {
    return null
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  if (typeof value === "string") {
    const normalized = value.trim()
    if (normalized.length === 0) {
      return null
    }
    if (SERVER_DEMO_INTEGER_PATTERN.test(normalized)) {
      return Number(normalized)
    }
  }
  throw new Error("value edits must contain an integer or clear")
}

export interface ServerDemoRow {
  id: string
  index: number
  name: string
  segment: string
  status: string
  region: string
  value: number | null
  updatedAt: string
}

export interface ServerDemoMutationCellInvalidation {
  rowId: string
  columnId: string
}

export interface ServerDemoMutationRangeInvalidation {
  startRow: number
  endRow: number
  startColumn?: string | null
  endColumn?: string | null
}

export interface ServerDemoMutationInvalidation {
  type: "cell" | "range" | "row" | "dataset"
  cells?: readonly ServerDemoMutationCellInvalidation[]
  rows?: readonly string[]
  range?: ServerDemoMutationRangeInvalidation | null
}

export interface ServerDemoChangeFeedChange {
  type: "cell" | "range" | "row" | "dataset"
  invalidation: ServerDemoMutationInvalidation
  operationId?: string | null
  user_id?: string | null
  session_id?: string | null
  rows?: readonly ServerDemoDataSourceRowEntry[]
}

export interface ServerDemoFillChange {
  rowId: string
  columnKey: string
  before: unknown
  after: unknown
}

export interface ServerDemoFillOperationRecord {
  operationId: string
  revision: number
  sourceRange: DataGridViewportRange
  targetRange: DataGridViewportRange
  mode: "copy" | "series"
  changes: ServerDemoFillChange[]
  applied: boolean
}

export interface ServerDemoMutableState {
  committedOverrides: Map<string, Partial<ServerDemoRow>>
  pendingOverrides: Map<string, Partial<ServerDemoRow>>
  fillOperations: Map<string, ServerDemoFillOperationRecord>
  fillRevision: number
}

export interface ServerDemoAggregationDiagnostics {
  lastAggregationRequest: string
  aggregateResponseRows: string
  aggregatePreviewRows: string
}

export interface ServerDemoPullDiagnostics {
  pendingRequests: number
  loading: boolean
  error: Error | null
  lastViewportRange: DataGridViewportRange
  totalRows: number
  loadedRows: number
}

export interface ServerDemoSampleDiagnostics {
  sampleColumn: string
  sampleState: string
  sampleRow: string
  sampleBefore: string
  sampleAfter: string
  samplePullAfter: string
  sampleCachedAfter: string
  sampleRowIndex: string
  sampleVisibleIndex: string
  sampleLookupByIndex: string
  sampleLookupById: string
  sampleRowCache: string
  sampleCellReader: string
  sampleRendered: string
  visibleRowsPreview: string
  rowModelSnapshot: string
}

export interface ServerDemoFillDiagnostics {
  fillWarning: string
  fillBlocked: string
  fillApplied: string
  commitFillOperationCalled: string
  operationId: string
  affectedRows: string
  affectedRange: string
  visibleOverlap: string
  request: string
  mode: string
  fillColumns: string
  referenceColumns: string
  dispatchAttempted: string
  renderedViewport: string
  rawInvalidation: string
  invalidationRange: string
  normalizedInvalidation: string
  invalidationApplied: string
  runtimeRowModelInvalidateType: string
  invalidateCalled: string
  cacheRow1BeforeInvalidation: string
  cacheRow1AfterInvalidation: string
  syncInputRange: string
  latestRenderedViewport: string
  runtimeRenderedViewport: string
  displayRowsRenderedViewport: string
  selectedRenderedViewport: string
  refreshUsedStoredRendered: string
}

export interface ServerDemoChangeFeedResponse {
  datasetVersion: number
  changes: ServerDemoChangeFeedChange[]
}

export interface ServerDemoCommitDiagnostics {
  commitMode: string
  commitMessage: string
  commitDetails: string
  clientBatchApplied: string
  clientBatchWarning: string
  lastBatchRows: string
  lastSkippedRows: string
}

export interface ServerDemoDatasourceHooks {
  onPullDiagnostics?: (state: ServerDemoPullDiagnostics) => void
  onAggregationDiagnostics?: (state: ServerDemoAggregationDiagnostics) => void
  onSampleDiagnostics?: (state: ServerDemoSampleDiagnostics) => void
  onFillDiagnostics?: (state: ServerDemoFillDiagnostics) => void
  onCommitDiagnostics?: (state: ServerDemoCommitDiagnostics) => void
  onHistoryAction?: (value: string) => void
  reportFillPlumbingState?: (layer: string, present: boolean) => void
  reportFillPlumbingDetail?: (layer: string, value: string) => void
  captureFillBoundary?: (result: ServerDemoFillBoundaryResult | null) => void
  captureFillBoundarySide?: (side: "left" | "right", result: ServerDemoFillBoundaryResult | null) => void
  scheduleRenderedSampleDiagnostics?: () => void
  shouldSimulatePullFailure?: () => boolean
  shouldRejectCommittedRow?: (rowId: string) => boolean
}

export interface ServerDemoChangeFeedDiagnostics {
  currentDatasetVersion: number | null
  lastSeenVersion: number | null
  polling: boolean
  pending: boolean
  appliedChanges: number
  intervalMs: number | null
}

export interface ServerDemoFillProjectionContext {
  sortModel: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
  groupBy: DataGridGroupBySpec | null
  groupExpansion: DataGridGroupExpansionSnapshot
  treeData: unknown | null
  pivot: {
    pivotModel: DataGridPivotSpec | null
    aggregationModel: DataGridAggregationModel<any> | null
  } | null
  pagination: DataGridPaginationSnapshot
}

export type ServerDemoDataSource = DataGridDataSource<ServerDemoRow>
export type ServerDemoPullRequest = Parameters<ServerDemoDataSource["pull"]>[0]
export type ServerDemoPullResult = Awaited<ReturnType<ServerDemoDataSource["pull"]>> & {
  datasetVersion?: number | null
}
export type ServerDemoHistogramRequest = Parameters<NonNullable<ServerDemoDataSource["getColumnHistogram"]>>[0]
export type ServerDemoCommitEditsRequest = Parameters<NonNullable<ServerDemoDataSource["commitEdits"]>>[0]
export type ServerDemoCommitEditsResult = Awaited<ReturnType<NonNullable<ServerDemoDataSource["commitEdits"]>>> & {
  datasetVersion?: number | null
  serverInvalidation?: ServerDemoMutationInvalidation | null
}
export type ServerDemoFillOperationRequest = Parameters<NonNullable<ServerDemoDataSource["commitFillOperation"]>>[0]
export type ServerDemoFillOperationResult = Awaited<ReturnType<NonNullable<ServerDemoDataSource["commitFillOperation"]>>> & {
  datasetVersion?: number | null
  serverInvalidation?: ServerDemoMutationInvalidation | null
}
export type ServerDemoUndoFillRequest = Parameters<NonNullable<ServerDemoDataSource["undoFillOperation"]>>[0]
export type ServerDemoUndoFillResult = Awaited<ReturnType<NonNullable<ServerDemoDataSource["undoFillOperation"]>>> & {
  datasetVersion?: number | null
  serverInvalidation?: ServerDemoMutationInvalidation | null
}
export type ServerDemoRedoFillResult = Awaited<ReturnType<NonNullable<ServerDemoDataSource["redoFillOperation"]>>> & {
  datasetVersion?: number | null
  serverInvalidation?: ServerDemoMutationInvalidation | null
}
export interface ServerDemoChangeFeedRequest {
  sinceVersion: number
}
export type ServerDemoFillBoundaryRequest = Parameters<NonNullable<ServerDemoDataSource["resolveFillBoundary"]>>[0]
export type ServerDemoFillBoundaryResult = Awaited<ReturnType<NonNullable<ServerDemoDataSource["resolveFillBoundary"]>>>
export type ServerDemoDataSourceInvalidation = DataGridDataSourceInvalidation
export type ServerDemoDataSourceRowEntry = DataGridDataSourceRowEntry<ServerDemoRow>
export type ServerDemoPushListener = DataGridDataSourcePushListener<ServerDemoRow>
export type ServerDemoDataSourceHistogram = DataGridColumnHistogram
export type ServerDemoDataSourceHistogramRequest = Parameters<NonNullable<ServerDemoDataSource["getColumnHistogram"]>>[0]

export function createServerDemoMutableState(): ServerDemoMutableState {
  return {
    committedOverrides: new Map<string, Partial<ServerDemoRow>>(),
    pendingOverrides: new Map<string, Partial<ServerDemoRow>>(),
    fillOperations: new Map<string, ServerDemoFillOperationRecord>(),
    fillRevision: 0,
  }
}
