import {
  type DataGridColumnFilter,
  serializeColumnValueToToken,
  type DataGridColumnHistogram,
  type DataGridColumnHistogramEntry,
  type DataGridDataSourceColumnHistogramRequest,
  type DataGridDataSource,
  type DataGridDataSourceInvalidation,
  type DataGridDataSourcePullRequest,
  type DataGridDataSourcePullResult,
  type DataGridDataSourcePushEvent,
  type DataGridDataSourcePushListener,
  type DataGridFilterSnapshot,
} from "@affino/datagrid-vue"

import {
  SERVER_DEMO_REGIONS,
  SERVER_DEMO_SEGMENTS,
  SERVER_DEMO_STATUSES,
  type ServerDemoChangeFeedChange,
  type ServerDemoChangeFeedResponse,
  type ServerDemoRow,
  type ServerDemoChangeFeedRequest,
  type ServerDemoChangeFeedDiagnostics,
  type ServerDemoDataSourceRowEntry,
} from "./types"
import {
  createChangeFeedPoller,
  type ServerChangeEventLike,
  normalizeDatasetVersion,
  normalizeDatasourceInvalidation,
  mapServerChangeEvent,
  normalizeRowSnapshots,
  type ServerRowSnapshotLike,
} from "@affino/datagrid-server-client"
import type { ServerDemoHistoryScope } from "./serverDemoHistoryScope"
import {
  normalizeServerDemoHistoryState,
  type ServerDemoHistoryState,
} from "./serverDemoHistoryState"

export interface ServerDemoDatasourceHttpAdapterOptions {
  baseUrl?: string
  fetchImpl?: typeof fetch
  historyScope?: ServerDemoHistoryScope
}

export interface ServerDemoDatasourceHttpAdapterChangeFeedOptions {
  intervalMs?: number
}

export class ServerDemoHttpError extends Error {
  readonly status: number
  readonly code: string | null
  readonly details: unknown

  constructor(message: string, status: number, code: string | null = null, details: unknown = null) {
    super(message)
    this.name = "ServerDemoHttpError"
    this.status = status
    this.code = code
    this.details = details
  }
}

type ServerDemoPullResponse = {
  rows: readonly ServerDemoRow[]
  total: number
  revision?: string | null
  datasetVersion?: number | null
}

type ServerDemoHistogramResponse = {
  columnId: string
  entries: readonly {
    value: unknown
    count: number
  }[]
}

type ServerDemoMutationCellInvalidation = {
  rowId: string
  columnId: string
}

type ServerDemoMutationRangeInvalidation = {
  startRow: number
  endRow: number
  startColumn?: string | null
  endColumn?: string | null
}

type ServerDemoMutationInvalidation = {
  type: "cell" | "range" | "row" | "dataset"
  cells?: readonly ServerDemoMutationCellInvalidation[]
  rows?: readonly string[]
  range?: ServerDemoMutationRangeInvalidation | null
}

type ServerDemoFillBoundaryResponse = {
  endRowIndex: number | null
  endRowId?: string | number | null
  boundaryKind: "data-end" | "gap" | "cache-boundary" | "projection-end" | "unresolved"
  scannedRowCount?: number
  truncated?: boolean
  revision?: string | null
  projectionHash?: string | null
  boundaryToken?: string | null
}

type ServerDemoFillCommitResponse = {
  operationId?: string | null
  affectedRowCount: number
  affectedCellCount?: number
  affectedRows?: number
  affectedCells?: number
  revision?: string | number | null
  datasetVersion?: number | null
  canUndo?: boolean
  canRedo?: boolean
  latestUndoOperationId?: string | null
  latestRedoOperationId?: string | null
  invalidation?: DataGridDataSourceInvalidation | null
  serverInvalidation?: ServerDemoMutationInvalidation | null
  warnings?: readonly string[]
  rows?: readonly ServerDemoRow[]
}

type ServerDemoFillHistoryResponse = {
  operationId?: string | null
  revision?: string | number | null
  datasetVersion?: number | null
  invalidation?: DataGridDataSourceInvalidation | null
  serverInvalidation?: ServerDemoMutationInvalidation | null
  warnings?: readonly string[]
  affectedRows?: number
  affectedCells?: number
  canUndo?: boolean
  canRedo?: boolean
  latestUndoOperationId?: string | null
  latestRedoOperationId?: string | null
  rows?: readonly ServerDemoRow[]
}

type ServerDemoCommitEditsResponse = {
  operationId?: string | null
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
  affectedRows?: number
  affectedCells?: number
  canUndo?: boolean
  canRedo?: boolean
  latestUndoOperationId?: string | null
  latestRedoOperationId?: string | null
  invalidation?: ServerDemoMutationInvalidation | null
  rows?: readonly ServerDemoRow[]
}

type ServerDemoHistoryStackRequestBody = ServerDemoHistoryScope

type ServerDemoHistoryStackResponse = {
  operationId?: string | null
  action: "undo" | "redo"
  canUndo: boolean
  canRedo: boolean
  affectedRows: number
  affectedCells: number
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
  invalidation?: DataGridDataSourceInvalidation | null
  serverInvalidation?: ServerDemoMutationInvalidation | null
  latestUndoOperationId?: string | null
  latestRedoOperationId?: string | null
  rows?: readonly ServerDemoRow[]
}

type ServerDemoHistoryStatusResponse = {
  workspace_id: string
  table_id: string
  user_id: string | null
  session_id: string | null
  canUndo: boolean
  canRedo: boolean
  latestUndoOperationId: string | null
  latestRedoOperationId: string | null
  datasetVersion?: number | null
}

type ServerDemoCommitEditsResultWithOperation = ServerDemoCommitEditsResult & {
  operationId?: string | null
  canUndo?: boolean
  canRedo?: boolean
  latestUndoOperationId?: string | null
  latestRedoOperationId?: string | null
  affectedRows?: number
  affectedCells?: number
  datasetVersion?: number | null
  serverInvalidation?: ServerDemoMutationInvalidation | null
  rows?: readonly ServerDemoRow[]
}

type ServerDemoServerOperationResult = ServerDemoCommitEditsResultWithOperation & {
  revision?: string | number | null
  datasetVersion?: number | null
  serverInvalidation?: ServerDemoMutationInvalidation | null
}

