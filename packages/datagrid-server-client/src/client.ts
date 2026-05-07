import type {
  DataGridColumnHistogram,
  DataGridDataSource,
  DataGridDataSourceColumnHistogramRequest,
  DataGridDataSourceInvalidation,
  DataGridDataSourcePullRequest,
  DataGridDataSourcePullResult,
  DataGridDataSourcePushEvent,
  DataGridDataSourcePushListener,
  DataGridDataSourceRowEntry,
} from "@affino/datagrid-core"
import {
  createChangeFeedPoller,
  type ServerDatasourceChangeFeedDiagnostics,
  type ServerDatasourceChangeFeedPoller,
} from "./changeFeedPoller"
import { getJson, postJson, resolveEndpoint } from "./http"
import { mapServerChangeEvent, type ServerChangeEventLike } from "./changeFeedMapping"
import { normalizeDatasourceInvalidation } from "./invalidation"
import { normalizeDatasetVersion } from "./normalize"
import { normalizeRowSnapshots, type ServerRowSnapshotLike } from "./rowSnapshot"

export interface ServerDatasourceHttpClientOptions<TRow> {
  baseUrl?: string
  fetchImpl?: typeof fetch

  endpoints: {
    pull: string
    histogram: string
    commitEdits: string
    resolveFillBoundary: string
    commitFillOperation: string
    undoOperation: (operationId: string) => string
    redoOperation: (operationId: string) => string
    historyStatus?: string
    changesSinceVersion: (sinceVersion: number) => string
  }

  mapPullRequest?: (request: DataGridDataSourcePullRequest) => unknown
  mapHistogramRequest?: (request: DataGridDataSourceColumnHistogramRequest) => unknown

  mapPullResponse: (response: unknown) => {
    rows: readonly DataGridDataSourceRowEntry<TRow>[]
    total: number
    revision?: string | number | null
    datasetVersion?: number | null
  }

  mapHistogramResponse?: (response: unknown) => DataGridColumnHistogram
  mapCommitEditsResponse?: (response: unknown) => unknown
  mapFillResponse?: (response: unknown) => unknown
  mapChangeFeedResponse?: (
    response: unknown,
  ) => {
    datasetVersion?: unknown
    changes?: readonly ServerChangeEventLike<TRow>[]
  } | null

  isInvalidSinceVersionError?: (error: unknown) => boolean
}

/**
 * Low-level server datasource transport client.
 *
 * This factory covers the read and change-feed side of the server datasource
 * contract:
 *
 * - `pull` for viewport reads
 * - `getColumnHistogram` for histogram reads when the backend supports it
 * - `getChangesSinceVersion` / polling for change-feed updates
 * - row snapshot normalization and push event dispatch
 *
 * Write, fill, and history behavior are backend and adapter concerns. This
 * client can be composed underneath an opinionated adapter, but most users
 * should start with `@affino/datagrid-server-adapters`.
 */
