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
  normalizeDatasourceInvalidation,
  normalizeRowSnapshots,
  type ServerRowSnapshotLike,
} from "@affino/datagrid-server-client"

export interface AffinoDatasourceOptions {
  baseUrl: string
  tableId: string
  fetchImpl?: typeof fetch
}

type RecordLike = Record<string, unknown>
type AffinoCommitEditsRequest = Parameters<NonNullable<DataGridDataSource<unknown>["commitEdits"]>>[0]
type AffinoCommitEditsResult = Awaited<ReturnType<NonNullable<DataGridDataSource<unknown>["commitEdits"]>>>
type AffinoResolveFillBoundaryRequest = Parameters<NonNullable<DataGridDataSource<unknown>["resolveFillBoundary"]>>[0]
type AffinoResolveFillBoundaryResult = Awaited<ReturnType<NonNullable<DataGridDataSource<unknown>["resolveFillBoundary"]>>>
type AffinoFillOperationRequest = Parameters<NonNullable<DataGridDataSource<unknown>["commitFillOperation"]>>[0] & { signal?: AbortSignal }
type AffinoFillOperationResult = Awaited<ReturnType<NonNullable<DataGridDataSource<unknown>["commitFillOperation"]>>>
type AffinoFillUndoRequest = Parameters<NonNullable<DataGridDataSource<unknown>["undoFillOperation"]>>[0] & { signal?: AbortSignal }
type AffinoFillUndoResult = Awaited<ReturnType<NonNullable<DataGridDataSource<unknown>["undoFillOperation"]>>>
type AffinoFillRedoResult = Awaited<ReturnType<NonNullable<DataGridDataSource<unknown>["redoFillOperation"]>>>
type AffinoFillProjection = NonNullable<AffinoFillOperationRequest["projection"]>

type AffinoDatasourceExtras = {
  undoHistoryStack(): Promise<AffinoHistoryStackResult>
  redoHistoryStack(): Promise<AffinoHistoryStackResult>
  getHistoryStatus(): Promise<AffinoHistoryStatusResult>
}

type AffinoHistoryStackResult = {
  operationId?: string | null
  action?: "undo" | "redo"
  canUndo?: boolean
  canRedo?: boolean
  affectedRows?: number
  affectedCells?: number
  committed?: readonly {
    rowId: string | number
    columnId?: string | null
    revision?: string | number | null
  }[]
  committedRowIds?: readonly (string | number)[]
  rejected?: readonly {
    rowId: string | number
    columnId?: string | null
    reason?: string | null
  }[]
  revision?: string | number | null
  datasetVersion?: number | null
  invalidation?: unknown
  warnings?: readonly string[]
  rows?: readonly ServerRowSnapshotLike<unknown>[]
  latestUndoOperationId?: string | null
  latestRedoOperationId?: string | null
}

type AffinoHistoryStatusResult = {
  workspace_id?: string | null
  table_id?: string | null
  user_id?: string | null
  session_id?: string | null
  canUndo?: boolean
  canRedo?: boolean
  latestUndoOperationId?: string | null
  latestRedoOperationId?: string | null
  datasetVersion?: number | null
}

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function resolveAffinoEndpoint(tableId: string, suffix: string): string {
  const normalizedTableId = encodeURIComponent(tableId.trim())
  return `/api/${normalizedTableId}/${suffix}`
}

function resolveAffinoUrl(baseUrl: string | undefined, path: string): string {
  return baseUrl ? new URL(path, baseUrl).toString() : path
}

function normalizeAffinoPullRange(range: { start: number; end: number }): { startRow: number; endRow: number } {
  const start = Math.max(0, Math.trunc(range.start))
  const end = Math.max(start, Math.trunc(range.end) + 1)
  return { startRow: start, endRow: end }
}

function normalizeAffinoSortModel(
  sortModel: readonly { key: string; direction: "asc" | "desc" }[],
): readonly { colId: string; sort: "asc" | "desc" }[] {
  return sortModel.map(sortState => ({
    colId: sortState.key,
    sort: sortState.direction,
  }))
}

class AffinoDatasourceHttpError extends Error {
  readonly status: number
  readonly code: string | null
  readonly details: unknown

  constructor(message: string, status: number, code: string | null = null, details: unknown = null) {
    super(message)
    this.name = "AffinoDatasourceHttpError"
    this.status = status
    this.code = code
    this.details = details
  }
}

function toAbortError(): DOMException {
  return new DOMException("Aborted", "AbortError")
}

