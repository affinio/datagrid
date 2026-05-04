import {
  type DataGridColumnFilter,
  serializeColumnValueToToken,
  type DataGridColumnHistogram,
  type DataGridColumnHistogramEntry,
  type DataGridDataSourceColumnHistogramRequest,
  type DataGridDataSource,
  type DataGridDataSourcePullRequest,
  type DataGridDataSourcePullResult,
  type DataGridDataSourcePushListener,
  type DataGridFilterSnapshot,
} from "@affino/datagrid-vue"

import {
  SERVER_DEMO_REGIONS,
  SERVER_DEMO_SEGMENTS,
  SERVER_DEMO_STATUSES,
  type ServerDemoRow,
} from "./types"

export interface ServerDemoDatasourceHttpAdapterOptions {
  baseUrl?: string
  fetchImpl?: typeof fetch
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
}

type ServerDemoHistogramResponse = {
  columnId: string
  entries: readonly {
    value: unknown
    count: number
  }[]
}

type ServerDemoCommitEditsResponse = {
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
  invalidation?: unknown
}

type ServerDemoCommitEditsRequest = Parameters<NonNullable<DataGridDataSource<ServerDemoRow>["commitEdits"]>>[0]
type ServerDemoCommitEditsResult = Awaited<ReturnType<NonNullable<DataGridDataSource<ServerDemoRow>["commitEdits"]>>>
type ServerDemoCommittedRowResult = NonNullable<ServerDemoCommitEditsResult["committed"]>[number]

type BackendFilterModel = Record<string, unknown>

type AdvancedExpressionCondition = {
  kind: "condition"
  key?: unknown
  field?: unknown
  type?: unknown
  operator?: unknown
  value?: unknown
  value2?: unknown
}

type AdvancedExpressionGroup = {
  kind: "group"
  operator?: unknown
  children?: readonly AdvancedExpressionNode[]
}

type AdvancedExpressionNot = {
  kind: "not"
  child?: AdvancedExpressionNode
}

type AdvancedExpressionNode =
  | AdvancedExpressionCondition
  | AdvancedExpressionGroup
  | AdvancedExpressionNot

const ENUM_FILTER_VALUES: Record<string, readonly string[]> = {
  region: SERVER_DEMO_REGIONS,
  segment: SERVER_DEMO_SEGMENTS,
  status: SERVER_DEMO_STATUSES,
}

function resolveEndpoint(baseUrl: string | undefined, path: string): string {
  if (!baseUrl) {
    return path
  }
  return new URL(path, baseUrl).toString()
}