type ServerDemoCommitEditsRequest = Parameters<NonNullable<DataGridDataSource<ServerDemoRow>["commitEdits"]>>[0]
type ServerDemoCommitEditsResult = Awaited<ReturnType<NonNullable<DataGridDataSource<ServerDemoRow>["commitEdits"]>>>
type ServerDemoCommittedRowResult = NonNullable<ServerDemoCommitEditsResult["committed"]>[number]
type ServerDemoFillOperationRequest = Parameters<NonNullable<DataGridDataSource<ServerDemoRow>["commitFillOperation"]>>[0]
type ServerDemoFillBoundaryRequest = Parameters<NonNullable<DataGridDataSource<ServerDemoRow>["resolveFillBoundary"]>>[0]
type ServerDemoFillUndoRequest = Parameters<NonNullable<DataGridDataSource<ServerDemoRow>["undoFillOperation"]>>[0]
type ServerDemoFillRedoRequest = Parameters<NonNullable<DataGridDataSource<ServerDemoRow>["redoFillOperation"]>>[0]
type ServerDemoFillOperationResult = Awaited<ReturnType<NonNullable<DataGridDataSource<ServerDemoRow>["commitFillOperation"]>>>
type ServerDemoFillUndoResult = Awaited<ReturnType<NonNullable<DataGridDataSource<ServerDemoRow>["undoFillOperation"]>>> & {
  rows?: readonly ServerDemoRow[]
}
type ServerDemoFillRedoResult = Awaited<ReturnType<NonNullable<DataGridDataSource<ServerDemoRow>["redoFillOperation"]>>> & {
  rows?: readonly ServerDemoRow[]
}
type ServerDemoCommitEditsRequestWithScope = ServerDemoCommitEditsRequest & { scope?: ServerDemoHistoryScope }
type ServerDemoFillOperationRequestWithScope = ServerDemoFillOperationRequest & { scope?: ServerDemoHistoryScope }

export type ServerDemoHttpDatasource = ReturnType<typeof createServerDemoDatasourceHttpAdapter>

type BackendFilterModel = Record<string, unknown>

const ENUM_FILTER_VALUES: Record<string, readonly string[]> = {
  region: SERVER_DEMO_REGIONS,
  segment: SERVER_DEMO_SEGMENTS,
  status: SERVER_DEMO_STATUSES,
}

let pageLifecycleTeardownStarted = false

function markPageLifecycleTeardownStarted(): void {
  pageLifecycleTeardownStarted = true
}

function resetPageLifecycleTeardownStarted(): void {
  pageLifecycleTeardownStarted = false
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("beforeunload", markPageLifecycleTeardownStarted, { capture: true })
  window.addEventListener("pagehide", markPageLifecycleTeardownStarted, { capture: true })
  window.addEventListener("pageshow", resetPageLifecycleTeardownStarted, { capture: true })
}

function resolveEndpoint(baseUrl: string | undefined, path: string): string {
  if (!baseUrl) {
    return path
  }
  return new URL(path, baseUrl).toString()
}

function decodeColumnValueToken(token: string): unknown {
  if (token.startsWith("string:")) {
    return token.slice("string:".length)
  }
  if (token.startsWith("number:")) {
    const value = Number(token.slice("number:".length))
    return Number.isFinite(value) ? value : token
  }
  if (token === "null") {
    return null
  }
  if (token === "boolean:true") {
    return true
  }
  if (token === "boolean:false") {
    return false
  }
  if (token.startsWith("date:")) {
    return token.slice("date:".length)
  }
  return token
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function normalizeFilterValue(value: unknown): unknown | null {
  if (value == null) {
    return null
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return null
    }
    const decoded = decodeColumnValueToken(trimmed)
    if (typeof decoded === "string" && decoded.trim().length === 0) {
      return null
    }
    return decoded
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }
  return value
}

function normalizeFilterValueForColumn(columnId: string, value: unknown): unknown | null {
  const normalized = normalizeFilterValue(value)
  if (typeof normalized !== "string") {
    return normalized
  }

  const canonicalValues = ENUM_FILTER_VALUES[columnId]
  if (!canonicalValues) {
    return normalized
  }

  const matched = canonicalValues.find(candidate => candidate.toLowerCase() === normalized.toLowerCase())
  return matched ?? normalized
}

function normalizeFilterValues(columnId: string, values: readonly unknown[]): unknown[] {
  const normalized: unknown[] = []
  for (const value of values) {
    const nextValue = normalizeFilterValueForColumn(columnId, value)
    if (nextValue !== null) {
      normalized.push(nextValue)
    }
  }
  return normalized
}

function normalizeRange(range: DataGridDataSourcePullRequest["range"]): { startRow: number; endRow: number } {
  const start = Math.max(0, Math.trunc(range.start))
  const end = Math.max(start, Math.trunc(range.end) + 1)
  return { startRow: start, endRow: end }
}

function normalizeSortModel(request: DataGridDataSourcePullRequest): readonly { colId: string; sort: "asc" | "desc" }[] {
  return request.sortModel.map(sortState => ({
    colId: sortState.key,
    sort: sortState.direction,
  }))
}

function setBackendFilter(
  backendFilterModel: BackendFilterModel,
  columnId: string,
  value: unknown,
): void {
  if (value != null) {
    backendFilterModel[columnId] = value
  }
}

function createValuePredicateFilter(operator: string, value: unknown, value2?: unknown): unknown | null {
  const filterValue = normalizeFilterValue(value)
  if (operator === "between" || operator === "range") {
    const filterToValue = normalizeFilterValue(value2)
    if (filterValue !== null && filterToValue !== null) {
      return {
        type: "inRange",
        filter: filterValue,
        filterTo: filterToValue,
      }
    }
    return null
  }
  if (filterValue === null) {
    return null
  }
  switch (operator) {
    case "equals":
    case "eq":
    case "is":
      return { type: "equals", filter: filterValue }
    case "gt":
    case ">":
      return { type: "greaterThan", filter: filterValue }
    case "gte":
    case ">=":
      return { type: "greaterThanOrEqual", filter: filterValue }
    case "lt":
    case "<":
      return { type: "lessThan", filter: filterValue }
    case "lte":
    case "<=":
      return { type: "lessThanOrEqual", filter: filterValue }
    default:
      return null
  }
}

