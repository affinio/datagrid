// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"
import type {
  DataGridDataSourceColumnHistogramRequest,
  DataGridDataSourcePullRequest,
} from "@affino/datagrid-vue"

import { createServerDemoDatasourceHttpAdapter, ServerDemoHttpError } from "./serverDemoDatasourceHttpAdapter"
import type { ServerDemoCommitEditsRequest } from "./types"

function createAbortablePullRequest(): DataGridDataSourcePullRequest {
  const controller = new AbortController()
  return {
    range: { start: 0, end: 49 },
    priority: "normal",
    reason: "mount",
    signal: controller.signal,
    sortModel: [{ key: "value", direction: "desc" }],
    filterModel: {
      columnFilters: {
        region: { kind: "valueSet", tokens: ["string:emea"] },
        segment: { kind: "valueSet", tokens: ["string:growth"] },
        status: { kind: "valueSet", tokens: ["string:active"] },
        name: { kind: "predicate", operator: "contains", value: "Account 0001" },
        value: { kind: "predicate", operator: "between", value: 1000, value2: 2000 },
      },
      advancedFilters: {},
    },
    groupBy: null,
    groupExpansion: { expandedByDefault: false, toggledGroupKeys: [] },
    treeData: null,
    pivot: null,
    pagination: {
      snapshot: {
        enabled: false,
        pageSize: 50,
        currentPage: 0,
        pageCount: 0,
        totalRowCount: 0,
        startIndex: 0,
        endIndex: 49,
      },
      cursor: null,
    },
  }
}

function createHistogramRequest(): DataGridDataSourceColumnHistogramRequest {
  const controller = new AbortController()
  return {
    columnId: "region",
    options: {
      scope: "filtered",
      ignoreSelfFilter: true,
      search: "EM",
      limit: 2,
      orderBy: "countDesc",
    },
    signal: controller.signal,
    sortModel: [],
    filterModel: {
      columnFilters: {
        region: { kind: "valueSet", tokens: ["string:emea"] },
        status: { kind: "valueSet", tokens: ["string:active"] },
      },
      advancedFilters: {},
    },
    groupBy: null,
    groupExpansion: { expandedByDefault: false, toggledGroupKeys: [] },
    treeData: null,
    pivot: null,
    pagination: {
      snapshot: {
        enabled: false,
        pageSize: 50,
        currentPage: 0,
        pageCount: 0,
        totalRowCount: 0,
        startIndex: 0,
        endIndex: 49,
      },
      cursor: null,
    },
  }
}

function createCommitEditsRequest(): ServerDemoCommitEditsRequest {
  const controller = new AbortController()
  return {
    signal: controller.signal,
    revision: "rev-before",
    edits: [
      {
        rowId: "srv-000001",
        data: {
          name: "Renamed Account",
        },
      },
    ],
  }
}

