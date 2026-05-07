export interface ServerDatasourceChangeFeedDiagnostics {
  currentDatasetVersion: number | null
  lastSeenVersion: number | null
  polling: boolean
  pending: boolean
  appliedChanges: number
  intervalMs: number | null
}

export interface ServerDatasourceChangeFeedPollerOptions<TResponse> {
  getSinceVersion: () => number | null
  loadSinceVersion: (sinceVersion: number, signal?: AbortSignal) => Promise<TResponse>
  onResponse: (response: TResponse, requestSinceVersion: number) => void
  onError?: (error: unknown) => void
  onDiagnostics?: (diagnostics: ServerDatasourceChangeFeedDiagnostics) => void
  isInvalidSinceVersionError?: (error: unknown) => boolean
  onInvalidSinceVersion?: () => void
  intervalMs?: number
}

export interface ServerDatasourceChangeFeedPoller {
  start(options?: { intervalMs?: number }): void
  stop(): void
  pollNow(signal?: AbortSignal): Promise<void>
  diagnostics(): ServerDatasourceChangeFeedDiagnostics
  incrementAppliedChanges(count?: number): void
}

const DEFAULT_INTERVAL_MS = 500
const MIN_INTERVAL_MS = 250

function normalizeIntervalMs(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_INTERVAL_MS
  }
  return Math.max(MIN_INTERVAL_MS, Math.trunc(value ?? DEFAULT_INTERVAL_MS))
}

export function createChangeFeedPoller<TResponse>(
  options: ServerDatasourceChangeFeedPollerOptions<TResponse>,
): ServerDatasourceChangeFeedPoller {
  let pollingActive = false
  let pollingIntervalMs: number | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let pollInFlight = false
  let pollGeneration = 0
  let pollAbortController: AbortController | null = null
  let pollAbortCleanup: (() => void) | null = null
  let appliedChangeCount = 0
  let lastSeenVersion: number | null = null

  function diagnostics(): ServerDatasourceChangeFeedDiagnostics {
    return {
      currentDatasetVersion: null,
      lastSeenVersion,
      polling: pollingActive,
      pending: pollInFlight,
      appliedChanges: appliedChangeCount,
      intervalMs: pollingIntervalMs,
    }
  }

  function emitDiagnostics(): void {
    options.onDiagnostics?.(diagnostics())
  }

  function clearAbortCleanup(): void {
    if (pollAbortCleanup) {
      pollAbortCleanup()
      pollAbortCleanup = null
    }
  }

  function createRequestSignal(signal?: AbortSignal): AbortSignal {
    const controller = new AbortController()
    pollAbortController = controller
    if (!signal) {
      pollAbortCleanup = null
      return controller.signal
    }
    if (signal.aborted) {
      controller.abort()
      pollAbortCleanup = null
      return controller.signal
    }
    const abortListener = (): void => {
      controller.abort()
    }
    signal.addEventListener("abort", abortListener, { once: true })
    pollAbortCleanup = () => {
      signal.removeEventListener("abort", abortListener)
    }
    return controller.signal
  }

  async function pollNow(signal?: AbortSignal): Promise<void> {
    if (!pollingActive || pollInFlight) {
      return
    }

    const requestGeneration = pollGeneration
    const sinceVersion = options.getSinceVersion() ?? 0
    const requestSignal = createRequestSignal(signal)

    lastSeenVersion = sinceVersion
    pollInFlight = true
    emitDiagnostics()

    try {
      const response = await options.loadSinceVersion(sinceVersion, requestSignal)
      if (!pollingActive || requestGeneration !== pollGeneration) {
        return
      }
      options.onResponse(response, sinceVersion)
    } catch (caught) {
      if (options.isInvalidSinceVersionError?.(caught)) {
        options.onInvalidSinceVersion?.()
      } else if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        options.onError?.(caught)
      }
    } finally {
      if (pollAbortController !== null) {
        pollAbortController = null
      }
      clearAbortCleanup()
      pollInFlight = false
      emitDiagnostics()
    }
  }

  function stop(): void {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    pollingActive = false
    pollingIntervalMs = null
    pollGeneration += 1
    if (pollAbortController && !pollAbortController.signal.aborted) {
      pollAbortController.abort()
    }
    pollAbortController = null
    clearAbortCleanup()
    pollInFlight = false
    lastSeenVersion = null
    emitDiagnostics()
  }

  function start(startOptions: { intervalMs?: number } = {}): void {
    stop()
    pollingActive = true
    pollingIntervalMs = normalizeIntervalMs(startOptions.intervalMs ?? options.intervalMs)
    pollGeneration += 1
    emitDiagnostics()
    void pollNow()
    pollTimer = globalThis.setInterval(() => {
      void pollNow()
    }, pollingIntervalMs)
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
    start,
    stop,
    pollNow,
    diagnostics,
    incrementAppliedChanges,
  }
}
