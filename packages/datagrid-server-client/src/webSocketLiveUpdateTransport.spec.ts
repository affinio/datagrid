import { describe, expect, it, vi } from "vitest"
import { createWebSocketLiveUpdateTransportFactory } from "./webSocketLiveUpdateTransport"

class FakeWebSocket {
  static OPEN = 1
  static instances: FakeWebSocket[] = []

  readonly url: string
  readyState = FakeWebSocket.OPEN
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  close = vi.fn(() => {
    this.readyState = 3
  })

  constructor(url: string | URL) {
    this.url = String(url)
    FakeWebSocket.instances.push(this)
  }
}

describe("createWebSocketLiveUpdateTransportFactory", () => {
  it("opens from the current sinceVersion and maps websocket messages into live-update responses", () => {
    FakeWebSocket.instances = []
    let sinceVersion = 7
    const onResponse = vi.fn()
    const diagnostics = vi.fn()
    const transport = createWebSocketLiveUpdateTransportFactory({
      url: version => `ws://localhost/api/changes/ws?sinceVersion=${version}`,
      WebSocketCtor: FakeWebSocket,
    })({
      getSinceVersion: () => sinceVersion,
      loadSinceVersion: vi.fn(),
      onResponse,
      onDiagnostics: diagnostics,
    })

    transport.start()
    const socket = FakeWebSocket.instances[0]
    expect(socket?.url).toBe("ws://localhost/api/changes/ws?sinceVersion=7")
    expect(transport.diagnostics()).toMatchObject({
      transportKind: "websocket",
      polling: true,
      pending: true,
      lastSeenVersion: 7,
    })

    socket?.onopen?.(new Event("open"))
    socket?.onmessage?.(new MessageEvent("message", {
      data: JSON.stringify({ datasetVersion: 8, changes: [] }),
    }))

    expect(onResponse).toHaveBeenCalledWith({ datasetVersion: 8, changes: [] }, 7)
    expect(transport.diagnostics()).toMatchObject({
      transportKind: "websocket",
      polling: true,
      pending: false,
      consecutiveFailures: 0,
    })
    expect(diagnostics).toHaveBeenCalled()

    sinceVersion = 8
    transport.stop()
    expect(socket?.close).toHaveBeenCalledWith(1000, "client-stop")
    expect(transport.diagnostics()).toMatchObject({
      transportKind: "websocket",
      polling: false,
      pending: false,
      lastSeenVersion: null,
    })
  })

  it("reconnects from the latest sinceVersion after close", () => {
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    let sinceVersion = 10
    const transport = createWebSocketLiveUpdateTransportFactory({
      url: version => `ws://localhost/api/changes/ws?sinceVersion=${version}`,
      WebSocketCtor: FakeWebSocket,
      reconnectDelayMs: 250,
    })({
      getSinceVersion: () => sinceVersion,
      loadSinceVersion: vi.fn(),
      onResponse: vi.fn(),
    })

    try {
      transport.start()
      const firstSocket = FakeWebSocket.instances[0]
      sinceVersion = 11
      firstSocket?.onclose?.(new CloseEvent("close"))

      vi.advanceTimersByTime(250)

      expect(FakeWebSocket.instances).toHaveLength(2)
      expect(FakeWebSocket.instances[1]?.url).toBe("ws://localhost/api/changes/ws?sinceVersion=11")
    } finally {
      transport.stop()
      vi.useRealTimers()
    }
  })
})