function createUnsupportedOperationError(operation: string): Error {
  return new Error(`Server demo HTTP adapter does not implement ${operation} yet`)
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

function flattenAdvancedExpression(
  expression: unknown,
  omitColumnId: string | undefined,
  backendFilterModel: BackendFilterModel,
): void {
  if (!expression || typeof expression !== "object") {
    return
  }

  const node = expression as AdvancedExpressionNode
  if (node.kind === "condition") {
    const columnId = String(node.key ?? node.field ?? "").trim()
    if (!columnId || columnId === omitColumnId) {
      return
    }
    setBackendFilter(
      backendFilterModel,
      columnId,
      createBackendFilterForPredicate(
        columnId,
        String(node.operator ?? "contains"),
        node.value,
        node.value2,
      ),
    )
    return
  }

  if (node.kind === "group") {
    const operator = String(node.operator ?? "and").trim().toLowerCase()
    if (operator !== "and") {
      return
    }
    for (const child of node.children ?? []) {
      flattenAdvancedExpression(child, omitColumnId, backendFilterModel)
    }
  }
}

function flattenFilterModel(filterModel: DataGridFilterSnapshot | null, omitColumnId?: string): BackendFilterModel | null {
  if (!filterModel) {
    return null
  }

  const backendFilterModel: BackendFilterModel = {}
  const columnFilters = filterModel.columnFilters ?? {}
  const advancedFilters = filterModel.advancedFilters ?? {}

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

  for (const [columnId, advancedFilter] of Object.entries(advancedFilters) as Array<[
    string,
    {
      clauses?: readonly {
        operator?: unknown
        value?: unknown
        value2?: unknown
      }[]
    },
  ]>) {
    if (columnId === omitColumnId) {
      continue
    }

    const clauses = advancedFilter.clauses ?? []
    if (clauses.length === 0) {
      continue
    }

    if (columnId === "value") {
      const numericFilter: Record<string, unknown> = {}
      for (const clause of clauses) {
        if (!clause) {
          continue
        }
        const operator = clause.operator == null ? "" : String(clause.operator).trim().toLowerCase()
        if (operator === "gte" || operator === ">=") {
          const value = normalizeFilterValue(clause.value)
          if (value !== null) {
            numericFilter.min = value
          }
        } else if (operator === "gt" || operator === ">") {
          const value = normalizeFilterValue(clause.value)
          if (value !== null) {
            numericFilter.min = value
          }
        } else if (operator === "lte" || operator === "<=") {
          const value = normalizeFilterValue(clause.value)
          if (value !== null) {
            numericFilter.max = value
          }
        } else if (operator === "lt" || operator === "<") {
          const value = normalizeFilterValue(clause.value)
          if (value !== null) {
            numericFilter.max = value
          }
        } else if (operator === "between" || operator === "range") {
          const minValue = normalizeFilterValue(clause.value)
          const maxValue = normalizeFilterValue(clause.value2)
          if (minValue !== null) {
            numericFilter.min = minValue
          }
          if (maxValue !== null) {
            numericFilter.max = maxValue
          }
        } else if (operator === "equals" || operator === "eq" || operator === "is") {
          numericFilter.type = "equals"
          const value = normalizeFilterValue(clause.value)
          if (value !== null) {
            numericFilter.filter = value
          }
        }
      }

      if (Object.keys(numericFilter).length > 0) {
        backendFilterModel[columnId] = numericFilter
      }
      continue
    }

    if (clauses.length > 0) {
      const clause = clauses[0]
      if (!clause) {
        continue
      }
      const operator = clause.operator == null ? "" : String(clause.operator).trim().toLowerCase()
      if (operator === "contains" || operator === "equals" || operator === "eq" || operator === "is") {
        const value = normalizeFilterValueForColumn(columnId, clause.value)
        if (value === null) {
          continue
        }
        backendFilterModel[columnId] = {
          type: operator === "contains" ? "contains" : "equals",
          filter: value,
        }
      } else if (operator === "gt" || operator === "gte" || operator === "lt" || operator === "lte") {
        setBackendFilter(
          backendFilterModel,
          columnId,
          createBackendFilterForPredicate(columnId, operator, clause.value),
        )
      }
    }
  }

  flattenAdvancedExpression(filterModel.advancedExpression, omitColumnId, backendFilterModel)

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

async function postJson<TResponse>(
  fetchImpl: typeof fetch,
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<TResponse> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    throw await parseErrorResponse(response)
  }

  return (await response.json()) as TResponse
}

function getHistogramResponseKey(entries: readonly DataGridColumnHistogramEntry[]): DataGridColumnHistogram {
  return entries
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

function normalizeCommitEditRequestBody(request: ServerDemoCommitEditsRequest): {
  edits: {
    rowId: string
    columnId: string
    value: unknown
    previousValue?: unknown
    revision?: string | number | null
  }[]
} {
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

  return { edits }
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

export function createServerDemoDatasourceHttpAdapter(
  options: ServerDemoDatasourceHttpAdapterOptions = {},
): DataGridDataSource<ServerDemoRow> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const listeners = new Set<DataGridDataSourcePushListener<ServerDemoRow>>()

  return {
    async pull(request: DataGridDataSourcePullRequest): Promise<DataGridDataSourcePullResult<ServerDemoRow>> {
      const url = resolveEndpoint(options.baseUrl, "/api/server-demo/pull")
      const startIndex = Math.max(0, Math.trunc(request.range.start))
      const response = await postJson<ServerDemoPullResponse>(fetchImpl, url, {
        range: normalizeRange(request.range),
        sortModel: normalizeSortModel(request),
        filterModel: flattenFilterModel(request.filterModel),
      }, request.signal)

      return {
        rows: response.rows.map((row, offset) => ({
          index: startIndex + offset,
          rowId: row.id,
          row,
        })),
        total: response.total,
        cursor: response.revision ?? null,
      }
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
      const body = normalizeCommitEditRequestBody(request)
      const response = await postJson<ServerDemoCommitEditsResponse>(
        fetchImpl,
        url,
        body,
        request.signal,
      )
      return {
        committed: toUniqueRowCommits(response),
        rejected: toRejectedRows(response),
      }
    },

    async commitFillOperation(): Promise<never> {
      throw createUnsupportedOperationError("commitFillOperation")
    },

    async undoFillOperation(): Promise<never> {
      throw createUnsupportedOperationError("undoFillOperation")
    },

    async redoFillOperation(): Promise<never> {
      throw createUnsupportedOperationError("redoFillOperation")
    },

    async resolveFillBoundary(): Promise<never> {
      throw createUnsupportedOperationError("resolveFillBoundary")
    },

    subscribe(listener: DataGridDataSourcePushListener<ServerDemoRow>): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