function createBackendFilterForPredicate(
  columnId: string,
  operator: string,
  value: unknown,
  value2?: unknown,
): unknown | null {
  const normalizedOperator = operator.trim().toLowerCase()
  if (columnId === "value") {
    return createValuePredicateFilter(normalizedOperator, value, value2)
  }

  if (normalizedOperator === "contains" && columnId === "name") {
    const filterValue = normalizeFilterValueForColumn(columnId, value)
    return filterValue !== null ? { type: "contains", filter: filterValue } : null
  }

  if (
    normalizedOperator === "equals"
    || normalizedOperator === "eq"
    || normalizedOperator === "is"
    || normalizedOperator === "in"
  ) {
    const values = Array.isArray(value)
      ? normalizeFilterValues(columnId, value)
      : normalizeFilterValues(columnId, [value])
    if (values.length === 1) {
      return { type: "equals", filter: values[0] }
    }
    if (values.length > 1) {
      return { type: "equals", values }
    }
  }

  return null
}

function flattenFilterModel(filterModel: DataGridFilterSnapshot | null, omitColumnId?: string): BackendFilterModel | null {
  if (!filterModel) {
    return null
  }

  const backendFilterModel: BackendFilterModel = {}
  const columnFilters = filterModel.columnFilters ?? {}

  for (const [columnId, filterEntry] of Object.entries(columnFilters) as Array<[string, DataGridColumnFilter]>) {
    if (columnId === omitColumnId) {
      continue
    }

    if (Array.isArray(filterEntry)) {
      const values = normalizeFilterValues(columnId, filterEntry)
      if (values.length === 1) {
        backendFilterModel[columnId] = {
          type: "equals",
          filter: values[0],
        }
      } else if (values.length > 1) {
        backendFilterModel[columnId] = {
          type: "equals",
          values,
        }
      }
      continue
    }

    if (filterEntry.kind === "valueSet") {
      const values = normalizeFilterValues(columnId, filterEntry.tokens ?? [])
      if (values.length === 1) {
        backendFilterModel[columnId] = {
          type: "equals",
          filter: values[0],
        }
      } else if (values.length > 1) {
        backendFilterModel[columnId] = {
          type: "equals",
          values,
        }
      }
      continue
    }

    if (filterEntry.kind !== "predicate") {
      continue
    }

    const operator = filterEntry.operator
    switch (operator) {
      case "contains":
      case "equals":
      case "gt":
      case "gte":
      case "lt":
      case "lte":
      case "between":
        setBackendFilter(
          backendFilterModel,
          columnId,
          createBackendFilterForPredicate(columnId, operator, filterEntry.value, filterEntry.value2),
        )
        break
      case "isEmpty":
      case "isNull":
      case "notEmpty":
      case "notNull":
        break
      default:
        break
    }
  }

  if (filterModel.advancedExpression != null) {
    backendFilterModel.advancedExpression = filterModel.advancedExpression
  }
  if (filterModel.advancedFilters != null) {
    const clonedAdvancedFilters: Record<string, unknown> = {}
    for (const [columnId, advancedFilter] of Object.entries(filterModel.advancedFilters)) {
      if (columnId === omitColumnId) {
        continue
      }
      if (!advancedFilter || typeof advancedFilter !== "object") {
        continue
      }
      const clonedAdvancedFilter = advancedFilter as unknown as Record<string, unknown>
      const clauses = Array.isArray((advancedFilter as { clauses?: unknown }).clauses)
        ? ((advancedFilter as { clauses?: readonly unknown[] }).clauses ?? []).map(clause => (
            clause && typeof clause === "object" ? { ...(clause as Record<string, unknown>) } : clause
          ))
        : []
      clonedAdvancedFilters[columnId] = {
        ...clonedAdvancedFilter,
        clauses,
      }
    }
    if (Object.keys(clonedAdvancedFilters).length > 0) {
      backendFilterModel.advancedFilters = clonedAdvancedFilters
    }
  }

  if (Object.keys(backendFilterModel).length === 0) {
    return null
  }

  return backendFilterModel
}

function toHistogramEntries(response: ServerDemoHistogramResponse): DataGridColumnHistogram {
  return response.entries.map((entry): DataGridColumnHistogramEntry => {
    const token = serializeColumnValueToToken(entry.value)
    return {
      token,
      value: entry.value,
      text: token,
      count: entry.count,
    }
  })
}

async function parseErrorResponse(response: Response): Promise<ServerDemoHttpError> {
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

  return new ServerDemoHttpError(message, response.status, code, parsedBody ?? text)
}

function toAbortError(): DOMException {
  return new DOMException("Aborted", "AbortError")
}

function isFetchTransportFailure(caught: unknown): boolean {
  if (caught instanceof TypeError) {
    return true
  }
  if (!caught || typeof caught !== "object") {
    return false
  }
  const candidate = caught as { name?: unknown; message?: unknown }
  if (candidate.name === "TypeError") {
    return true
  }
  if (typeof candidate.message !== "string") {
    return false
  }
  const message = candidate.message.toLowerCase()
  return message.includes("failed to fetch")
    || message.includes("networkerror")
    || message.includes("load failed")
}

function isFetchAbortLikeError(caught: unknown): boolean {
  if (caught instanceof DOMException && caught.name === "AbortError") {
    return true
  }
  if (pageLifecycleTeardownStarted && isFetchTransportFailure(caught)) {
    return true
  }
  if (!(caught instanceof Error)) {
    return false
  }
  return caught.name === "AbortError" || caught.message.toLowerCase().includes("abort")
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
    return (await response.json()) as TResponse
  } catch (caught) {
    if (signal?.aborted || isFetchAbortLikeError(caught)) {
      throw toAbortError()
    }
    throw caught
  }
}

async function getJson<TResponse>(
  fetchImpl: typeof fetch,
  url: string,
  signal?: AbortSignal,
): Promise<TResponse> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: "GET",
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
    return (await response.json()) as TResponse
  } catch (caught) {
    if (signal?.aborted || isFetchAbortLikeError(caught)) {
      throw toAbortError()
    }
    throw caught
  }
}

function getHistogramResponseKey(entries: readonly DataGridColumnHistogramEntry[]): DataGridColumnHistogram {
  return entries
}

