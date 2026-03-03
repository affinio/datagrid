import type {
  DataGridAggregationModel,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridPivotSpec,
  DataGridRowModelRefreshReason,
  DataGridRowModelSnapshot,
  DataGridRowNode,
  DataGridRowNodeInput,
  DataGridSortAndFilterModelInput,
  DataGridSortState,
  DataGridViewportRange,
} from "@affino/datagrid-core"

export const DATAGRID_WORKER_ROW_MODEL_PROTOCOL_VERSION = 1 as const
export const DATAGRID_WORKER_ROW_MODEL_PROTOCOL_CHANNEL = "affino.datagrid.row-model"

export interface DataGridWorkerRowModelProtocolHeader {
  version: typeof DATAGRID_WORKER_ROW_MODEL_PROTOCOL_VERSION
  channel: string
  requestId: number
  timestamp: number
}

export type DataGridWorkerViewportCoalesceScope = "user" | "prefetch"

export type DataGridWorkerRowModelCommand<T = unknown> =
  | { type: "sync" }
  | { type: "set-rows"; rows: readonly DataGridRowNodeInput<T>[] }
  | { type: "patch-rows"; updates: readonly DataGridClientRowPatch<T>[]; options?: DataGridClientRowPatchOptions }
  | {
    type: "set-viewport-range"
    range: DataGridViewportRange
    coalesceScope?: DataGridWorkerViewportCoalesceScope
  }
  | { type: "set-pagination"; pagination: DataGridPaginationInput | null }
  | { type: "set-page-size"; pageSize: number | null }
  | { type: "set-current-page"; page: number }
  | { type: "set-sort-model"; sortModel: readonly DataGridSortState[] }
  | { type: "set-filter-model"; filterModel: DataGridFilterSnapshot | null }
  | { type: "set-sort-and-filter-model"; input: DataGridSortAndFilterModelInput }
  | { type: "set-group-by"; groupBy: DataGridGroupBySpec | null }
  | { type: "set-pivot-model"; pivotModel: DataGridPivotSpec | null }
  | { type: "set-aggregation-model"; aggregationModel: DataGridAggregationModel<T> | null }
  | { type: "set-group-expansion"; expansion: DataGridGroupExpansionSnapshot | null }
  | { type: "toggle-group"; groupKey: string }
  | { type: "expand-group"; groupKey: string }
  | { type: "collapse-group"; groupKey: string }
  | { type: "expand-all-groups" }
  | { type: "collapse-all-groups" }
  | { type: "refresh"; reason?: DataGridRowModelRefreshReason }

export interface DataGridWorkerRowModelCommandMessage<T = unknown> extends DataGridWorkerRowModelProtocolHeader {
  kind: "row-model-command"
  payload: DataGridWorkerRowModelCommand<T>
}

export interface DataGridWorkerRowModelUpdatePayload<T = unknown> {
  snapshot: DataGridRowModelSnapshot<T>
  aggregationModel: DataGridAggregationModel<T> | null
  visibleRows: readonly DataGridRowNode<T>[]
  visibleRange: DataGridViewportRange
}

export interface DataGridWorkerRowModelUpdateMessage<T = unknown> extends DataGridWorkerRowModelProtocolHeader {
  kind: "row-model-update"
  payload: DataGridWorkerRowModelUpdatePayload<T>
}

export type DataGridWorkerRowModelProtocolMessage<T = unknown> =
  | DataGridWorkerRowModelCommandMessage<T>
  | DataGridWorkerRowModelUpdateMessage<T>

function normalizeChannel(channel: string | null | undefined): string {
  const normalized = channel?.trim()
  return normalized && normalized.length > 0
    ? normalized
    : DATAGRID_WORKER_ROW_MODEL_PROTOCOL_CHANNEL
}

function isProtocolHeader(value: unknown): value is DataGridWorkerRowModelProtocolHeader {
  if (!value || typeof value !== "object") {
    return false
  }
  const candidate = value as Partial<DataGridWorkerRowModelProtocolHeader>
  return (
    candidate.version === DATAGRID_WORKER_ROW_MODEL_PROTOCOL_VERSION &&
    typeof candidate.channel === "string" &&
    Number.isFinite(candidate.requestId) &&
    Number.isFinite(candidate.timestamp)
  )
}

export function createDataGridWorkerRowModelCommandMessage<T = unknown>(
  requestId: number,
  payload: DataGridWorkerRowModelCommand<T>,
  channel?: string | null,
): DataGridWorkerRowModelCommandMessage<T> {
  return {
    kind: "row-model-command",
    version: DATAGRID_WORKER_ROW_MODEL_PROTOCOL_VERSION,
    channel: normalizeChannel(channel),
    requestId,
    timestamp: Date.now(),
    payload,
  }
}

export function createDataGridWorkerRowModelUpdateMessage<T = unknown>(
  requestId: number,
  payload: DataGridWorkerRowModelUpdatePayload<T>,
  channel?: string | null,
): DataGridWorkerRowModelUpdateMessage<T> {
  return {
    kind: "row-model-update",
    version: DATAGRID_WORKER_ROW_MODEL_PROTOCOL_VERSION,
    channel: normalizeChannel(channel),
    requestId,
    timestamp: Date.now(),
    payload,
  }
}

export function isDataGridWorkerRowModelCommandMessage<T = unknown>(
  value: unknown,
  channel?: string | null,
): value is DataGridWorkerRowModelCommandMessage<T> {
  if (!isProtocolHeader(value)) {
    return false
  }
  const candidate = value as Partial<DataGridWorkerRowModelCommandMessage<T>>
  return (
    candidate.kind === "row-model-command" &&
    candidate.channel === normalizeChannel(channel) &&
    candidate.payload != null &&
    typeof (candidate.payload as { type?: unknown }).type === "string"
  )
}

export function isDataGridWorkerRowModelUpdateMessage<T = unknown>(
  value: unknown,
  channel?: string | null,
): value is DataGridWorkerRowModelUpdateMessage<T> {
  if (!isProtocolHeader(value)) {
    return false
  }
  const candidate = value as Partial<DataGridWorkerRowModelUpdateMessage<T>>
  return (
    candidate.kind === "row-model-update" &&
    candidate.channel === normalizeChannel(channel) &&
    candidate.payload != null &&
    typeof (candidate.payload as { snapshot?: unknown }).snapshot === "object"
  )
}
