import {
  serializeColumnValueToToken,
  type DataGridAdvancedFilter,
  type DataGridAdvancedFilterExpression,
  type DataGridColumnHistogram,
  type DataGridColumnHistogramEntry,
  type DataGridColumnHistogramOptions,
  type DataGridColumnFilterSnapshotEntry,
  type DataGridColumnStyleFilter,
  type DataGridDataSource,
  type DataGridDataSourceColumnHistogramRequest,
  type DataGridDataSourcePullRequest,
  type DataGridDataSourceRowEntry,
  type DataGridFilterSnapshot,
  type DataGridGroupBySpec,
  type DataGridPaginationInput,
  type DataGridQuickFilterSnapshot,
  type DataGridSortState,
  type DataGridViewportRange,
} from "@affino/datagrid-core"
import {
  createServerDatasourceHttpClient,
  normalizeDatasetVersion,
  normalizeDatasourceInvalidation,
  normalizeRowSnapshots,
  type ServerDatasourceChangeFeedDiagnostics,
  type ServerRowSnapshotLike,
} from "@affino/datagrid-server-client"

export interface AffinoDatasourceOptions {
  baseUrl: string
  tableId: string
  fetchImpl?: typeof fetch
  headers?: HeadersInit | Record<string, string>
  historyScope?: AffinoDatasourceHistoryScope
  histogram?: AffinoDatasourceHistogramOptions
}

export interface AffinoDatasourceHistoryScope {
  workspaceId?: string
  userId?: string
  sessionId?: string
}

export interface AffinoDatasourceHistogramOptions {
  ignoreSelfFilter?: boolean
}

type RecordLike = Record<string, unknown>
export type DataGridServerJsonPrimitive = string | number | boolean | null
export type DataGridServerJsonValue =
  | DataGridServerJsonPrimitive
  | readonly DataGridServerJsonValue[]
  | { readonly [key: string]: DataGridServerJsonValue }

export interface DataGridServerRange {
  startRow: number
  endRow: number
}

export interface DataGridServerSort {
  colId: string
  sort: "asc" | "desc"
}

export interface DataGridServerQuickFilter {
  query: string
  columns?: readonly string[]
  mode?: "contains" | "tokens"
}

export type DataGridServerColumnFilter =
  | {
    kind: "valueSet"
    tokens: readonly string[]
  }
  | {
    kind: "styleValueSet"
    styleKey: string
    tokens: readonly string[]
  }
  | {
    kind: "predicate"
    operator: string
    value?: DataGridServerJsonValue
    value2?: DataGridServerJsonValue
    caseSensitive?: boolean
  }

export interface DataGridServerFilterModel {
  columnFilters?: Readonly<Record<string, DataGridServerColumnFilter>>
  columnStyleFilters?: Readonly<Record<string, DataGridServerColumnFilter>>
  advancedFilters?: Readonly<Record<string, DataGridServerJsonValue>>
  advancedExpression?: DataGridServerJsonValue | null
  quickFilter?: DataGridServerQuickFilter
}

export interface DataGridServerGroupBy {
  fields: readonly string[]
  expandedByDefault?: boolean
}

export interface DataGridServerPagination {
  pageSize: number
  currentPage: number
}

export interface DataGridServerQuery {
  range: DataGridServerRange
  sortModel?: readonly DataGridServerSort[]
  filterModel?: DataGridServerFilterModel | null
  groupBy?: DataGridServerGroupBy | null
  pagination?: DataGridServerPagination | null
}

export interface DataGridServerQueryCodecOptions {
  columnIdMap?: Readonly<Record<string, string>> | ((columnKey: string) => string | null | undefined)
  quickFilterModeFallback?: DataGridServerQuickFilter["mode"]
  legacyAdvancedFilters?: "preserve" | "drop"
}

function isJsonSafeValue(value: unknown): value is DataGridServerJsonValue {
  if (value === null) {
    return true
  }
  const valueType = typeof value
  if (valueType === "string" || valueType === "boolean") {
    return true
  }
  if (valueType === "number") {
    return Number.isFinite(value)
  }
  if (Array.isArray(value)) {
    return value.every(item => isJsonSafeValue(item))
  }
  if (!isRecord(value)) {
    return false
  }
  return Object.values(value).every(entry => isJsonSafeValue(entry))
}

