import { describe, expect, it } from "vitest"
import {
  createDataGridWorkerMessageHost,
  createDataGridWorkerPostMessageTransport,
  DATAGRID_WORKER_PROTOCOL_CHANNEL,
  type DataGridWorkerMessageEvent,
} from "../index"

type MessageListener = (event: DataGridWorkerMessageEvent) => void

class MemoryMessageEndpoint {
  private readonly listeners = new Set<MessageListener>()
  private peer: MemoryMessageEndpoint | null = null

  connect(peer: MemoryMessageEndpoint): void {
    this.peer = peer
  }

  postMessage(message: unknown): void {
    const peer = this.peer
    if (!peer) {
      return
    }
    queueMicrotask(() => {
      peer.emit(message)
    })
  }

  addEventListener(_type: "message", listener: MessageListener): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: "message", listener: MessageListener): void {
    this.listeners.delete(listener)
  }

  private emit(message: unknown): void {
    for (const listener of this.listeners) {
      listener({ data: message })
    }
  }
}

function createMessageChannelPair(): { main: MemoryMessageEndpoint; worker: MemoryMessageEndpoint } {
  const main = new MemoryMessageEndpoint()
  const worker = new MemoryMessageEndpoint()
  main.connect(worker)
  worker.connect(main)
  return { main, worker }
}

describe("datagrid-worker postMessage transport", () => {
  it("dispatches request and receives ack through host bridge", async () => {
    const channel = createMessageChannelPair()
    const host = createDataGridWorkerMessageHost({
      source: channel.worker,
      target: channel.worker,
      channel: DATAGRID_WORKER_PROTOCOL_CHANNEL,
      handleRequest() {
        return { handled: true }
      },
    })
    const transport = createDataGridWorkerPostMessageTransport({
      target: channel.main,
      source: channel.main,
      channel: DATAGRID_WORKER_PROTOCOL_CHANNEL,
      dispatchStrategy: "sync-fallback",
      requestTimeoutMs: 1_000,
    })

    const result = transport.dispatch({ kind: "refresh" })
    expect(result?.handled).toBe(false)

    await Promise.resolve()
    await Promise.resolve()

    const stats = transport.getStats()
    expect(stats.dispatched).toBe(1)
    expect(stats.acked).toBe(1)
    expect(stats.errored).toBe(0)
    expect(stats.timedOut).toBe(0)
    expect(stats.inflight).toBe(0)

    transport.dispose()
    host.dispose()
  })

  it("supports fire-and-forget strategy for future async compute hosts", () => {
    const channel = createMessageChannelPair()
    const transport = createDataGridWorkerPostMessageTransport({
      target: channel.main,
      source: null,
      dispatchStrategy: "fire-and-forget",
      requestTimeoutMs: 0,
    })

    const result = transport.dispatch({ kind: "refresh" })
    expect(result?.handled).toBe(true)
    expect(transport.getStats().dispatched).toBe(1)
    transport.dispose()
  })
})
