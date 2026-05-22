import type {
  ServerDatasourceChangeFeedDiagnostics,
  ServerDatasourceChangeFeedPollerOptions,
} from "./changeFeedPoller"
import type { ServerDatasourceLiveUpdateTransport, ServerDatasourceLiveUpdateTransportFactory } from "./liveUpdateTransport"

type WebSocketLike = {
  readonly readyState: number
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  close(code?: number, reason?: string): void
}

type WebSocketConstructorLike = {
  readonly OPEN: number
  new(url: string | URL): WebSocketLike
}

export interface ServerDatasourceWebSocketLiveUpdateTransportOptions {
  url: string | ((sinceVersion: number) => string)
  WebSocketCtor?: WebSocketConstructorLike
  reconnectDelayMs?: number
}

function normalizeReconnectDelayMs(value: number | null | undefined): number {
  return Math.max(250, Number.isFinite(value) ? Math.trunc(value ?? 1000) : 1000)
}

function resolveWebSocketUrl(
  url: string | ((sinceVersion: number) => string),
  sinceVersion: number,
): string {
  return typeof url === "function" ? url(sinceVersion) : url
}

function parseMessageData(data: unknown): unknown {
  if (typeof data === "string") {
    return JSON.parse(data) as unknown
  }
  return data
}

export function createWebSocketLiveUpdateTransportFactory<TResponse = unknown>(
  transportOptions: ServerDatasourceWebSocketLiveUpdateTransportOptions,
): ServerDatasourceLiveUpdateTransportFactory<TResponse> {
  return options => createWebSocketLiveUpdateTransport(options, transportOptions)
}

export function createWebSocketLiveUpdateTransport<TResponse = unknown>(
  options: ServerDatasourceChangeFeedPollerOptions<TResponse>,
  transportOptions: ServerDatasourceWebSocketLiveUpdateTransportOptions,
): ServerDatasourceLiveUpdateTransport {
  const WebSocketCtor = transportOptions.WebSocketCtor ?? globalThis.WebSocket
  if (!WebSocketCtor) {
    throw new Error("WebSocket is not available in this runtime")
  }

  let socket: WebSocketLike | null = null
  let active = false
  let pending = false
  let appliedChangeCount = 0
  let lastSeenVersion: number | null = null
  let consecutiveFailureCount = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let generation = 0

  function diagnostics(): ServerDatasourceChangeFeedDiagnostics {
    return {
      currentDatasetVersion: null,
      lastSeenVersion,
      transportKind: "websocket",
      polling: active,
      pending,
      appliedChanges: appliedChangeCount,
      intervalMs: null,
      consecutiveFailures: consecutiveFailureCount,
      retryAttempt: 0,
      retryDelayMs: reconnectTimer ? normalizeReconnectDelayMs(transportOptions.reconnectDelayMs) : null,
    }
  }

  function emitDiagnostics(): void {
    options.onDiagnostics?.(diagnostics())
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function closeSocket(): void {
    const currentSocket = socket
    socket = null
    if (!currentSocket) {
      return
    }
    currentSocket.onopen = null
    currentSocket.onmessage = null
    currentSocket.onerror = null
    currentSocket.onclose = null
    currentSocket.close(1000, "client-stop")
  }

  function scheduleReconnect(requestGeneration: number): void {
    if (!active || requestGeneration !== generation || reconnectTimer !== null) {
      return
    }
    const delayMs = normalizeReconnectDelayMs(transportOptions.reconnectDelayMs)
    emitDiagnostics()
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (active && requestGeneration === generation) {
        connect(requestGeneration)
      }
    }, delayMs)
  }

  function connect(requestGeneration: number): void {
    if (!active || requestGeneration !== generation) {
      return
    }
    closeSocket()
    const sinceVersion = options.getSinceVersion() ?? 0
    lastSeenVersion = sinceVersion
    pending = true
    emitDiagnostics()

    const nextSocket = new WebSocketCtor(resolveWebSocketUrl(transportOptions.url, sinceVersion))
    socket = nextSocket

    nextSocket.onopen = () => {
      if (!active || requestGeneration !== generation || socket !== nextSocket) {
        return
      }
      pending = false
      consecutiveFailureCount = 0
      emitDiagnostics()
    }

    nextSocket.onmessage = event => {
      if (!active || requestGeneration !== generation || socket !== nextSocket) {
        return
      }
      try {
        const response = parseMessageData(event.data) as TResponse
        options.onResponse(response, lastSeenVersion ?? 0)
        pending = false
        consecutiveFailureCount = 0
        emitDiagnostics()
      } catch (caught) {
        consecutiveFailureCount += 1
        pending = false
        options.onError?.(caught)
        emitDiagnostics()
      }
    }

    nextSocket.onerror = event => {
      if (!active || requestGeneration !== generation || socket !== nextSocket) {
        return
      }
      consecutiveFailureCount += 1
      pending = false
      options.onError?.(event)
      emitDiagnostics()
    }

    nextSocket.onclose = () => {
      if (!active || requestGeneration !== generation || socket !== nextSocket) {
        return
      }
      socket = null
      pending = false
      emitDiagnostics()
      scheduleReconnect(requestGeneration)
    }
  }

  function start(): void {
    stop()
    active = true
    generation += 1
    emitDiagnostics()
    connect(generation)
  }

  function stop(): void {
    active = false
    generation += 1
    clearReconnectTimer()
    closeSocket()
    pending = false
    lastSeenVersion = null
    consecutiveFailureCount = 0
    emitDiagnostics()
  }

  async function pollNow(): Promise<void> {
    if (!active) {
      return
    }
    const currentSocket = socket
    if (!currentSocket || currentSocket.readyState !== WebSocketCtor.OPEN) {
      clearReconnectTimer()
      connect(generation)
    }
  }

  function incrementAppliedChanges(count = 1): void {
    const normalizedCount = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
    if (normalizedCount <= 0) {
      return
    }
    appliedChangeCount += normalizedCount
    emitDiagnostics()
  }

  return {
    kind: "websocket",
    start,
    stop,
    pollNow,
    diagnostics,
    incrementAppliedChanges,
  }
}