export function createServerDatasourceHttpClient<TRow>(
  options: ServerDatasourceHttpClientOptions<TRow>,
): DataGridDataSource<TRow> & {
  startChangeFeedPolling(options?: { intervalMs?: number }): void
  stopChangeFeedPolling(): void
  getChangeFeedDiagnostics(): ServerDatasourceChangeFeedDiagnostics
  subscribeChangeFeedDiagnostics(listener: (diagnostics: ServerDatasourceChangeFeedDiagnostics) => void): () => void
  applyRowSnapshots(rows: readonly ServerRowSnapshotLike<TRow>[] | readonly DataGridDataSourceRowEntry<TRow>[]): boolean
  getChangesSinceVersion(request: { sinceVersion: number; signal?: AbortSignal }): Promise<unknown>
  readonly latestDatasetVersion: number | null
  readonly lastSeenVersion: number | null
} {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const listeners = new Set<DataGridDataSourcePushListener<TRow>>()
  const diagnosticsListeners = new Set<(diagnostics: ServerDatasourceChangeFeedDiagnostics) => void>()
  let latestDatasetVersion: number | null = null
  let lastSeenVersion: number | null = null

  function emitPushEvent(event: DataGridDataSourcePushEvent<TRow>): void {
    for (const listener of listeners) {
      listener(event)
    }
  }

  function emitDiagnostics(): void {
    const diagnostics = getChangeFeedDiagnostics()
    for (const listener of diagnosticsListeners) {
      listener(diagnostics)
    }
  }

  function updateDatasetVersion(version: unknown, markSeen = false): void {
    const normalizedVersion = normalizeDatasetVersion(version)
    if (normalizedVersion === null) {
      return
    }
    latestDatasetVersion = normalizedVersion
    if (markSeen) {
      lastSeenVersion = normalizedVersion
    }
    emitDiagnostics()
  }

  function resetChangeFeedCursor(): void {
    lastSeenVersion = 0
    emitDiagnostics()
  }

  function mapChangeFeedResponse(
    response: unknown,
  ): {
      datasetVersion?: unknown
      changes?: readonly ServerChangeEventLike<TRow>[]
    } | null {
    const mappedResponse = options.mapChangeFeedResponse?.(response)
    if (mappedResponse) {
      return mappedResponse
    }
    if (!response || typeof response !== "object" || Array.isArray(response)) {
      return null
    }
    const record = response as Record<string, unknown>
    const changes = Array.isArray(record.changes)
      ? record.changes as readonly ServerChangeEventLike<TRow>[]
      : []
    return {
      datasetVersion: record.datasetVersion,
      changes,
    }
  }

  function dispatchChangeFeedChange(change: ServerChangeEventLike<TRow>): void {
    const mapped = mapServerChangeEvent(change, normalizeDatasourceInvalidation)
    changeFeedPoller.incrementAppliedChanges(mapped.appliedCount)
    if (mapped.kind === "upsert") {
      emitPushEvent({
        type: "upsert",
        rows: mapped.rows,
        datasetVersion: latestDatasetVersion,
      })
      return
    }
    emitPushEvent({
      type: "invalidate",
      datasetVersion: latestDatasetVersion,
      invalidation: mapped.invalidation,
    })
  }

  function applyChangeFeedResponse(response: unknown): void {
    const mappedResponse = mapChangeFeedResponse(response)
    if (!mappedResponse) {
      return
    }
    updateDatasetVersion(mappedResponse.datasetVersion, true)
    for (const change of mappedResponse.changes ?? []) {
      dispatchChangeFeedChange(change)
    }
  }

  const changeFeedPoller: ServerDatasourceChangeFeedPoller = createChangeFeedPoller<unknown>({
    getSinceVersion: () => lastSeenVersion,
    loadSinceVersion: async (sinceVersion: number, signal?: AbortSignal) => {
      return await loadChangeFeedSinceVersion(sinceVersion, signal)
    },
    onResponse: response => {
      applyChangeFeedResponse(response)
    },
    onError: error => {
      console.warn("Server datasource change feed polling failed", error)
    },
    onDiagnostics: () => {
      emitDiagnostics()
    },
    isInvalidSinceVersionError: options.isInvalidSinceVersionError,
    onInvalidSinceVersion: () => {
      resetChangeFeedCursor()
    },
  })

  function getChangeFeedDiagnostics(): ServerDatasourceChangeFeedDiagnostics {
    const diagnostics = changeFeedPoller.diagnostics()
    return {
      currentDatasetVersion: latestDatasetVersion,
      lastSeenVersion,
      polling: diagnostics.polling,
      pending: diagnostics.pending,
      appliedChanges: diagnostics.appliedChanges,
      intervalMs: diagnostics.intervalMs,
    }
  }

  function loadChangeFeedSinceVersion(sinceVersion: number, signal?: AbortSignal): Promise<unknown> {
    return getJson<unknown>(
      fetchImpl,
      resolveEndpoint(options.baseUrl, options.endpoints.changesSinceVersion(sinceVersion)),
      signal,
    )
  }

  async function getChangesSinceVersion(request: { sinceVersion: number; signal?: AbortSignal }): Promise<unknown> {
    const response = await loadChangeFeedSinceVersion(request.sinceVersion, request.signal)
    applyChangeFeedResponse(response)
    return response
  }

  function applyRowSnapshots(rows: readonly ServerRowSnapshotLike<TRow>[] | readonly DataGridDataSourceRowEntry<TRow>[]): boolean {
    const normalizedRows = normalizeRowSnapshots(rows as readonly ServerRowSnapshotLike<TRow>[])
    if (!normalizedRows || normalizedRows.length === 0) {
      return false
    }
    emitPushEvent({
      type: "upsert",
      rows: normalizedRows,
    })
    return true
  }

  function startChangeFeedPolling(startOptions: { intervalMs?: number } = {}): void {
    changeFeedPoller.start({ intervalMs: startOptions.intervalMs })
  }

  function stopChangeFeedPolling(): void {
    changeFeedPoller.stop()
  }

  // The low-level client intentionally leaves request shaping to the caller.
  // Adapter-level packages can map additional domain-specific fields here.
  function mapPullBody(request: DataGridDataSourcePullRequest): unknown {
    if (options.mapPullRequest) {
      return options.mapPullRequest(request)
    }
    const { signal: _signal, ...body } = request
    return body
  }

  // Histogram requests are also read-only transport concerns. Write/fill/history
  // flows should be implemented by an adapter or host-specific wrapper.
  function mapHistogramBody(request: DataGridDataSourceColumnHistogramRequest): unknown {
    if (options.mapHistogramRequest) {
      return options.mapHistogramRequest(request)
    }
    const { signal: _signal, ...body } = request
    return body
  }

  return {
    async pull(request: DataGridDataSourcePullRequest): Promise<DataGridDataSourcePullResult<TRow>> {
      const response = await postJson<unknown>(
        fetchImpl,
        resolveEndpoint(options.baseUrl, options.endpoints.pull),
        mapPullBody(request),
        request.signal,
      )
      const mappedResponse = options.mapPullResponse(response)
      const startIndex = Math.max(0, Math.trunc(request.range.start))
      updateDatasetVersion(mappedResponse.datasetVersion ?? normalizeDatasetVersion(mappedResponse.revision), true)
      return {
        rows: mappedResponse.rows.map((entry, offset) => ({
          ...entry,
          index: startIndex + offset,
        })),
        total: mappedResponse.total,
        cursor: mappedResponse.revision == null ? null : String(mappedResponse.revision),
        datasetVersion: latestDatasetVersion,
      }
    },

    async getColumnHistogram(request: DataGridDataSourceColumnHistogramRequest): Promise<DataGridColumnHistogram> {
      const response = await postJson<unknown>(
        fetchImpl,
        resolveEndpoint(options.baseUrl, options.endpoints.histogram),
        mapHistogramBody(request),
        request.signal,
      )
      return options.mapHistogramResponse?.(response) ?? (response as DataGridColumnHistogram)
    },

    subscribe(listener: DataGridDataSourcePushListener<TRow>): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    invalidate(_invalidation: DataGridDataSourceInvalidation): void {
      // Source-of-truth invalidations are emitted by the server or adapter.
    },

    getChangesSinceVersion,
    startChangeFeedPolling,
    stopChangeFeedPolling,
    getChangeFeedDiagnostics,
    subscribeChangeFeedDiagnostics(listener: (diagnostics: ServerDatasourceChangeFeedDiagnostics) => void): () => void {
      diagnosticsListeners.add(listener)
      listener(getChangeFeedDiagnostics())
      return () => {
        diagnosticsListeners.delete(listener)
      }
    },
    applyRowSnapshots,
    get latestDatasetVersion() {
      return latestDatasetVersion
    },
    get lastSeenVersion() {
      return lastSeenVersion
    },
  }
}