export function normalizeServerDemoMutationInvalidation(value: unknown): ServerDemoMutationInvalidation | null {
  if (!isRecord(value)) {
    return null
  }
  const type = typeof value.type === "string" ? value.type.trim().toLowerCase() : typeof value.kind === "string" ? value.kind.trim().toLowerCase() : ""

  if (type === "cell") {
    const cells = Array.isArray(value.cells)
      ? value.cells
          .map(cell => {
            if (!isRecord(cell)) {
              return null
            }
            const rowId = cell.rowId
            const columnId = cell.columnId
            if (typeof rowId !== "string" || typeof columnId !== "string") {
              return null
            }
            return { rowId, columnId }
          })
          .filter((cell): cell is ServerDemoMutationCellInvalidation => cell !== null)
      : []
    return cells.length > 0 ? { type: "cell", cells } : { type: "dataset" }
  }

  if (type === "row" || type === "rows") {
    const rows = Array.isArray(value.rows)
      ? value.rows.filter((rowId): rowId is string => typeof rowId === "string" && rowId.trim().length > 0).map(rowId => rowId.trim())
      : Array.isArray(value.rowIds)
        ? value.rowIds
            .filter((rowId): rowId is string => typeof rowId === "string" && rowId.trim().length > 0)
            .map(rowId => rowId.trim())
        : []
    return rows.length > 0 ? { type: "row", rows } : { type: "dataset" }
  }

  if (type === "range") {
    const range = isRecord(value.range) ? value.range : null
    const startRow = Number(range?.startRow ?? range?.start)
    const endRow = Number(range?.endRow ?? range?.end)
    if (!Number.isFinite(startRow) || !Number.isFinite(endRow)) {
      return null
    }
    const startColumn = typeof range?.startColumn === "string" && range.startColumn.trim().length > 0
      ? range.startColumn.trim()
      : null
    const endColumn = typeof range?.endColumn === "string" && range.endColumn.trim().length > 0
      ? range.endColumn.trim()
      : null
    return {
      type: "range",
      range: {
        startRow: Math.max(0, Math.trunc(startRow)),
        endRow: Math.max(0, Math.trunc(endRow)),
        startColumn,
        endColumn,
      },
    }
  }

  if (type === "dataset") {
    return { type: "dataset" }
  }

  return null
}

function serializeFillRange(range: {
  startRow?: number
  endRow?: number
  start?: number
  end?: number
  startColumn?: number
  endColumn?: number
}): {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
} {
  const rawStartRow = Number.isFinite(range.startRow) ? Number(range.startRow) : Number(range.start ?? 0)
  const rawEndRow = Number.isFinite(range.endRow) ? Number(range.endRow) : Number(range.end ?? rawStartRow)
  const rawStartColumn = Number.isFinite(range.startColumn) ? Number(range.startColumn) : 0
  const rawEndColumn = Number.isFinite(range.endColumn) ? Number(range.endColumn) : rawStartColumn
  return {
    startRow: Math.max(0, Math.trunc(rawStartRow)),
    endRow: Math.max(0, Math.trunc(rawEndRow)),
    startColumn: Math.max(0, Math.trunc(rawStartColumn)),
    endColumn: Math.max(0, Math.trunc(rawEndColumn)),
  }
}

