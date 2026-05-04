// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"
import type {
  DataGridDataSourceColumnHistogramRequest,
  DataGridDataSourcePullRequest,
} from "@affino/datagrid-vue"

import { createServerDemoDatasourceHttpAdapter, ServerDemoHttpError } from "./serverDemoDatasourceHttpAdapter"

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

  it("throws clear unsupported errors for write-oriented methods", async () => {
    const adapter = createServerDemoDatasourceHttpAdapter()

    await expect(adapter.commitEdits!({ edits: [] })).rejects.toThrow("commitEdits")
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