function normalizeServerJsonValue(value: unknown): DataGridServerJsonValue | undefined {
  return isJsonSafeValue(value) ? value : undefined
}

function resolveServerColumnId(
  columnKey: string,
  columnIdMap: DataGridServerQueryCodecOptions["columnIdMap"] | undefined,
): string {
  if (typeof columnIdMap === "function") {
    return columnIdMap(columnKey)?.trim() || columnKey
  }
  return columnIdMap?.[columnKey]?.trim() || columnKey
}

function normalizeServerFilterTokens(tokens: readonly unknown[] | undefined): readonly string[] {
  if (!Array.isArray(tokens)) {
    return []
  }
  const normalizedTokens: string[] = []
  const seenTokens = new Set<string>()
  for (const token of tokens) {
    const normalizedToken = String(token ?? "").trim()
    if (!normalizedToken || seenTokens.has(normalizedToken)) {
      continue
    }
    seenTokens.add(normalizedToken)
    normalizedTokens.push(normalizedToken)
  }
  return Object.freeze(normalizedTokens)
}

function normalizeDataGridServerColumnFilterEntry(
  filter: DataGridColumnFilterSnapshotEntry | DataGridColumnStyleFilter | null | undefined,
): DataGridServerColumnFilter | null {
  if (!filter) {
    return null
  }
  if (filter.kind === "valueSet") {
    const tokens = normalizeServerFilterTokens(filter.tokens)
    return tokens.length > 0
      ? Object.freeze({ kind: "valueSet", tokens })
      : null
  }
  if (filter.kind === "styleValueSet") {
    const styleKey = typeof filter.styleKey === "string" ? filter.styleKey.trim() : ""
    const tokens = normalizeServerFilterTokens(filter.tokens)
    return styleKey && tokens.length > 0
      ? Object.freeze({ kind: "styleValueSet", styleKey, tokens })
      : null
  }
  if (filter.kind === "predicate") {
    const operator = typeof filter.operator === "string" ? filter.operator.trim() : ""
    if (!operator) {
      return null
    }
    if (operator === "isEmpty" || operator === "notEmpty" || operator === "isNull" || operator === "notNull") {
      return Object.freeze({
        kind: "predicate",
        operator,
        ...(filter.caseSensitive === true ? { caseSensitive: true } : {}),
      })
    }
    const value = normalizeServerJsonValue(filter.value)
    if (value === undefined) {
      return null
    }
    const value2 = normalizeServerJsonValue(filter.value2)
    return Object.freeze({
      kind: "predicate",
      operator,
      value,
      ...(value2 !== undefined ? { value2 } : {}),
      ...(filter.caseSensitive === true ? { caseSensitive: true } : {}),
    })
  }
  return null
}

export function normalizeDataGridServerColumnFilters(
  input: Readonly<Record<string, DataGridColumnFilterSnapshotEntry | DataGridColumnStyleFilter>> | null | undefined,
  options: Pick<DataGridServerQueryCodecOptions, "columnIdMap"> = {},
): Readonly<Record<string, DataGridServerColumnFilter>> | null {
  if (!input) {
    return null
  }
  const normalizedFilters: Record<string, DataGridServerColumnFilter> = {}
  for (const [columnKey, filter] of Object.entries(input)) {
    const normalizedColumnKey = columnKey.trim()
    if (!normalizedColumnKey) {
      continue
    }
    const normalizedFilter = normalizeDataGridServerColumnFilterEntry(filter)
    if (!normalizedFilter) {
      continue
    }
    normalizedFilters[resolveServerColumnId(normalizedColumnKey, options.columnIdMap)] = normalizedFilter
  }
  return Object.keys(normalizedFilters).length > 0
    ? Object.freeze(normalizedFilters)
    : null
}

export function normalizeDataGridServerAdvancedExpression(
  input: DataGridAdvancedFilterExpression | null | undefined,
): DataGridServerJsonValue | null {
  if (input === null) {
    return null
  }
  return normalizeServerJsonValue(input) ?? null
}