function normalizeFillProjection(projection: ServerDemoFillOperationRequest["projection"]): ServerDemoFillOperationRequest["projection"] {
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

function normalizeFillBoundaryRequestBody(
  request: ServerDemoFillBoundaryRequest,
): {
  direction: "up" | "down" | "left" | "right"
  baseRange: { startRow: number; endRow: number; startColumn: number; endColumn: number }
  fillColumns: readonly string[]
  referenceColumns: readonly string[]
  projection: ServerDemoFillOperationRequest["projection"]
  startRowIndex: number
  startColumnIndex: number
  limit?: number | null
} {
  return {
    direction: request.direction,
    baseRange: serializeFillRange(request.baseRange),
    fillColumns: request.fillColumns,
    referenceColumns: request.referenceColumns,
    projection: normalizeFillProjection(request.projection),
    startRowIndex: Math.max(0, Math.trunc(request.startRowIndex)),
    startColumnIndex: Math.max(0, Math.trunc(request.startColumnIndex)),
    limit: typeof request.limit === "number" && Number.isFinite(request.limit)
      ? Math.max(0, Math.trunc(request.limit))
      : request.limit ?? null,
  }
}

function normalizeFillCommitRequestBody(request: ServerDemoFillOperationRequestWithScope): {
  operationId?: string | null
  workspace_id?: string
  table_id?: string
  user_id?: string | null
  session_id?: string
  revision?: string | number | null
  baseRevision?: string | null
  projectionHash?: string | null
  boundaryToken?: string | null
  projection: ServerDemoFillOperationRequest["projection"]
  sourceRange: { startRow: number; endRow: number; startColumn: number; endColumn: number }
  targetRange: { startRow: number; endRow: number; startColumn: number; endColumn: number }
  fillColumns: readonly string[]
  referenceColumns: readonly string[]
  mode: "copy" | "series"
  sourceRowIds?: readonly (string | number)[]
  targetRowIds?: readonly (string | number)[]
  metadata?: ServerDemoFillOperationRequest["metadata"] | null
  scope?: ServerDemoHistoryScope
} {
  const mode = request.mode === "series" ? "copy" : request.mode
  const scope = request.scope
  const scopePayload = scope
    ? {
        workspace_id: scope.workspace_id,
        table_id: scope.table_id,
        user_id: scope.user_id ?? null,
        session_id: scope.session_id,
      }
    : {}
  return {
    operationId: request.operationId ?? null,
    ...scopePayload,
    revision: request.revision ?? null,
    baseRevision: request.baseRevision,
    projectionHash: request.projectionHash,
    boundaryToken: request.boundaryToken,
    projection: normalizeFillProjection(request.projection),
    sourceRange: serializeFillRange(request.sourceRange),
    targetRange: serializeFillRange(request.targetRange),
    fillColumns: request.fillColumns,
    referenceColumns: request.referenceColumns,
    mode,
    sourceRowIds: request.sourceRowIds,
    targetRowIds: request.targetRowIds,
    metadata: request.metadata ?? null,
  }
}

function readPreviousValue(edit: unknown, columnId: string): unknown {
  if (!isRecord(edit)) {
    return undefined
  }
  const previousData = edit.previousData
  if (isRecord(previousData) && columnId in previousData) {
    return previousData[columnId]
  }
  const previousValues = edit.previousValues
  if (isRecord(previousValues) && columnId in previousValues) {
    return previousValues[columnId]
  }
  return undefined
}

function normalizeCommitEditRequestBody(request: ServerDemoCommitEditsRequestWithScope): {
  workspace_id?: string
  table_id?: string
  user_id?: string | null
  session_id?: string
  edits: {
    rowId: string
    columnId: string
    value: unknown
    previousValue?: unknown
    revision?: string | number | null
  }[]
  scope?: ServerDemoHistoryScope
} {
  const scope = request.scope
  const scopePayload = scope
    ? {
        workspace_id: scope.workspace_id,
        table_id: scope.table_id,
        user_id: scope.user_id ?? null,
        session_id: scope.session_id,
      }
    : {}
  const edits: {
    rowId: string
    columnId: string
    value: unknown
    previousValue?: unknown
    revision?: string | number | null
  }[] = []

  for (const edit of request.edits) {
    if (!edit || !isRecord(edit.data)) {
      continue
    }
    for (const [columnId, value] of Object.entries(edit.data)) {
      if (typeof value === "undefined") {
        continue
      }
      const nextEdit: {
        rowId: string
        columnId: string
        value: unknown
        previousValue?: unknown
        revision?: string | number | null
      } = {
        rowId: String(edit.rowId),
        columnId,
        value,
      }
      const previousValue = readPreviousValue(edit, columnId)
      if (typeof previousValue !== "undefined") {
        nextEdit.previousValue = previousValue
      }
      if (typeof request.revision !== "undefined") {
        nextEdit.revision = request.revision
      }
      edits.push(nextEdit)
    }
  }

  return {
    ...scopePayload,
    edits,
  }
}

function toUniqueRowCommits(response: ServerDemoCommitEditsResponse): ServerDemoCommitEditsResult["committed"] {
  const committedRows = response.committedRowIds ?? response.committed?.map(entry => entry.rowId) ?? []
  const seen = new Set<string | number>()
  const committed: ServerDemoCommittedRowResult[] = []
  for (const rowId of committedRows) {
    if (seen.has(rowId)) {
      continue
    }
    seen.add(rowId)
    committed.push({
      rowId,
      revision: response.revision ?? response.committed?.find(entry => entry.rowId === rowId)?.revision ?? null,
    })
  }
  return committed
}

function toRejectedRows(response: ServerDemoCommitEditsResponse): ServerDemoCommitEditsResult["rejected"] {
  return (response.rejected ?? []).map(entry => ({
    rowId: entry.rowId,
    reason: entry.columnId
      ? `${entry.columnId}: ${entry.reason ?? "rejected"}`
      : (entry.reason ?? "rejected"),
  }))
}

function toServerDemoHistoryState(response: {
  operationId?: string | null
  canUndo?: boolean
  canRedo?: boolean
  latestUndoOperationId?: string | null
  latestRedoOperationId?: string | null
  affectedRows?: number
  affectedCells?: number
}): ServerDemoHistoryState | null {
  const normalized = normalizeServerDemoHistoryState(response)
  if (!normalized) {
    return null
  }
  return {
    ...normalized,
    operationId: response.operationId ?? null,
  }
}

async function postServerOperation(
  fetchImpl: typeof fetch,
  url: string,
  signal?: AbortSignal,
): Promise<ServerDemoServerOperationResult> {
  const response = await postJson<ServerDemoCommitEditsResponse>(fetchImpl, url, {}, signal)
  const historyState = toServerDemoHistoryState(response)
  const serverInvalidation = normalizeServerDemoMutationInvalidation(response.invalidation)
  return {
    operationId: response.operationId ?? null,
    committed: toUniqueRowCommits(response),
    rejected: toRejectedRows(response),
    revision: response.revision,
    datasetVersion: response.datasetVersion ?? normalizeDatasetVersion(response.revision),
    invalidation: normalizeDatasourceInvalidation(response.invalidation),
    serverInvalidation,
    canUndo: historyState?.canUndo,
    canRedo: historyState?.canRedo,
    latestUndoOperationId: historyState?.latestUndoOperationId,
    latestRedoOperationId: historyState?.latestRedoOperationId,
    affectedRows: historyState?.affectedRows ?? undefined,
    affectedCells: historyState?.affectedCells ?? undefined,
    rows: response.rows ?? [],
  }
}

async function postServerFillHistoryOperation(
  fetchImpl: typeof fetch,
  url: string,
): Promise<ServerDemoFillHistoryResponse> {
  const response = await postJson<ServerDemoCommitEditsResponse>(fetchImpl, url, {})
  const historyState = toServerDemoHistoryState(response)
  const serverInvalidation = normalizeServerDemoMutationInvalidation(response.invalidation)
  return {
    operationId: response.operationId ?? null,
    revision: response.revision,
    datasetVersion: response.datasetVersion ?? normalizeDatasetVersion(response.revision),
    invalidation: normalizeDatasourceInvalidation(response.invalidation),
    serverInvalidation,
    warnings: (response.rejected ?? []).map(entry => entry.reason ?? "rejected"),
    canUndo: historyState?.canUndo,
    canRedo: historyState?.canRedo,
    latestUndoOperationId: historyState?.latestUndoOperationId,
    latestRedoOperationId: historyState?.latestRedoOperationId,
    affectedRows: historyState?.affectedRows ?? undefined,
    affectedCells: historyState?.affectedCells ?? undefined,
  }
}

async function postServerHistoryStackOperation(
  fetchImpl: typeof fetch,
  url: string,
  body: ServerDemoHistoryStackRequestBody,
  signal?: AbortSignal,
): Promise<ServerDemoHistoryStackResponse> {
  const response = await postJson<ServerDemoHistoryStackResponse>(fetchImpl, url, body, signal)
  const serverInvalidation = normalizeServerDemoMutationInvalidation(response.invalidation)
  return {
    operationId: response.operationId ?? null,
    action: response.action,
    canUndo: response.canUndo,
    canRedo: response.canRedo,
    affectedRows: response.affectedRows,
    affectedCells: response.affectedCells,
    committed: response.committed,
    committedRowIds: response.committedRowIds,
    rejected: response.rejected,
    revision: response.revision,
    datasetVersion: response.datasetVersion ?? normalizeDatasetVersion(response.revision),
    invalidation: normalizeDatasourceInvalidation(response.invalidation),
    serverInvalidation,
    latestUndoOperationId: response.latestUndoOperationId ?? null,
    latestRedoOperationId: response.latestRedoOperationId ?? null,
    rows: response.rows ?? [],
  }
}

async function postServerHistoryStatusOperation(
  fetchImpl: typeof fetch,
  url: string,
  body: ServerDemoHistoryStackRequestBody,
  signal?: AbortSignal,
): Promise<ServerDemoHistoryStatusResponse> {
  return await postJson<ServerDemoHistoryStatusResponse>(fetchImpl, url, body, signal)
}

export function applyServerDemoMutationInvalidation(
  rowModel: {
    patchRows?: (updates: readonly { rowId: string | number; data: Partial<ServerDemoRow> }[]) => void | Promise<void>
    invalidateRange?: (range: { start: number; end: number }) => void
    invalidateRows?: (rowIds: readonly string[]) => void
    invalidateAll?: () => void
  } | null | undefined,
  invalidation: ServerDemoMutationInvalidation | null | undefined,
  patches: readonly { rowId: string | number; data: Partial<ServerDemoRow> }[] = [],
): void {
  if (!rowModel || !invalidation) {
    return
  }

  if (invalidation.type === "dataset") {
    rowModel.invalidateAll?.()
    return
  }

  if (invalidation.type === "range") {
    const range = invalidation.range
    if (!range) {
      rowModel.invalidateAll?.()
      return
    }
    rowModel.invalidateRange?.({ start: range.startRow, end: range.endRow })
    return
  }

  if (invalidation.type === "cell") {
    if (patches.length > 0 && typeof rowModel.patchRows === "function") {
      rowModel.patchRows(patches)
      return
    }
    const rowIds = [...new Set((invalidation.cells ?? []).map(cell => cell.rowId).filter(rowId => rowId.trim().length > 0))]
    if (rowIds.length > 0) {
      rowModel.invalidateRows?.(rowIds)
      return
    }
    rowModel.invalidateAll?.()
    return
  }

  const rowIds = [...new Set((invalidation.rows ?? []).map(rowId => rowId.trim()).filter(rowId => rowId.length > 0))]
  if (rowIds.length > 0) {
    rowModel.invalidateRows?.(rowIds)
    return
  }
  rowModel.invalidateAll?.()
}

export interface ServerDemoDatasourceHttpAdapter extends DataGridDataSource<ServerDemoRow> {
  undoOperation(request: { operationId: string; signal?: AbortSignal }): Promise<ServerDemoServerOperationResult>
  redoOperation(request: { operationId: string; signal?: AbortSignal }): Promise<ServerDemoServerOperationResult>
  undoHistoryStack(request: ServerDemoHistoryStackRequestBody & { signal?: AbortSignal }): Promise<ServerDemoHistoryStackResponse>
  redoHistoryStack(request: ServerDemoHistoryStackRequestBody & { signal?: AbortSignal }): Promise<ServerDemoHistoryStackResponse>
  getHistoryStatus(request: ServerDemoHistoryStackRequestBody & { signal?: AbortSignal }): Promise<ServerDemoHistoryStatusResponse>
  getChangesSinceVersion(request: ServerDemoChangeFeedRequest & { signal?: AbortSignal }): Promise<ServerDemoChangeFeedResponse>
  latestDatasetVersion: number | null
  lastSeenVersion: number | null
  startChangeFeedPolling(options?: ServerDemoDatasourceHttpAdapterChangeFeedOptions): void
  stopChangeFeedPolling(): void
  getChangeFeedDiagnostics(): ServerDemoChangeFeedDiagnostics
  subscribeChangeFeedDiagnostics(listener: (diagnostics: ServerDemoChangeFeedDiagnostics) => void): () => void
  applyRowSnapshots(rows: readonly (ServerDemoRow | ServerDemoDataSourceRowEntry)[]): boolean
}

export function createServerDemoDatasourceHttpAdapter(
  options: ServerDemoDatasourceHttpAdapterOptions = {},
): ServerDemoDatasourceHttpAdapter {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const listeners = new Set<DataGridDataSourcePushListener<ServerDemoRow>>()
  const changeFeedDiagnosticsListeners = new Set<(diagnostics: ServerDemoChangeFeedDiagnostics) => void>()
  const historyScope = options.historyScope
  let latestDatasetVersion: number | null = null
  let lastSeenVersion: number | null = null
  const changeFeedPoller = createChangeFeedPoller<ServerDemoChangeFeedResponse>({
    getSinceVersion: () => lastSeenVersion,
    loadSinceVersion: async (sinceVersion: number, signal?: AbortSignal) => {
      return await loadChangeFeedSinceVersion(sinceVersion, signal)
    },
    onResponse: response => {
      applyChangeFeedResponse(response)
    },
    onError: error => {
      console.warn("Server demo change feed polling failed", error)
    },
    onDiagnostics: () => {
      emitChangeFeedDiagnostics()
    },
    isInvalidSinceVersionError,
    onInvalidSinceVersion: () => {
      resetChangeFeedCursor()
    },
  })

  function getChangeFeedDiagnostics(): ServerDemoChangeFeedDiagnostics {
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

  function emitChangeFeedDiagnostics(): void {
    const diagnostics = getChangeFeedDiagnostics()
    for (const listener of changeFeedDiagnosticsListeners) {
      listener(diagnostics)
    }
  }

  function updateDatasetVersion(version: number | null | undefined, markSeen = false): void {
    const normalizedVersion = normalizeDatasetVersion(version)
    if (normalizedVersion === null) {
      return
    }
    latestDatasetVersion = normalizedVersion
    if (markSeen) {
      lastSeenVersion = normalizedVersion
    }
    emitChangeFeedDiagnostics()
  }

  function resetChangeFeedCursor(): void {
    lastSeenVersion = 0
    emitChangeFeedDiagnostics()
  }

  function isInvalidSinceVersionError(caught: unknown): boolean {
    return caught instanceof ServerDemoHttpError && caught.code === "invalid-since-version"
  }

  function emitPushEvent(event: DataGridDataSourcePushEvent<ServerDemoRow>): void {
    for (const listener of listeners) {
      listener(event)
    }
  }

  async function loadChangeFeedSinceVersion(
    sinceVersion: number,
    signal?: AbortSignal,
  ): Promise<ServerDemoChangeFeedResponse> {
    return await getJson<ServerDemoChangeFeedResponse>(
      fetchImpl,
      resolveEndpoint(options.baseUrl, `/api/changes?sinceVersion=${encodeURIComponent(String(sinceVersion))}`),
      signal,
    )
  }

  function applyChangeFeedResponse(response: ServerDemoChangeFeedResponse): void {
    updateDatasetVersion(response.datasetVersion, true)
    for (const change of response.changes ?? []) {
      dispatchChangeFeedChange(change)
    }
  }

  function dispatchChangeFeedChange(change: ServerDemoChangeFeedChange): void {
    const mapped = mapServerChangeEvent(
      {
        ...change,
        rows: change.rows as readonly ServerRowSnapshotLike<ServerDemoRow>[] | undefined,
      } as ServerChangeEventLike<ServerDemoRow>,
      normalizeDatasourceInvalidation,
    )
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

  function applyRowSnapshots(rows: readonly (ServerDemoRow | ServerDemoDataSourceRowEntry)[]): boolean {
    const normalizedRows = normalizeRowSnapshots(rows as readonly ServerRowSnapshotLike<ServerDemoRow>[])
    if (!normalizedRows || normalizedRows.length === 0) {
      return false
    }
    emitPushEvent({
      type: "upsert",
      rows: normalizedRows,
    })
    return true
  }

  function startChangeFeedPolling(options: ServerDemoDatasourceHttpAdapterChangeFeedOptions = {}): void {
    changeFeedPoller.start({ intervalMs: options.intervalMs })
  }

  function stopChangeFeedPolling(): void {
    changeFeedPoller.stop()
  }

  return {
    async pull(request: DataGridDataSourcePullRequest): Promise<DataGridDataSourcePullResult<ServerDemoRow>> {
      const url = resolveEndpoint(options.baseUrl, "/api/server-demo/pull")
      const startIndex = Math.max(0, Math.trunc(request.range.start))
      const response = await postJson<ServerDemoPullResponse>(fetchImpl, url, {
        range: normalizeRange(request.range),
        sortModel: normalizeSortModel(request),
        filterModel: flattenFilterModel(request.filterModel),
      }, request.signal)
      updateDatasetVersion(response.datasetVersion ?? normalizeDatasetVersion(response.revision), true)

      return {
        rows: response.rows.map((row, offset) => ({
          index: startIndex + offset,
          rowId: row.id,
          row,
        })),
        total: response.total,
        cursor: response.revision ?? null,
        datasetVersion: latestDatasetVersion,
      } as DataGridDataSourcePullResult<ServerDemoRow> & { datasetVersion: number | null }
    },

    async getColumnHistogram(request: DataGridDataSourceColumnHistogramRequest): Promise<DataGridColumnHistogram> {
      const url = resolveEndpoint(options.baseUrl, "/api/server-demo/histogram")
      const response = await postJson<ServerDemoHistogramResponse>(fetchImpl, url, {
        columnId: request.columnId,
        filterModel: flattenFilterModel(request.filterModel, request.options.ignoreSelfFilter ? request.columnId : undefined),
      }, request.signal)

      let entries = toHistogramEntries(response)

      if (request.options.search && request.options.search.trim().length > 0) {
        const search = request.options.search.trim().toLowerCase()
        entries = entries.filter(entry => {
          const searchable = `${entry.text ?? ""} ${String(entry.value ?? "")} ${entry.token}`.toLowerCase()
          return searchable.includes(search)
        })
      }

      if (request.options.orderBy === "countDesc") {
        entries = [...entries].sort((left, right) => {
          if (right.count !== left.count) {
            return right.count - left.count
          }
          return String(left.text ?? left.value ?? left.token).localeCompare(String(right.text ?? right.value ?? right.token), undefined, {
            numeric: true,
            sensitivity: "base",
          })
        })
      } else if (request.options.orderBy === "valueAsc") {
        entries = [...entries].sort((left, right) => {
          if (typeof left.value === "number" && typeof right.value === "number") {
            return left.value - right.value
          }
          return String(left.text ?? left.value ?? left.token).localeCompare(String(right.text ?? right.value ?? right.token), undefined, {
            numeric: true,
            sensitivity: "base",
          })
        })
      }

      if (typeof request.options.limit === "number" && Number.isFinite(request.options.limit)) {
        entries = entries.slice(0, Math.max(0, Math.trunc(request.options.limit)))
      }

      return getHistogramResponseKey(entries)
    },

    async commitEdits(request: ServerDemoCommitEditsRequest): Promise<ServerDemoCommitEditsResult> {
      const url = resolveEndpoint(options.baseUrl, "/api/server-demo/edits")
      const body = normalizeCommitEditRequestBody({
        ...request,
        scope: historyScope,
      })
      const response = await postJson<ServerDemoCommitEditsResponse>(
        fetchImpl,
        url,
        body,
        request.signal,
      )
      updateDatasetVersion(response.datasetVersion ?? normalizeDatasetVersion(response.revision))
      return {
        operationId: response.operationId ?? null,
        committed: toUniqueRowCommits(response),
        rejected: toRejectedRows(response),
        revision: response.revision ?? null,
        canUndo: response.canUndo,
        canRedo: response.canRedo,
        latestUndoOperationId: response.latestUndoOperationId ?? null,
        latestRedoOperationId: response.latestRedoOperationId ?? null,
        affectedRows: response.affectedRows,
        affectedCells: response.affectedCells,
        datasetVersion: latestDatasetVersion,
        invalidation: normalizeDatasourceInvalidation(response.invalidation),
        serverInvalidation: normalizeServerDemoMutationInvalidation(response.invalidation),
        rows: response.rows ?? [],
      } as ServerDemoCommitEditsResultWithOperation
    },

    async resolveFillBoundary(request: ServerDemoFillBoundaryRequest): Promise<ServerDemoFillBoundaryResponse> {
      const url = resolveEndpoint(options.baseUrl, "/api/server-demo/fill-boundary")
      return await postJson<ServerDemoFillBoundaryResponse>(
        fetchImpl,
        url,
        normalizeFillBoundaryRequestBody(request),
      )
    },

    async commitFillOperation(request: ServerDemoFillOperationRequest): Promise<ServerDemoFillOperationResult> {
      const url = resolveEndpoint(options.baseUrl, "/api/server-demo/fill/commit")
      const response = await postJson<ServerDemoFillCommitResponse>(
        fetchImpl,
        url,
        normalizeFillCommitRequestBody({
          ...request,
          scope: historyScope,
        }),
      )
      updateDatasetVersion(response.datasetVersion ?? normalizeDatasetVersion(response.revision))
      const rawInvalidation = response.serverInvalidation ?? response.invalidation
      return {
        operationId: response.operationId ?? request.operationId ?? "",
        affectedRowCount: response.affectedRowCount,
        affectedCellCount: response.affectedCellCount ?? response.affectedRowCount,
        affectedRows: response.affectedRows ?? response.affectedRowCount,
        affectedCells: response.affectedCells ?? response.affectedCellCount ?? response.affectedRowCount,
        revision: response.revision,
        datasetVersion: latestDatasetVersion,
        canUndo: response.canUndo,
        canRedo: response.canRedo,
        latestUndoOperationId: response.latestUndoOperationId ?? null,
        latestRedoOperationId: response.latestRedoOperationId ?? null,
        invalidation: normalizeDatasourceInvalidation(rawInvalidation),
        serverInvalidation: normalizeServerDemoMutationInvalidation(rawInvalidation),
        warnings: response.warnings ?? [],
        rows: response.rows ?? [],
      } as ServerDemoFillOperationResult & {
        operationId?: string | null
        affectedRows?: number
        affectedCells?: number
        canUndo?: boolean
        canRedo?: boolean
        latestUndoOperationId?: string | null
        latestRedoOperationId?: string | null
      }
    },

    async undoOperation(request: { operationId: string; signal?: AbortSignal }): Promise<ServerDemoServerOperationResult> {
      const url = resolveEndpoint(options.baseUrl, `/api/server-demo/operations/${encodeURIComponent(request.operationId)}/undo`)
      const result = await postServerOperation(fetchImpl, url, request.signal)
      updateDatasetVersion(result.datasetVersion)
      return result
    },

    async redoOperation(request: { operationId: string; signal?: AbortSignal }): Promise<ServerDemoServerOperationResult> {
      const url = resolveEndpoint(options.baseUrl, `/api/server-demo/operations/${encodeURIComponent(request.operationId)}/redo`)
      const result = await postServerOperation(fetchImpl, url, request.signal)
      updateDatasetVersion(result.datasetVersion)
      return result
    },

    async undoHistoryStack(request: ServerDemoHistoryStackRequestBody & { signal?: AbortSignal }): Promise<ServerDemoHistoryStackResponse> {
      const url = resolveEndpoint(options.baseUrl, "/api/history/undo")
      const result = await postServerHistoryStackOperation(fetchImpl, url, request, request.signal)
      updateDatasetVersion(result.datasetVersion)
      return result
    },

    async redoHistoryStack(request: ServerDemoHistoryStackRequestBody & { signal?: AbortSignal }): Promise<ServerDemoHistoryStackResponse> {
      const url = resolveEndpoint(options.baseUrl, "/api/history/redo")
      const result = await postServerHistoryStackOperation(fetchImpl, url, request, request.signal)
      updateDatasetVersion(result.datasetVersion)
      return result
    },

    async getHistoryStatus(request: ServerDemoHistoryStackRequestBody & { signal?: AbortSignal }): Promise<ServerDemoHistoryStatusResponse> {
      const url = resolveEndpoint(options.baseUrl, "/api/history/status")
      const result = await postServerHistoryStatusOperation(fetchImpl, url, request, request.signal)
      updateDatasetVersion(result.datasetVersion)
      return result
    },

    async getChangesSinceVersion(request: ServerDemoChangeFeedRequest & { signal?: AbortSignal }): Promise<ServerDemoChangeFeedResponse> {
      const response = await loadChangeFeedSinceVersion(request.sinceVersion, request.signal)
      updateDatasetVersion(response.datasetVersion, true)
      for (const change of response.changes ?? []) {
        dispatchChangeFeedChange(change)
      }
      return response
    },

    async undoFillOperation(request: ServerDemoFillUndoRequest): Promise<ServerDemoFillUndoResult> {
      const url = resolveEndpoint(options.baseUrl, `/api/server-demo/operations/${encodeURIComponent(request.operationId)}/undo`)
      const result = await postServerFillHistoryOperation(fetchImpl, url)
      return {
        operationId: result.operationId ?? request.operationId,
        revision: result.revision,
        invalidation: normalizeDatasourceInvalidation(result.invalidation),
        warnings: result.warnings,
        rows: result.rows ?? [],
      }
    },

    async redoFillOperation(request: ServerDemoFillRedoRequest): Promise<ServerDemoFillRedoResult> {
      const url = resolveEndpoint(options.baseUrl, `/api/server-demo/operations/${encodeURIComponent(request.operationId)}/redo`)
      const result = await postServerFillHistoryOperation(fetchImpl, url)
      return {
        operationId: result.operationId ?? request.operationId,
        revision: result.revision,
        invalidation: normalizeDatasourceInvalidation(result.invalidation),
        warnings: result.warnings,
        rows: result.rows ?? [],
      }
    },

    subscribe(listener: DataGridDataSourcePushListener<ServerDemoRow>): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    applyRowSnapshots,
    get latestDatasetVersion() {
      return latestDatasetVersion
    },
    get lastSeenVersion() {
      return lastSeenVersion
    },
    startChangeFeedPolling,
    stopChangeFeedPolling,
    getChangeFeedDiagnostics,
    subscribeChangeFeedDiagnostics(listener: (diagnostics: ServerDemoChangeFeedDiagnostics) => void): () => void {
      changeFeedDiagnosticsListeners.add(listener)
      listener(getChangeFeedDiagnostics())
      return () => {
        changeFeedDiagnosticsListeners.delete(listener)
      }
    },
  }
}
