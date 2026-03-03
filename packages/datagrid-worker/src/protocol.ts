import type { DataGridClientComputeTransport, DataGridClientComputeTransportResult } from "@affino/datagrid-core"

export const DATAGRID_WORKER_PROTOCOL_VERSION = 1 as const
export const DATAGRID_WORKER_PROTOCOL_CHANNEL = "affino.datagrid.compute"

export type DataGridWorkerComputeRequest = Parameters<DataGridClientComputeTransport["dispatch"]>[0]
export type DataGridWorkerComputeResult = DataGridClientComputeTransportResult

export interface DataGridWorkerProtocolHeader {
  version: typeof DATAGRID_WORKER_PROTOCOL_VERSION
  channel: string
  requestId: number
  timestamp: number
}

export interface DataGridWorkerComputeRequestMessage extends DataGridWorkerProtocolHeader {
  kind: "compute-request"
  payload: DataGridWorkerComputeRequest
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
  return {
    kind: "compute-request",
    version: DATAGRID_WORKER_PROTOCOL_VERSION,
    channel: normalizeChannel(channel),
    requestId,
    timestamp: Date.now(),
    payload,
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
  return candidate.kind === "compute-request" && channelMatches && candidate.payload != null
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