export function normalizeDataGridServerAdvancedFilters(
  input: Readonly<Record<string, DataGridAdvancedFilter>> | null | undefined,
  options: Pick<DataGridServerQueryCodecOptions, "columnIdMap" | "legacyAdvancedFilters"> = {},
): Readonly<Record<string, DataGridServerJsonValue>> | null {
  if (!input || options.legacyAdvancedFilters === "drop") {
    return null
  }
  const normalizedFilters: Record<string, DataGridServerJsonValue> = {}
  for (const [columnKey, filter] of Object.entries(input)) {
    const normalizedColumnKey = columnKey.trim()
    if (!normalizedColumnKey) {
      continue
    }
    const normalizedFilter = normalizeServerJsonValue(filter)
    if (normalizedFilter === undefined) {
      continue
    }
    normalizedFilters[resolveServerColumnId(normalizedColumnKey, options.columnIdMap)] = normalizedFilter
  }
  return Object.keys(normalizedFilters).length > 0
    ? Object.freeze(normalizedFilters)
    : null
}

function normalizeQuickFilterMode(
  mode: unknown,
  fallback: DataGridServerQuickFilter["mode"] | undefined,
): DataGridServerQuickFilter["mode"] {
  if (mode === "contains" || mode === "tokens") {
    return mode
  }
  return fallback === "tokens" ? "tokens" : "contains"
}

function normalizeQuickFilterColumns(columns: readonly unknown[] | undefined): readonly string[] {
  if (!Array.isArray(columns)) {
    return []
  }
  const normalizedColumns: string[] = []
  const seenColumns = new Set<string>()
  for (const column of columns) {
    const columnId = String(column ?? "").trim()
    if (!columnId || seenColumns.has(columnId)) {
      continue
    }
    seenColumns.add(columnId)
    normalizedColumns.push(columnId)
  }
  return Object.freeze(normalizedColumns)
}

export function normalizeDataGridServerQuickFilter(
  input: DataGridQuickFilterSnapshot | null | undefined,
  options: Pick<DataGridServerQueryCodecOptions, "quickFilterModeFallback"> = {},
): DataGridServerQuickFilter | null {
  const query = typeof input?.query === "string" ? input.query.trim() : ""
  if (!query) {
    return null
  }
  const columns = normalizeQuickFilterColumns(input?.columns)
  return Object.freeze({
    query,
    ...(columns.length > 0 ? { columns } : {}),
    mode: normalizeQuickFilterMode(input?.mode, options.quickFilterModeFallback),
  })
}

export function normalizeDataGridServerRange(
  range: DataGridViewportRange,
): DataGridServerRange {
  const start = Number.isFinite(range.start) ? Math.max(0, Math.trunc(range.start)) : 0
  const rawEnd = Number.isFinite(range.end) ? Math.trunc(range.end) + 1 : start
  return Object.freeze({
    startRow: start,
    endRow: Math.max(start, rawEnd),
  })
}

export function normalizeDataGridServerSortModel(
  input: readonly DataGridSortState[] | null | undefined,
  options: Pick<DataGridServerQueryCodecOptions, "columnIdMap"> = {},
): readonly DataGridServerSort[] | null {
  if (!Array.isArray(input)) {
    return null
  }
  const sortModel: DataGridServerSort[] = []
  for (const sortState of input) {
    const key = typeof sortState.key === "string" ? sortState.key.trim() : ""
    if (!key || (sortState.direction !== "asc" && sortState.direction !== "desc")) {
      continue
    }
    sortModel.push(Object.freeze({
      colId: resolveServerColumnId(key, options.columnIdMap),
      sort: sortState.direction,
    }))
  }
  return sortModel.length > 0
    ? Object.freeze(sortModel)
    : null
}

export function normalizeDataGridServerPagination(
  input: (Partial<DataGridPaginationInput> & { enabled?: boolean }) | null | undefined,
): DataGridServerPagination | null {
  if (!input || input.enabled === false || !Number.isFinite(input.pageSize) || !Number.isFinite(input.currentPage)) {
    return null
  }
  return Object.freeze({
    pageSize: Math.max(1, Math.trunc(input.pageSize as number)),
    currentPage: Math.max(0, Math.trunc(input.currentPage as number)),
  })
}

