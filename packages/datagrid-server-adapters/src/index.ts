import {
  serializeColumnValueToToken,
  type DataGridColumnHistogram,
  type DataGridColumnHistogramEntry,
  type DataGridDataSource,
  type DataGridDataSourceRowEntry,
} from "@affino/datagrid-core"
import {
  createServerDatasourceHttpClient,
  normalizeDatasetVersion,
  normalizeRowSnapshots,
  type ServerRowSnapshotLike,
} from "@affino/datagrid-server-client"

export interface AffinoDatasourceOptions {
  baseUrl: string
  tableId: string
  fetchImpl?: typeof fetch
}

type RecordLike = Record<string, unknown>

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function resolveAffinoEndpoint(tableId: string, suffix: string): string {
  const normalizedTableId = encodeURIComponent(tableId.trim())
  return `/api/${normalizedTableId}/${suffix}`
}

function mapAffinoPullResponse<TRow>(response: unknown): {
  rows: readonly DataGridDataSourceRowEntry<TRow>[]
  total: number
  revision?: string | number | null
  datasetVersion?: number | null
} {
  const record = isRecord(response) ? response : null
  const rows = normalizeRowSnapshots<TRow>(
    Array.isArray(record?.rows) ? (record.rows as readonly ServerRowSnapshotLike<TRow>[]) : null,
  ) ?? []
  const total = record && typeof record.total === "number" && Number.isFinite(record.total)
    ? Math.max(0, Math.trunc(record.total))
    : rows.length
  const revision = record && (typeof record.revision === "string" || typeof record.revision === "number")
    ? record.revision
    : null
  return {
    rows,
    total,
    revision,
    datasetVersion: record ? normalizeDatasetVersion(record.datasetVersion) : null,
  }
}

function mapAffinoHistogramResponse(response: unknown): DataGridColumnHistogram {
  if (!isRecord(response) || !Array.isArray(response.entries)) {
    return []
  }

  return response.entries.flatMap(entry => {
    if (!isRecord(entry) || typeof entry.count !== "number" || !Number.isFinite(entry.count)) {
      return []
    }
    const value = entry.value
    const token = serializeColumnValueToToken(value)
    const histogramEntry: DataGridColumnHistogramEntry = {
      token,
      value,
      text: typeof entry.text === "string" && entry.text.trim().length > 0 ? entry.text : token,
      count: Math.max(0, Math.trunc(entry.count)),
    }
    return [histogramEntry]
  })
}

export function createAffinoDatasource<TRow>(
  options: AffinoDatasourceOptions,
): DataGridDataSource<TRow> {
  const tableId = options.tableId.trim()
  const client = createServerDatasourceHttpClient<TRow>({
    baseUrl: options.baseUrl,
    fetchImpl: options.fetchImpl,
    endpoints: {
      pull: resolveAffinoEndpoint(tableId, "pull"),
      histogram: resolveAffinoEndpoint(tableId, "histogram"),
      commitEdits: resolveAffinoEndpoint(tableId, "edits"),
      resolveFillBoundary: resolveAffinoEndpoint(tableId, "fill-boundary"),
      commitFillOperation: resolveAffinoEndpoint(tableId, "fill/commit"),
      undoOperation: operationId => resolveAffinoEndpoint(tableId, `operations/${encodeURIComponent(operationId)}/undo`),
      redoOperation: operationId => resolveAffinoEndpoint(tableId, `operations/${encodeURIComponent(operationId)}/redo`),
      historyStatus: resolveAffinoEndpoint(tableId, "history/status"),
      changesSinceVersion: sinceVersion => resolveAffinoEndpoint(tableId, `changes?sinceVersion=${encodeURIComponent(String(sinceVersion))}`),
    },
    mapPullRequest: request => ({
      range: {
        startRow: Math.max(0, Math.trunc(request.range.start)),
        endRow: Math.max(0, Math.trunc(request.range.end)),
      },
      sortModel: request.sortModel,
      filterModel: request.filterModel,
    }),
    mapHistogramRequest: request => ({
      columnId: request.columnId,
      filterModel: request.filterModel,
    }),
    mapPullResponse: mapAffinoPullResponse,
    mapHistogramResponse: mapAffinoHistogramResponse,
  })

  return client as DataGridDataSource<TRow>
}