function isFetchAbortLikeError(caught: unknown): boolean {
  if (caught instanceof DOMException && caught.name === "AbortError") {
    return true
  }
  if (!(caught instanceof Error)) {
    return false
  }
  return caught.name === "AbortError" || caught.message.toLowerCase().includes("abort")
}

async function parseErrorResponse(response: Response): Promise<AffinoDatasourceHttpError> {
  const fallbackMessage = `${response.status} ${response.statusText}`.trim()
  let parsedBody: unknown = null
  let message = fallbackMessage
  let code: string | null = null

  const text = await response.text()
  if (text.length > 0) {
    try {
      parsedBody = JSON.parse(text) as unknown
      if (parsedBody && typeof parsedBody === "object") {
        const candidate = parsedBody as { message?: unknown; code?: unknown }
        if (typeof candidate.message === "string" && candidate.message.trim().length > 0) {
          message = candidate.message
        } else {
          message = text
        }
        if (typeof candidate.code === "string" && candidate.code.trim().length > 0) {
          code = candidate.code
        }
      } else {
        message = text
      }
    } catch {
      message = text
      parsedBody = text
    }
  }

  return new AffinoDatasourceHttpError(message, response.status, code, parsedBody ?? text)
}

async function postJson<TResponse>(
  fetchImpl: typeof fetch,
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<TResponse> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (caught) {
    if (signal?.aborted || isFetchAbortLikeError(caught)) {
      throw toAbortError()
    }
    throw caught
  }

  if (!response.ok) {
    try {
      throw await parseErrorResponse(response)
    } catch (caught) {
      if (signal?.aborted || isFetchAbortLikeError(caught)) {
        throw toAbortError()
      }
      throw caught
    }
  }

  try {
    return await response.json() as TResponse
  } catch (caught) {
    if (signal?.aborted || isFetchAbortLikeError(caught)) {
      throw toAbortError()
    }
    throw caught
  }
}

function serializeAffinoRange(range: { start: number; end: number }): { startRow: number; endRow: number; startColumn: number; endColumn: number } {
  const startRow = Math.max(0, Math.trunc(range.start))
  const endRow = Math.max(startRow, Math.trunc(range.end))
  return {
    startRow,
    endRow,
    startColumn: 0,
    endColumn: 0,
  }
}

function normalizeAffinoFillProjection(projection: AffinoFillProjection): AffinoFillProjection {
  return {
    sortModel: projection.sortModel,
    filterModel: projection.filterModel,
    groupBy: projection.groupBy,
    groupExpansion: projection.groupExpansion,
    treeData: projection.treeData,
    pivot: projection.pivot,
    pagination: projection.pagination,
  }
}

function mapCommitEditsRequestBody(request: AffinoCommitEditsRequest): {
  baseRevision?: string | null
  workspace_id?: string
  table_id?: string
  user_id?: string | null
  session_id?: string
  edits: Array<{
    rowId: string | number
    columnId: string
    value: unknown
    revision?: string | number | null
  }>
} {
  const scope = isRecord(request) ? (request as RecordLike).scope as RecordLike | undefined : undefined
  return {
    baseRevision: request.revision == null ? null : String(request.revision),
    ...(isRecord(scope) ? {
      workspace_id: typeof scope.workspace_id === "string" ? scope.workspace_id : undefined,
      table_id: typeof scope.table_id === "string" ? scope.table_id : undefined,
      user_id: typeof scope.user_id === "string" ? scope.user_id : null,
      session_id: typeof scope.session_id === "string" ? scope.session_id : undefined,
    } : {}),
    edits: request.edits.flatMap((edit: { rowId: string | number; data: RecordLike | null | undefined }) => {
      if (!edit || !isRecord(edit.data)) {
        return []
      }
      return Object.entries(edit.data).flatMap(([columnId, value]) => {
        if (typeof value === "undefined") {
          return []
        }
        return [{
          rowId: edit.rowId,
          columnId,
          value,
        }]
      })
    }),
  }
}