export function normalizeDataGridServerGroupBy(
  input: DataGridGroupBySpec | null | undefined,
  options: Pick<DataGridServerQueryCodecOptions, "columnIdMap"> = {},
): DataGridServerGroupBy | null {
  if (!input || !Array.isArray(input.fields)) {
    return null
  }
  const fields: string[] = []
  const seenFields = new Set<string>()
  for (const field of input.fields) {
    const normalizedField = typeof field === "string" ? field.trim() : ""
    if (!normalizedField) {
      continue
    }
    const columnId = resolveServerColumnId(normalizedField, options.columnIdMap)
    if (seenFields.has(columnId)) {
      continue
    }
    seenFields.add(columnId)
    fields.push(columnId)
  }
  return fields.length > 0
    ? Object.freeze({
      fields: Object.freeze(fields),
      ...(typeof input.expandedByDefault === "boolean" ? { expandedByDefault: input.expandedByDefault } : {}),
    })
    : null
}

function normalizeDataGridServerFilterModel(
  input: DataGridFilterSnapshot | null | undefined,
  options: DataGridServerQueryCodecOptions,
): DataGridServerFilterModel | null {
  if (!input) {
    return null
  }
  const columnFilters = normalizeDataGridServerColumnFilters(input.columnFilters, options)
  const columnStyleFilters = normalizeDataGridServerColumnFilters(input.columnStyleFilters, options)
  const advancedFilters = normalizeDataGridServerAdvancedFilters(input.advancedFilters, options)
  const advancedExpression = Object.prototype.hasOwnProperty.call(input, "advancedExpression")
    ? normalizeDataGridServerAdvancedExpression(input.advancedExpression)
    : undefined
  const quickFilter = normalizeDataGridServerQuickFilter(input.quickFilter, options)
  const filterModel: DataGridServerFilterModel = {
    ...(columnFilters ? { columnFilters } : {}),
    ...(columnStyleFilters ? { columnStyleFilters } : {}),
    ...(advancedFilters ? { advancedFilters } : {}),
    ...(advancedExpression !== undefined ? { advancedExpression } : {}),
    ...(quickFilter ? { quickFilter } : {}),
  }
  return Object.keys(filterModel).length > 0
    ? Object.freeze(filterModel)
    : null
}

export function normalizeDataGridServerQuery(
  request: DataGridDataSourcePullRequest,
  options: DataGridServerQueryCodecOptions = {},
): DataGridServerQuery {
  const sortModel = normalizeDataGridServerSortModel(request.sortModel, options)
  const filterModel = normalizeDataGridServerFilterModel(request.filterModel, options)
  const groupBy = normalizeDataGridServerGroupBy(request.groupBy, options)
  const pagination = normalizeDataGridServerPagination(request.pagination.snapshot)
  return Object.freeze({
    range: normalizeDataGridServerRange(request.range),
    ...(sortModel ? { sortModel } : {}),
    filterModel,
    ...(groupBy ? { groupBy } : {}),
    ...(pagination ? { pagination } : {}),
  })
}

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

export interface AffinoDatasourceExtras<TRow> {
  undoHistoryStack(): Promise<AffinoHistoryStackResult<TRow>>
  redoHistoryStack(): Promise<AffinoHistoryStackResult<TRow>>
  getHistoryStatus(): Promise<AffinoHistoryStatusResult>
}

export interface AffinoDatasource<TRow> extends DataGridDataSource<TRow>, AffinoDatasourceExtras<TRow> {
  startChangeFeedPolling(options?: { intervalMs?: number }): void
  stopChangeFeedPolling(): void
  getChangeFeedDiagnostics(): ServerDatasourceChangeFeedDiagnostics
  subscribeChangeFeedDiagnostics(listener: (diagnostics: ServerDatasourceChangeFeedDiagnostics) => void): () => void
  applyRowSnapshots(rows: readonly ServerRowSnapshotLike<TRow>[] | readonly DataGridDataSourceRowEntry<TRow>[]): boolean
  getChangesSinceVersion(request: { sinceVersion: number; signal?: AbortSignal }): Promise<unknown>
  readonly latestDatasetVersion: number | null
  readonly lastSeenVersion: number | null
}

export type AffinoHistoryStackResult<TRow> = {
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
  rows?: readonly ServerRowSnapshotLike<TRow>[]
  latestUndoOperationId?: string | null
  latestRedoOperationId?: string | null
}

