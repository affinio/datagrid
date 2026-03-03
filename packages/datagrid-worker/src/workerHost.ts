import {
  createDataGridWorkerComputeAckMessage,
  createDataGridWorkerComputeErrorAckMessage,
  isDataGridWorkerComputeRequestMessage,
  type DataGridWorkerComputeRequest,
  type DataGridWorkerComputeResult,
} from "./protocol.js"
import type {
  DataGridWorkerMessageEvent,
  DataGridWorkerMessageSource,
  DataGridWorkerMessageTarget,
} from "./postMessageTransport.js"

export interface CreateDataGridWorkerMessageHostOptions {
  source: DataGridWorkerMessageSource
  target: DataGridWorkerMessageTarget
  channel?: string | null
  handleRequest: (request: DataGridWorkerComputeRequest) => DataGridWorkerComputeResult | Promise<DataGridWorkerComputeResult>
}

export interface DataGridWorkerMessageHost {
  dispose: () => void
}

export function createDataGridWorkerMessageHost(
  options: CreateDataGridWorkerMessageHostOptions,
): DataGridWorkerMessageHost {
  let disposed = false

  const postSuccessAck = (requestId: number, result: DataGridWorkerComputeResult): void => {
    if (disposed) {
      return
    }
    const ack = createDataGridWorkerComputeAckMessage(
      requestId,
      result,
      options.channel,
    )
    options.target.postMessage(ack)
  }

  const postErrorAck = (requestId: number, error: unknown): void => {
    if (disposed) {
      return
    }
    const ack = createDataGridWorkerComputeErrorAckMessage(
      requestId,
      error,
      options.channel,
    )
    options.target.postMessage(ack)
  }

  const onMessage = (event: DataGridWorkerMessageEvent): void => {
    if (disposed) {
      return
    }
    if (!isDataGridWorkerComputeRequestMessage(event.data, options.channel)) {
      return
    }
    const requestMessage = event.data
    try {
      const result = options.handleRequest(requestMessage.payload)
      if (result instanceof Promise) {
        result
          .then((resolvedResult) => {
            postSuccessAck(requestMessage.requestId, resolvedResult)
          })
          .catch((error: unknown) => {
            postErrorAck(requestMessage.requestId, error)
          })
        return
      }
      postSuccessAck(requestMessage.requestId, result)
    } catch (error: unknown) {
      postErrorAck(requestMessage.requestId, error)
    }
  }

  options.source.addEventListener("message", onMessage)

  return {
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      options.source.removeEventListener("message", onMessage)
    },
  }
}
