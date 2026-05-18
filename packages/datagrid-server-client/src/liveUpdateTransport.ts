import {
  createChangeFeedPoller,
  type ServerDatasourceChangeFeedDiagnostics,
  type ServerDatasourceChangeFeedPollerOptions,
} from "./changeFeedPoller"

export type ServerDatasourceLiveUpdateTransportKind = "polling" | "custom"

export interface ServerDatasourceLiveUpdateTransport {
  kind: ServerDatasourceLiveUpdateTransportKind
  start(options?: { intervalMs?: number }): void
  stop(): void
  pollNow(signal?: AbortSignal): Promise<void>
  diagnostics(): ServerDatasourceChangeFeedDiagnostics
  incrementAppliedChanges(count?: number): void
}

export type ServerDatasourceLiveUpdateTransportFactory<TResponse = unknown> = (
  options: ServerDatasourceChangeFeedPollerOptions<TResponse>,
) => ServerDatasourceLiveUpdateTransport

export function createPollingLiveUpdateTransport<TResponse>(
  options: ServerDatasourceChangeFeedPollerOptions<TResponse>,
): ServerDatasourceLiveUpdateTransport {
  const poller = createChangeFeedPoller(options)
  return {
    kind: "polling",
    start: poller.start,
    stop: poller.stop,
    pollNow: poller.pollNow,
    diagnostics: poller.diagnostics,
    incrementAppliedChanges: poller.incrementAppliedChanges,
  }
}