function normalizeCommitEditsResult(response: unknown): AffinoCommitEditsResult & {
  operationId?: string | null
  revision?: string | number | null
  datasetVersion?: number | null
  rows?: readonly ServerRowSnapshotLike<unknown>[]
  canUndo?: boolean
  canRedo?: boolean
  latestUndoOperationId?: string | null
  latestRedoOperationId?: string | null
} {
  if (!isRecord(response)) {
    return {
      committed: [],
      rejected: [],
    }
  }
  const committed = Array.isArray(response.committed)
    ? response.committed.flatMap(entry => {
        if (!isRecord(entry) || (typeof entry.rowId !== "string" && typeof entry.rowId !== "number")) {
          return []
        }
        return [{
          rowId: entry.rowId,
          revision: typeof entry.revision === "string" || typeof entry.revision === "number"
            ? entry.revision
            : undefined,
        }]
      })
    : []
  const rejected = Array.isArray(response.rejected)
    ? response.rejected.flatMap(entry => {
        if (!isRecord(entry) || (typeof entry.rowId !== "string" && typeof entry.rowId !== "number")) {
          return []
        }
        return [{
          rowId: entry.rowId,
          reason: typeof entry.reason === "string" && entry.reason.trim().length > 0
            ? entry.reason
            : "rejected",
        }]
      })
    : []

  return {
    operationId: typeof response.operationId === "string" ? response.operationId : null,
    committed,
    rejected,
    invalidation: normalizeDatasourceInvalidation(response.invalidation),
    revision: typeof response.revision === "string" || typeof response.revision === "number"
      ? response.revision
      : null,
    datasetVersion: typeof response.datasetVersion === "number" && Number.isFinite(response.datasetVersion)
      ? Math.max(0, Math.trunc(response.datasetVersion))
      : null,
    rows: Array.isArray(response.rows) ? response.rows as readonly ServerRowSnapshotLike<unknown>[] : [],
    canUndo: typeof response.canUndo === "boolean" ? response.canUndo : undefined,
    canRedo: typeof response.canRedo === "boolean" ? response.canRedo : undefined,
    latestUndoOperationId: typeof response.latestUndoOperationId === "string" ? response.latestUndoOperationId : null,
    latestRedoOperationId: typeof response.latestRedoOperationId === "string" ? response.latestRedoOperationId : null,
  }
}

function normalizeFillBoundaryRequestBody(
  request: AffinoResolveFillBoundaryRequest,
): Record<string, unknown> {
  return {
    direction: request.direction,
    baseRange: serializeAffinoRange(request.baseRange),
    fillColumns: request.fillColumns,
    referenceColumns: request.referenceColumns,
    projection: normalizeAffinoFillProjection(request.projection),
    startRowIndex: Math.max(0, Math.trunc(request.startRowIndex)),
    startColumnIndex: Math.max(0, Math.trunc(request.startColumnIndex)),
    limit: typeof request.limit === "number" && Number.isFinite(request.limit)
      ? Math.max(0, Math.trunc(request.limit))
      : request.limit ?? null,
  }
}

function normalizeFillCommitRequestBody(
  request: AffinoFillOperationRequest,
): Record<string, unknown> {
  const scope = isRecord(request) ? (request as RecordLike).scope as RecordLike | undefined : undefined
  return {
    operationId: request.operationId ?? null,
    ...(isRecord(scope) ? {
      workspace_id: typeof scope.workspace_id === "string" ? scope.workspace_id : undefined,
      table_id: typeof scope.table_id === "string" ? scope.table_id : undefined,
      user_id: typeof scope.user_id === "string" ? scope.user_id : null,
      session_id: typeof scope.session_id === "string" ? scope.session_id : undefined,
    } : {}),
    revision: request.revision ?? null,
    baseRevision: request.baseRevision ?? null,
    projectionHash: request.projectionHash ?? null,
    boundaryToken: request.boundaryToken ?? null,
    sourceRange: serializeAffinoRange(request.sourceRange),
    targetRange: serializeAffinoRange(request.targetRange),
    sourceRowIds: request.sourceRowIds ?? [],
    targetRowIds: request.targetRowIds ?? [],
    fillColumns: request.fillColumns,
    referenceColumns: request.referenceColumns,
    mode: request.mode,
    projection: normalizeAffinoFillProjection(request.projection),
    metadata: request.metadata ?? null,
  }
}

function normalizeFillUndoResult(response: unknown): AffinoFillUndoResult & {
  operationId?: string | null
  revision?: string | number | null
  rows?: readonly ServerRowSnapshotLike<unknown>[]
} {
  if (!isRecord(response)) {
    return {
      operationId: "",
      warnings: [],
    }
  }
  return {
    operationId: typeof response.operationId === "string" ? response.operationId : "",
    revision: typeof response.revision === "string" || typeof response.revision === "number"
      ? response.revision
      : null,
    invalidation: normalizeDatasourceInvalidation(response.invalidation),
    warnings: Array.isArray(response.warnings)
      ? response.warnings.filter((warning): warning is string => typeof warning === "string")
      : [],
    rows: Array.isArray(response.rows) ? response.rows as readonly ServerRowSnapshotLike<unknown>[] : [],
  }
}

