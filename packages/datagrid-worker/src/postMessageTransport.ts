import type { DataGridClientComputeTransport } from "@affino/datagrid-core"
import {
  createDataGridWorkerComputeRequestMessage,
  isDataGridWorkerComputeAckMessage,
  type DataGridWorkerComputeRequest,
} from "./protocol.js"

export interface DataGridWorkerMessageEvent<T = unknown> {
  data: T
}

export interface DataGridWorkerMessageTarget {
  postMessage(message: unknown): void
  postMessage(message: unknown, transfer: Transferable[]): void
}

export interface DataGridWorkerMessageSource {
  addEventListener: (
    type: "message",
    listener: (event: DataGridWorkerMessageEvent) => void,
  ) => void
  removeEventListener: (
    type: "message",
    listener: (event: DataGridWorkerMessageEvent) => void,
  ) => void
}

export type DataGridWorkerDispatchStrategy = "sync-fallback" | "fire-and-forget"

// Compute transport has a synchronous fallback when dispatch returns handled=false.
// Keep unacknowledged postMessage work bounded without changing row-model commands.
const MAX_INFLIGHT_COMPUTE_REQUESTS = 32

export interface DataGridWorkerPostMessageTransportStats {
  dispatched: number
  acked: number
  errored: number
  timedOut: number
  inflight: number
}

export interface DataGridWorkerPostMessageTransport extends DataGridClientComputeTransport {
  getStats: () => DataGridWorkerPostMessageTransportStats
}

export interface CreateDataGridWorkerPostMessageTransportOptions {
  target: DataGridWorkerMessageTarget
  source?: DataGridWorkerMessageSource | null
  channel?: string | null
  dispatchStrategy?: DataGridWorkerDispatchStrategy
  requestTimeoutMs?: number
  resolveTransferList?: (input: {
    request: DataGridWorkerComputeRequest
    message: unknown
  }) => readonly Transferable[]
}

interface PendingRequestState {
  timeoutHandle: ReturnType<typeof setTimeout> | null
}

export function createDataGridWorkerPostMessageTransport(
  options: CreateDataGridWorkerPostMessageTransportOptions,
): DataGridWorkerPostMessageTransport {
  const channel = options.channel
  const strategy = options.dispatchStrategy ?? "sync-fallback"
  const requestTimeoutMs = Math.max(0, Math.trunc(options.requestTimeoutMs ?? 15_000))

  let nextRequestId = 1
  let dispatched = 0
  let acked = 0
  let errored = 0
  let timedOut = 0
  const pendingById = new Map<number, PendingRequestState>()

  const clearPending = (requestId: number): void => {
    const pending = pendingById.get(requestId)
    if (!pending) {
      return
    }
    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle)
    }
    pendingById.delete(requestId)
  }

  const onMessage = (event: DataGridWorkerMessageEvent): void => {
    if (!isDataGridWorkerComputeAckMessage(event.data, channel)) {
      return
    }
    const ackMessage = event.data
    if (!pendingById.has(ackMessage.requestId)) {
      return
    }
    clearPending(ackMessage.requestId)
    acked += 1
    if (ackMessage.payload.error) {
      errored += 1
    }
  }

  options.source?.addEventListener("message", onMessage)

  const dispatchRequest = (request: DataGridWorkerComputeRequest): void => {
    const requestId = nextRequestId
    nextRequestId += 1
    dispatched += 1
    const requestMessage = createDataGridWorkerComputeRequestMessage(
      requestId,
      request,
      channel,
    )
    const timeoutHandle = requestTimeoutMs > 0
      ? setTimeout(() => {
        if (!pendingById.has(requestId)) {
          return
        }
        pendingById.delete(requestId)
        timedOut += 1
      }, requestTimeoutMs)
      : null
    // Register before posting: MessageChannel implementations may deliver an ack synchronously.
    pendingById.set(requestId, { timeoutHandle })
    try {
      const transfer = options.resolveTransferList?.({ request, message: requestMessage }) ?? []
      options.target.postMessage(requestMessage, [...transfer])
    } catch (error) {
      clearPending(requestId)
      errored += 1
      throw error
    }
  }

  return {
    dispatch(request) {
      if (pendingById.size >= MAX_INFLIGHT_COMPUTE_REQUESTS) {
        return { handled: false }
      }
      dispatchRequest(request)
      return {
        handled: strategy === "fire-and-forget",
      }
    },
    getStats() {
      return {
        dispatched,
        acked,
        errored,
        timedOut,
        inflight: pendingById.size,
      }
    },
    dispose() {
      options.source?.removeEventListener("message", onMessage)
      for (const requestId of pendingById.keys()) {
        clearPending(requestId)
      }
    },
  }
}