describe("createServerDemoDatasourceHttpAdapter", () => {
  it("posts pulls to the backend and maps rows with ServerDemoRow shape intact", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      rows: [
        {
          id: "srv-000001",
          index: 1,
          name: "Account 00001",
          segment: "Growth",
          status: "Paused",
          region: "EMEA",
          value: 97,
          updatedAt: "2025-01-01T00:00:01Z",
        },
      ],
      total: 100,
      revision: "rev-1",
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ baseUrl: "http://localhost:8000", fetchImpl })
    const request = createAbortablePullRequest()
    const result = await adapter.pull(request)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("http://localhost:8000/api/server-demo/pull")
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBe(request.signal)
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      range: { startRow: 0, endRow: 50 },
      sortModel: [{ colId: "value", sort: "desc" }],
      filterModel: {
        region: { type: "equals", filter: "EMEA" },
        segment: { type: "equals", filter: "Growth" },
        status: { type: "equals", filter: "Active" },
        name: { type: "contains", filter: "Account 0001" },
        value: { type: "inRange", filter: 1000, filterTo: 2000 },
      },
    })
    expect(result.total).toBe(100)
    expect(result.cursor).toBe("rev-1")
    expect(result.rows).toEqual([
      {
        index: 0,
        rowId: "srv-000001",
        row: {
          id: "srv-000001",
          index: 1,
          name: "Account 00001",
          segment: "Growth",
          status: "Paused",
          region: "EMEA",
          value: 97,
          updatedAt: "2025-01-01T00:00:01Z",
        },
      },
    ])
  })

  it("posts histograms, strips ignored self filters, and applies local search/limit ordering", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      columnId: "region",
      entries: [
        { value: "APAC", count: 3 },
        { value: "AMER", count: 5 },
        { value: "EMEA", count: 5 },
        { value: "LATAM", count: 1 },
      ],
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    const histogram = await adapter.getColumnHistogram!(createHistogramRequest())

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("/api/server-demo/histogram")
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      columnId: "region",
      filterModel: {
        status: { type: "equals", filter: "Active" },
      },
    })
    expect(histogram).toEqual([
      { token: "string:EMEA", value: "EMEA", text: "string:EMEA", count: 5 },
    ])
  })

  it("drops empty filter clauses and supports legacy array value sets", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      rows: [],
      total: 0,
      revision: null,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    await adapter.pull({
      ...createAbortablePullRequest(),
      filterModel: {
        columnFilters: {
          region: ["string:emea"] as never,
          status: { kind: "valueSet", tokens: [] },
          name: { kind: "predicate", operator: "contains", value: "   " },
          value: { kind: "predicate", operator: "between", value: null, value2: null },
        },
        advancedFilters: {},
      },
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      range: { startRow: 0, endRow: 50 },
      sortModel: [{ colId: "value", sort: "desc" }],
      filterModel: {
        region: { type: "equals", filter: "EMEA" },
      },
    })
  })

  it("flattens browser advanced filter expressions into supported backend filters", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      rows: [],
      total: 0,
      revision: "rev-empty",
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    await adapter.pull({
      ...createAbortablePullRequest(),
      filterModel: {
        columnFilters: {},
        advancedFilters: {},
        advancedExpression: {
          kind: "group",
          operator: "and",
          children: [
            { kind: "condition", key: "region", operator: "in", value: "emea" },
            { kind: "condition", key: "name", operator: "contains", value: "0001" },
            { kind: "condition", key: "value", type: "number", operator: "gte", value: 1000 },
            { kind: "group", operator: "or", children: [{ kind: "condition", key: "status", operator: "equals", value: "" }] },
          ],
        },
      },
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      range: { startRow: 0, endRow: 50 },
      sortModel: [{ colId: "value", sort: "desc" }],
      filterModel: {
        region: { type: "equals", filter: "EMEA" },
        name: { type: "contains", filter: "0001" },
        value: { type: "greaterThanOrEqual", filter: 1000 },
      },
    })
  })

  it("throws a useful error when the backend returns a non-2xx response", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      code: "unsupported_histogram_column",
      message: "Value histograms are not implemented yet",
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    await expect(adapter.getColumnHistogram!({
      ...createHistogramRequest(),
      columnId: "value",
    })).rejects.toMatchObject({
      name: "ServerDemoHttpError",
      status: 400,
      code: "unsupported_histogram_column",
      message: "Value histograms are not implemented yet",
    } satisfies Partial<ServerDemoHttpError>)
  })

  it("posts single inline edits to the backend and maps committed rows", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      operationId: "op-inline-1",
      committed: [{ rowId: "srv-000001", columnId: "name", revision: "rev-row-1" }],
      committedRowIds: ["srv-000001"],
      rejected: [],
      revision: "rev-global-1",
      invalidation: {
        kind: "range",
        range: { start: 1, end: 1 },
        reason: "server-demo-edits",
      },
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ baseUrl: "http://localhost:8000", fetchImpl })
    const result = await adapter.commitEdits!(createCommitEditsRequest())

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("http://localhost:8000/api/server-demo/edits")
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      edits: [
        {
          rowId: "srv-000001",
          columnId: "name",
          value: "Renamed Account",
          revision: "rev-before",
        },
      ],
    })
    expect(result).toEqual({
      operationId: "op-inline-1",
      committed: [{ rowId: "srv-000001", revision: "rev-global-1" }],
      rejected: [],
    })
  })

  it("flattens batch edit patches into multiple backend cell edits", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      committed: [
        { rowId: "srv-000002", columnId: "status", revision: "rev-row-2" },
        { rowId: "srv-000002", columnId: "value", revision: "rev-row-2" },
        { rowId: "srv-000003", columnId: "region", revision: "rev-row-3" },
      ],
      committedRowIds: ["srv-000002", "srv-000003"],
      rejected: [],
      revision: "rev-global-2",
      invalidation: null,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    const result = await adapter.commitEdits!({
      edits: [
        { rowId: "srv-000002", data: { status: "Active", value: 42 } },
        { rowId: "srv-000003", data: { region: "EMEA" } },
      ],
    })

    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      edits: [
        { rowId: "srv-000002", columnId: "status", value: "Active" },
        { rowId: "srv-000002", columnId: "value", value: 42 },
        { rowId: "srv-000003", columnId: "region", value: "EMEA" },
      ],
    })
    expect(result.committed).toEqual([
      { rowId: "srv-000002", revision: "rev-global-2" },
      { rowId: "srv-000003", revision: "rev-global-2" },
    ])
  })

  it("preserves cleared cell values when flattening batch edit patches", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      committed: [
        { rowId: "srv-000004", columnId: "name", revision: "rev-row-4" },
        { rowId: "srv-000004", columnId: "status", revision: "rev-row-4" },
      ],
      committedRowIds: ["srv-000004"],
      rejected: [],
      revision: "rev-global-4",
      invalidation: null,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    await adapter.commitEdits!({
      edits: [
        { rowId: "srv-000004", data: { name: "", status: "Active" } },
      ],
    })

    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      edits: [
        { rowId: "srv-000004", columnId: "name", value: "" },
        { rowId: "srv-000004", columnId: "status", value: "Active" },
      ],
    })
  })

  it("maps readonly column rejections to row-model rejected rows", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      operationId: "op-readonly-1",
      committed: [],
      committedRowIds: [],
      rejected: [{ rowId: "srv-000004", columnId: "id", reason: "readonly-column" }],
      revision: "rev-global-3",
      invalidation: null,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    const result = await adapter.commitEdits!({
      edits: [{ rowId: "srv-000004", data: { id: "srv-hacked" } }],
    })

    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      edits: [{ rowId: "srv-000004", columnId: "id", value: "srv-hacked" }],
    })
    expect(result).toEqual({
      operationId: "op-readonly-1",
      committed: [],
      rejected: [{ rowId: "srv-000004", reason: "id: readonly-column" }],
    })
  })

  it("maps partial success responses without dropping rejected rows", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      operationId: "op-partial-1",
      committed: [{ rowId: "srv-000005", columnId: "name", revision: "rev-row-5" }],
      committedRowIds: ["srv-000005"],
      rejected: [{ rowId: "srv-000006", columnId: "status", reason: "invalid-enum-value" }],
      revision: "rev-global-4",
      invalidation: {
        kind: "range",
        range: { start: 5, end: 5 },
        reason: "server-demo-edits",
      },
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    const result = await adapter.commitEdits!({
      edits: [
        { rowId: "srv-000005", data: { name: "Committed" } },
        { rowId: "srv-000006", data: { status: "Archived" } },
      ],
    })

    expect(result).toEqual({
      operationId: "op-partial-1",
      committed: [{ rowId: "srv-000005", revision: "rev-global-4" }],
      rejected: [{ rowId: "srv-000006", reason: "status: invalid-enum-value" }],
    })
  })

  it("does not emit commit invalidation events because the row model reconciles commit results", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      committed: [{ rowId: "srv-000007", columnId: "value", revision: "rev-row-7" }],
      committedRowIds: ["srv-000007"],
      rejected: [],
      revision: "rev-global-5",
      invalidation: {
        kind: "range",
        range: { start: 7, end: 7 },
        reason: "server-demo-edits",
      },
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))
    const events: unknown[] = []
    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    const unsubscribe = adapter.subscribe!(event => {
      events.push(event)
    })

    await adapter.commitEdits!({ edits: [{ rowId: "srv-000007", data: { value: 777 } }] })
    unsubscribe()

    expect(events).toEqual([])
  })

  it("throws clear unsupported errors for write-oriented methods", async () => {
    const adapter = createServerDemoDatasourceHttpAdapter()

    await expect(adapter.commitFillOperation!({
      projection: {
        sortModel: [],
        filterModel: null,
        groupBy: null,
        groupExpansion: { expandedByDefault: false, toggledGroupKeys: [] },
        treeData: null,
        pivot: null,
        pagination: {
          snapshot: {
            enabled: false,
            pageSize: 1,
            currentPage: 0,
            pageCount: 0,
            totalRowCount: 0,
            startIndex: 0,
            endIndex: 0,
          },
          cursor: null,
        },
      },
      sourceRange: { start: 0, end: 0 },
      targetRange: { start: 0, end: 0 },
      fillColumns: [],
      referenceColumns: [],
      mode: "copy",
    })).rejects.toThrow("commitFillOperation")
  })
})
