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
  postMessage: (message: unknown) => void
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
    options.target.postMessage(requestMessage)
    if (requestTimeoutMs > 0) {
      const timeoutHandle = setTimeout(() => {
        if (!pendingById.has(requestId)) {
          return
        }
        pendingById.delete(requestId)
        timedOut += 1
      }, requestTimeoutMs)
      pendingById.set(requestId, { timeoutHandle })
      return
    }
    pendingById.set(requestId, { timeoutHandle: null })
  }

  return {
    dispatch(request) {
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
