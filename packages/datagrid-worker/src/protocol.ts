import type { DataGridClientComputeTransport, DataGridClientComputeTransportResult } from "@affino/datagrid-core"

export const DATAGRID_WORKER_PROTOCOL_VERSION = 1 as const
export const DATAGRID_WORKER_COMPUTE_PAYLOAD_SCHEMA_VERSION = 2 as const
export const DATAGRID_WORKER_PROTOCOL_CHANNEL = "affino.datagrid.compute"

export type DataGridWorkerComputeRequest = Parameters<DataGridClientComputeTransport["dispatch"]>[0]
export type DataGridWorkerComputeResult = DataGridClientComputeTransportResult

export interface DataGridWorkerComputeBatchPlan {
  kind: "stage-plan" | "execution-plan"
  requestedStages: readonly string[]
  blockedStages: readonly string[]
  patchChangedRowCount?: number
}

export interface DataGridWorkerComputeRequestPayloadEnvelope {
  schemaVersion: number
  request: DataGridWorkerComputeRequest
  batchPlan?: DataGridWorkerComputeBatchPlan | null
}

export type DataGridWorkerComputeRequestPayload =
  | DataGridWorkerComputeRequest
  | DataGridWorkerComputeRequestPayloadEnvelope

export interface DataGridWorkerProtocolHeader {
  version: typeof DATAGRID_WORKER_PROTOCOL_VERSION
  channel: string
  requestId: number
  timestamp: number
}

export interface DataGridWorkerComputeRequestMessage extends DataGridWorkerProtocolHeader {
  kind: "compute-request"
  payload: DataGridWorkerComputeRequestPayload
}

export interface DataGridWorkerComputeAckMessage extends DataGridWorkerProtocolHeader {
  kind: "compute-ack"
  payload: {
    handled: boolean
    error?: string | null
  }
}

export type DataGridWorkerProtocolMessage =
  | DataGridWorkerComputeRequestMessage
  | DataGridWorkerComputeAckMessage

function isWorkerComputeRequestKind(
  value: unknown,
): value is DataGridWorkerComputeRequest["kind"] {
  return (
    value === "recompute-from-stage"
    || value === "recompute-with-stage-plan"
    || value === "recompute-with-execution-plan"
    || value === "refresh"
  )
}

function serializeComputeBatchPlan(
  request: DataGridWorkerComputeRequest,
): DataGridWorkerComputeBatchPlan | null {
  if (request.kind === "recompute-with-stage-plan") {
    return {
      kind: "stage-plan",
      requestedStages: [...request.plan.requestedStages],
      blockedStages: [...(request.plan.blockedStages ?? [])],
    }
  }
  if (request.kind === "recompute-with-execution-plan") {
    return {
      kind: "execution-plan",
      requestedStages: [...request.plan.requestedStages],
      blockedStages: [...(request.plan.blockedStages ?? [])],
      ...(typeof request.options?.patchChangedRowCount === "number"
        ? { patchChangedRowCount: request.options.patchChangedRowCount }
        : {}),
    }
  }
  return null
}

function normalizeChannel(channel: string | null | undefined): string {
  const normalized = channel?.trim()
  return normalized && normalized.length > 0
    ? normalized
    : DATAGRID_WORKER_PROTOCOL_CHANNEL
}

function isWorkerProtocolHeader(value: unknown): value is DataGridWorkerProtocolHeader {
  if (!value || typeof value !== "object") {
    return false
  }
  const candidate = value as Partial<DataGridWorkerProtocolHeader>
  return (
    candidate.version === DATAGRID_WORKER_PROTOCOL_VERSION &&
    typeof candidate.channel === "string" &&
    Number.isFinite(candidate.requestId) &&
    Number.isFinite(candidate.timestamp)
  )
}

export function createDataGridWorkerComputeRequestMessage(
  requestId: number,
  payload: DataGridWorkerComputeRequest,
  channel?: string | null,
): DataGridWorkerComputeRequestMessage {
  const batchPlan = serializeComputeBatchPlan(payload)
  return {
    kind: "compute-request",
    version: DATAGRID_WORKER_PROTOCOL_VERSION,
    channel: normalizeChannel(channel),
    requestId,
    timestamp: Date.now(),
    payload: {
      schemaVersion: DATAGRID_WORKER_COMPUTE_PAYLOAD_SCHEMA_VERSION,
      request: payload,
      batchPlan,
    },
  }
}

export function createDataGridWorkerComputeAckMessage(
  requestId: number,
  result: DataGridWorkerComputeResult,
  channel?: string | null,
): DataGridWorkerComputeAckMessage {
  return {
    kind: "compute-ack",
    version: DATAGRID_WORKER_PROTOCOL_VERSION,
    channel: normalizeChannel(channel),
    requestId,
    timestamp: Date.now(),
    payload: {
      handled: result?.handled === true,
      error: null,
    },
  }
}

export function createDataGridWorkerComputeErrorAckMessage(
  requestId: number,
  error: unknown,
  channel?: string | null,
): DataGridWorkerComputeAckMessage {
  const message = error instanceof Error
    ? error.message
    : String(error ?? "unknown worker error")
  return {
    kind: "compute-ack",
    version: DATAGRID_WORKER_PROTOCOL_VERSION,
    channel: normalizeChannel(channel),
    requestId,
    timestamp: Date.now(),
    payload: {
      handled: false,
      error: message,
    },
  }
}

export function isDataGridWorkerComputeRequestMessage(
  value: unknown,
  channel?: string | null,
): value is DataGridWorkerComputeRequestMessage {
  if (!isWorkerProtocolHeader(value)) {
    return false
  }
  const candidate = value as Partial<DataGridWorkerComputeRequestMessage>
  const channelMatches = candidate.channel === normalizeChannel(channel)
  return (
    candidate.kind === "compute-request"
    && channelMatches
    && resolveWorkerComputeRequestPayload(candidate.payload) !== null
  )
}

export function isDataGridWorkerComputeAckMessage(
  value: unknown,
  channel?: string | null,
): value is DataGridWorkerComputeAckMessage {
  if (!isWorkerProtocolHeader(value)) {
    return false
  }
  const candidate = value as Partial<DataGridWorkerComputeAckMessage>
  const channelMatches = candidate.channel === normalizeChannel(channel)
  return candidate.kind === "compute-ack" && channelMatches && candidate.payload != null
}

export function resolveWorkerComputeRequestPayload(
  payload: unknown,
): DataGridWorkerComputeRequestPayloadEnvelope | null {
  if (!payload || typeof payload !== "object") {
    return null
  }
  const directCandidate = payload as Partial<DataGridWorkerComputeRequest>
  if (isWorkerComputeRequestKind(directCandidate.kind)) {
    return {
      schemaVersion: 1,
      request: directCandidate as DataGridWorkerComputeRequest,
      batchPlan: serializeComputeBatchPlan(directCandidate as DataGridWorkerComputeRequest),
    }
  }
  const envelope = payload as Partial<DataGridWorkerComputeRequestPayloadEnvelope>
  if (
    typeof envelope.schemaVersion !== "number"
    || !Number.isFinite(envelope.schemaVersion)
    || !envelope.request
    || !isWorkerComputeRequestKind((envelope.request as { kind?: unknown }).kind)
  ) {
    return null
  }
  return {
    schemaVersion: envelope.schemaVersion,
    request: envelope.request as DataGridWorkerComputeRequest,
    batchPlan: envelope.batchPlan ?? null,
  }
}