export type AffinoHistoryStatusResult = {
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

function createAffinoFetchImpl(fetchImpl: typeof fetch, headers?: HeadersInit | Record<string, string>): typeof fetch {
  if (!headers) {
    return fetchImpl
  }
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const mergedHeaders = new Headers(headers)
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        mergedHeaders.set(key, value)
      })
    }
    return fetchImpl(input, {
      ...init,
      headers: mergedHeaders,
    })
  }) as typeof fetch
}

function resolveAffinoHistoryScopeBody(
  tableId: string,
  scope?: AffinoDatasourceHistoryScope,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    table_id: tableId,
  }
  if (typeof scope?.workspaceId === "string") {
    body.workspace_id = scope.workspaceId
  }
  if (typeof scope?.userId === "string") {
    body.user_id = scope.userId
  }
  if (typeof scope?.sessionId === "string") {
    body.session_id = scope.sessionId
  }
  return body
}

function normalizeAffinoHistogramOptions(
  request: DataGridDataSourceColumnHistogramRequest,
  defaultOptions: DataGridColumnHistogramOptions | undefined,
): Record<string, unknown> {
  const histogramOptions = request.options
  const ignoreSelfFilter = histogramOptions.ignoreSelfFilter ?? defaultOptions?.ignoreSelfFilter
  const search = typeof histogramOptions.search === "string" ? histogramOptions.search.trim() : ""
  const body: Record<string, unknown> = {
    ...(ignoreSelfFilter === undefined ? {} : { ignoreSelfFilter }),
  }
  if (search.length > 0) {
    body.search = search
  }
  if (histogramOptions.orderBy === "countDesc" || histogramOptions.orderBy === "valueAsc") {
    body.orderBy = histogramOptions.orderBy
  }
  if (typeof histogramOptions.limit === "number" && Number.isFinite(histogramOptions.limit)) {
    body.limit = Math.max(0, Math.trunc(histogramOptions.limit))
  }
  return body
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

function normalizeHistoryStackResult<TRow>(response: unknown): AffinoHistoryStackResult<TRow> {
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
    rows: Array.isArray(response.rows) ? response.rows as readonly ServerRowSnapshotLike<TRow>[] : undefined,
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
): AffinoDatasource<TRow> {
  const tableId = options.tableId.trim()
  const fetchImpl = createAffinoFetchImpl(options.fetchImpl ?? globalThis.fetch.bind(globalThis), options.headers)
  const client = createServerDatasourceHttpClient<TRow>({
    baseUrl: options.baseUrl,
    fetchImpl,
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
      options: normalizeAffinoHistogramOptions(request, options.histogram),
    }),
    mapPullResponse: mapAffinoPullResponse,
    mapHistogramResponse: mapAffinoHistogramResponse,
  })
  const resolveWriteEndpoint = (path: string): string => resolveAffinoUrl(options.baseUrl, path)
  const historyScopeBody = resolveAffinoHistoryScopeBody(tableId, options.historyScope)

  const datasource = {
    ...client,
    async commitEdits(request: AffinoCommitEditsRequest): Promise<AffinoCommitEditsResult> {
      const response = await postJson<unknown>(
        fetchImpl,
        resolveWriteEndpoint(resolveAffinoEndpoint(tableId, "edits")),
        {
          ...mapCommitEditsRequestBody(request),
          ...historyScopeBody,
        },
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
        {
          ...normalizeFillCommitRequestBody(request),
          ...historyScopeBody,
        },
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
    async undoHistoryStack(): Promise<AffinoHistoryStackResult<TRow>> {
      const response = await postJson<unknown>(
        fetchImpl,
        resolveWriteEndpoint("/api/history/undo"),
        historyScopeBody,
      )
      return normalizeHistoryStackResult<TRow>(response)
    },
    async redoHistoryStack(): Promise<AffinoHistoryStackResult<TRow>> {
      const response = await postJson<unknown>(
        fetchImpl,
        resolveWriteEndpoint("/api/history/redo"),
        historyScopeBody,
      )
      return normalizeHistoryStackResult<TRow>(response)
    },
    async getHistoryStatus(): Promise<AffinoHistoryStatusResult> {
      const response = await postJson<unknown>(
        fetchImpl,
        resolveWriteEndpoint("/api/history/status"),
        historyScopeBody,
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
  } as AffinoDatasource<TRow>
  return datasource
}