function normalizeHistoryStackResult(response: unknown): AffinoHistoryStackResult {
  if (!isRecord(response)) {
    return {}
  }
  return {
    operationId: typeof response.operationId === "string" ? response.operationId : null,
    action: response.action === "undo" || response.action === "redo" ? response.action : undefined,
    canUndo: typeof response.canUndo === "boolean" ? response.canUndo : undefined,
    canRedo: typeof response.canRedo === "boolean" ? response.canRedo : undefined,
    affectedRows: typeof response.affectedRows === "number" && Number.isFinite(response.affectedRows)
      ? Math.max(0, Math.trunc(response.affectedRows))
      : undefined,
    affectedCells: typeof response.affectedCells === "number" && Number.isFinite(response.affectedCells)
      ? Math.max(0, Math.trunc(response.affectedCells))
      : undefined,
    committed: Array.isArray(response.committed)
      ? response.committed.flatMap(entry => {
          if (!isRecord(entry) || (typeof entry.rowId !== "string" && typeof entry.rowId !== "number")) {
            return []
          }
          return [{
            rowId: entry.rowId,
            columnId: typeof entry.columnId === "string" ? entry.columnId : null,
            revision: typeof entry.revision === "string" || typeof entry.revision === "number"
              ? entry.revision
              : null,
          }]
        })
      : undefined,
    committedRowIds: Array.isArray(response.committedRowIds)
      ? response.committedRowIds.filter((rowId): rowId is string | number => typeof rowId === "string" || typeof rowId === "number")
      : undefined,
    rejected: Array.isArray(response.rejected)
      ? response.rejected.flatMap(entry => {
          if (!isRecord(entry) || (typeof entry.rowId !== "string" && typeof entry.rowId !== "number")) {
            return []
          }
          return [{
            rowId: entry.rowId,
            columnId: typeof entry.columnId === "string" ? entry.columnId : null,
            reason: typeof entry.reason === "string" ? entry.reason : null,
          }]
        })
      : undefined,
    revision: typeof response.revision === "string" || typeof response.revision === "number"
      ? response.revision
      : undefined,
    datasetVersion: typeof response.datasetVersion === "number" && Number.isFinite(response.datasetVersion)
      ? Math.max(0, Math.trunc(response.datasetVersion))
      : undefined,
    invalidation: response.invalidation,
    warnings: Array.isArray(response.warnings)
      ? response.warnings.filter((warning): warning is string => typeof warning === "string")
      : undefined,
    rows: Array.isArray(response.rows) ? response.rows as readonly ServerRowSnapshotLike<unknown>[] : undefined,
    latestUndoOperationId: typeof response.latestUndoOperationId === "string" ? response.latestUndoOperationId : null,
    latestRedoOperationId: typeof response.latestRedoOperationId === "string" ? response.latestRedoOperationId : null,
  }
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
      undoOperation: () => "/api/history/undo",
      redoOperation: () => "/api/history/redo",
      historyStatus: "/api/history/status",
      changesSinceVersion: sinceVersion => `/api/changes?sinceVersion=${encodeURIComponent(String(sinceVersion))}`,
    },
    mapPullRequest: request => ({
      range: normalizeAffinoPullRange(request.range),
      sortModel: normalizeAffinoSortModel(request.sortModel),
      filterModel: request.filterModel,
    }),
    mapHistogramRequest: request => ({
      columnId: request.columnId,
      filterModel: request.filterModel,
    }),
    mapPullResponse: mapAffinoPullResponse,
    mapHistogramResponse: mapAffinoHistogramResponse,
  })
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const resolveWriteEndpoint = (path: string): string => resolveAffinoUrl(options.baseUrl, path)

  const datasource = {
    ...client,
    async commitEdits(request: AffinoCommitEditsRequest): Promise<AffinoCommitEditsResult> {
      const response = await postJson<unknown>(
        fetchImpl,
        resolveWriteEndpoint(resolveAffinoEndpoint(tableId, "edits")),
        mapCommitEditsRequestBody(request),
        request.signal,
      )
      const normalized = normalizeCommitEditsResult(response)
      return {
        committed: normalized.committed,
        rejected: normalized.rejected,
        invalidation: normalized.invalidation,
      }
    },
    async resolveFillBoundary(
      request: AffinoResolveFillBoundaryRequest,
    ): Promise<AffinoResolveFillBoundaryResult> {
      const response = await postJson<unknown>(
        fetchImpl,
        resolveWriteEndpoint(resolveAffinoEndpoint(tableId, "fill-boundary")),
        normalizeFillBoundaryRequestBody(request),
      )
      return isRecord(response)
        ? response as unknown as AffinoResolveFillBoundaryResult
        : {
            boundaryKind: "unresolved",
            endRowIndex: null,
          }
    },
    async commitFillOperation(request: AffinoFillOperationRequest): Promise<AffinoFillOperationResult> {
      const response = await postJson<unknown>(
        fetchImpl,
        resolveWriteEndpoint(resolveAffinoEndpoint(tableId, "fill/commit")),
        normalizeFillCommitRequestBody(request),
        request.signal,
      )
      const normalized = normalizeFillUndoResult(response)
      const result = isRecord(response) ? response as RecordLike : null
      return {
        operationId: normalized.operationId ?? request.operationId ?? "",
        affectedRowCount: typeof result?.affectedRowCount === "number" && Number.isFinite(result.affectedRowCount)
          ? Math.max(0, Math.trunc(result.affectedRowCount))
          : 0,
        affectedCellCount: typeof result?.affectedCellCount === "number" && Number.isFinite(result.affectedCellCount)
          ? Math.max(0, Math.trunc(result.affectedCellCount))
          : 0,
        invalidation: normalized.invalidation,
        warnings: normalized.warnings,
      }
    },
    async undoFillOperation(request: AffinoFillUndoRequest): Promise<AffinoFillUndoResult> {
      const response = await postJson<unknown>(
        fetchImpl,
        resolveWriteEndpoint(resolveAffinoEndpoint(tableId, `operations/${encodeURIComponent(request.operationId)}/undo`)),
        {},
        request.signal,
      )
      const normalized = normalizeFillUndoResult(response)
      return {
        operationId: normalized.operationId ?? request.operationId,
        revision: normalized.revision,
        invalidation: normalized.invalidation,
        warnings: normalized.warnings,
      }
    },
    async redoFillOperation(request: AffinoFillUndoRequest): Promise<AffinoFillRedoResult> {
      const response = await postJson<unknown>(
        fetchImpl,
        resolveWriteEndpoint(resolveAffinoEndpoint(tableId, `operations/${encodeURIComponent(request.operationId)}/redo`)),
        {},
        request.signal,
      )
      const normalized = normalizeFillUndoResult(response)
      return {
        operationId: normalized.operationId ?? request.operationId,
        revision: normalized.revision,
        invalidation: normalized.invalidation,
        warnings: normalized.warnings,
      }
    },
    async undoHistoryStack(): Promise<AffinoHistoryStackResult> {
      const response = await postJson<unknown>(
        fetchImpl,
        resolveWriteEndpoint("/api/history/undo"),
        {},
      )
      return normalizeHistoryStackResult(response)
    },
    async redoHistoryStack(): Promise<AffinoHistoryStackResult> {
      const response = await postJson<unknown>(
        fetchImpl,
        resolveWriteEndpoint("/api/history/redo"),
        {},
      )
      return normalizeHistoryStackResult(response)
    },
    async getHistoryStatus(): Promise<AffinoHistoryStatusResult> {
      const response = await postJson<unknown>(
        fetchImpl,
        resolveWriteEndpoint("/api/history/status"),
        {},
      )
      if (!isRecord(response)) {
        return {}
      }
      return {
        workspace_id: typeof response.workspace_id === "string" ? response.workspace_id : null,
        table_id: typeof response.table_id === "string" ? response.table_id : null,
        user_id: typeof response.user_id === "string" ? response.user_id : null,
        session_id: typeof response.session_id === "string" ? response.session_id : null,
        canUndo: typeof response.canUndo === "boolean" ? response.canUndo : undefined,
        canRedo: typeof response.canRedo === "boolean" ? response.canRedo : undefined,
        latestUndoOperationId: typeof response.latestUndoOperationId === "string" ? response.latestUndoOperationId : null,
        latestRedoOperationId: typeof response.latestRedoOperationId === "string" ? response.latestRedoOperationId : null,
        datasetVersion: typeof response.datasetVersion === "number" && Number.isFinite(response.datasetVersion)
          ? Math.max(0, Math.trunc(response.datasetVersion))
          : undefined,
      }
    },
  } as DataGridDataSource<TRow> & AffinoDatasourceExtras
  return datasource
}
