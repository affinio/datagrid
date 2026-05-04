import {
  type DataGridColumnFilter,
  serializeColumnValueToToken,
  type DataGridColumnHistogram,
  type DataGridColumnHistogramEntry,
  type DataGridDataSourceColumnHistogramRequest,
  type DataGridDataSource,
  type DataGridDataSourcePullRequest,
  type DataGridDataSourcePullResult,
  type DataGridFilterSnapshot,
} from "@affino/datagrid-vue"

import type { ServerDemoRow } from "./types"

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

type BackendFilterModel = Record<string, unknown>

function resolveEndpoint(baseUrl: string | undefined, path: string): string {
  if (!baseUrl) {
    return path
  }
  return new URL(path, baseUrl).toString()
}

function createUnsupportedOperationError(operation: string): Error {
  return new Error(`Server demo HTTP adapter does not implement ${operation} yet`)
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

    if (filterEntry.kind === "valueSet") {
      if (filterEntry.tokens.length === 1) {
        const token = filterEntry.tokens[0]
        backendFilterModel[columnId] = {
          type: "equals",
          filter: token,
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
      case "lte": {
        backendFilterModel[columnId] = { type: operator, filter: filterEntry.value }
        break
      }
      case "between": {
        backendFilterModel[columnId] = {
          type: "inRange",
          filter: filterEntry.value,
          filterTo: filterEntry.value2,
        }
        break
      }
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
          numericFilter.min = clause.value
        } else if (operator === "gt" || operator === ">") {
          numericFilter.min = clause.value
        } else if (operator === "lte" || operator === "<=") {
          numericFilter.max = clause.value
        } else if (operator === "lt" || operator === "<") {
          numericFilter.max = clause.value
        } else if (operator === "between" || operator === "range") {
          numericFilter.min = clause.value
          numericFilter.max = clause.value2
        } else if (operator === "equals" || operator === "eq" || operator === "is") {
          numericFilter.type = "equals"
          numericFilter.filter = clause.value
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
        backendFilterModel[columnId] = {
          type: operator === "contains" ? "contains" : "equals",
          filter: clause.value,
        }
      } else if (operator === "gt" || operator === "gte" || operator === "lt" || operator === "lte") {
        backendFilterModel[columnId] = {
          type: operator,
          filter: clause.value,
        }
      }
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

async function postJson<TResponse>(
  fetchImpl: typeof fetch,
  url: string,
  body: unknown,
  signal: AbortSignal,
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

export function createServerDemoDatasourceHttpAdapter(
  options: ServerDemoDatasourceHttpAdapterOptions = {},
): DataGridDataSource<ServerDemoRow> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)

  return {
    async pull(request: DataGridDataSourcePullRequest): Promise<DataGridDataSourcePullResult<ServerDemoRow>> {
      const url = resolveEndpoint(options.baseUrl, "/api/server-demo/pull")
      const response = await postJson<ServerDemoPullResponse>(fetchImpl, url, {
        range: normalizeRange(request.range),
        sortModel: normalizeSortModel(request),
        filterModel: flattenFilterModel(request.filterModel),
      }, request.signal)

      return {
        rows: response.rows.map(row => ({
          index: row.index,
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

    async commitEdits(): Promise<never> {
      throw createUnsupportedOperationError("commitEdits")
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
  }
}
