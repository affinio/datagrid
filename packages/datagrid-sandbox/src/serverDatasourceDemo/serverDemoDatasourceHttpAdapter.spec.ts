// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  DataGridDataSourceColumnHistogramRequest,
  DataGridDataSourcePullRequest,
} from "@affino/datagrid-vue"

import {
  applyServerDemoMutationInvalidation,
  createServerDemoDatasourceHttpAdapter,
  ServerDemoHttpError,
} from "./serverDemoDatasourceHttpAdapter"
import {
  createServerDemoHistoryScope,
  resolveServerDemoHistoryScopeFromEnv,
} from "./serverDemoHistoryScope"
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

function createFillProjection() {
  return {
    sortModel: [],
    filterModel: null,
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
  afterEach(() => {
    vi.useRealTimers()
    window.dispatchEvent(new Event("pageshow"))
  })

  it("keeps the default history scope stable", () => {
    expect(createServerDemoHistoryScope()).toEqual({
      workspace_id: "server-demo-sandbox",
      table_id: "server_demo",
      session_id: "server-demo-session",
    })
  })

  it("resolves history scope overrides from the demo env", () => {
    expect(resolveServerDemoHistoryScopeFromEnv({
      VITE_SERVER_DEMO_WORKSPACE_ID: "  workspace-override  ",
      VITE_SERVER_DEMO_SESSION_ID: " session-override ",
      VITE_SERVER_DEMO_USER_ID: " user-override ",
    })).toEqual({
      workspace_id: "workspace-override",
      table_id: "server_demo",
      session_id: "session-override",
      user_id: "user-override",
    })
  })

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
      datasetVersion: 1,
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
    expect(adapter.latestDatasetVersion).toBe(1)
    expect((result as { datasetVersion?: number | null }).datasetVersion).toBe(1)
  })

  it("normalizes aborted pull requests to AbortError even when fetch reports a transport failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })
    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    const controller = new AbortController()
    const request: DataGridDataSourcePullRequest = {
      range: { start: 0, end: 49 },
      priority: "normal",
      reason: "mount",
      signal: controller.signal,
      sortModel: [],
      filterModel: null,
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
    controller.abort()

    await expect(adapter.pull(request)).rejects.toMatchObject({
      name: "AbortError",
      message: "Aborted",
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("normalizes page reload transport failures to AbortError", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })
    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    const request = createAbortablePullRequest()

    window.dispatchEvent(new Event("pagehide"))

    await expect(adapter.pull(request)).rejects.toMatchObject({
      name: "AbortError",
      message: "Aborted",
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("preserves transport failures after page lifecycle resumes", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })
    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })

    window.dispatchEvent(new Event("pagehide"))
    window.dispatchEvent(new Event("pageshow"))

    await expect(adapter.pull(createAbortablePullRequest())).rejects.toBeInstanceOf(TypeError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("polls the change feed and updates the latest dataset version", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      datasetVersion: 2,
        changes: [
          {
            type: "cell",
            invalidation: {
              type: "cell",
              cells: [{ rowId: "srv-000010", columnId: "name" }],
              rows: [],
              range: null,
            },
            operationId: "change-1",
            user_id: null,
            session_id: "server-demo-session",
            rows: [
              {
                id: "srv-000010",
                index: 10,
                name: "Account 00010",
                segment: "Growth",
                status: "Active",
                region: "EMEA",
                value: 910,
                updatedAt: "2025-01-01T00:00:10Z",
              },
            ],
          },
        ],
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ baseUrl: "http://localhost:8000", fetchImpl })
    const result = await adapter.getChangesSinceVersion({ sinceVersion: 1 })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("http://localhost:8000/api/changes?sinceVersion=1")
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
    })
    expect(adapter.latestDatasetVersion).toBe(2)
    expect(result).toEqual({
      datasetVersion: 2,
      changes: [
        {
          type: "cell",
          invalidation: {
            type: "cell",
            cells: [{ rowId: "srv-000010", columnId: "name" }],
            rows: [],
            range: null,
          },
          operationId: "change-1",
          user_id: null,
          session_id: "server-demo-session",
          rows: [
            {
              id: "srv-000010",
              index: 10,
              name: "Account 00010",
              segment: "Growth",
              status: "Active",
              region: "EMEA",
              value: 910,
              updatedAt: "2025-01-01T00:00:10Z",
            },
          ],
        },
      ],
    })
  })

  it("starts polling the change feed and emits upsert events without overlapping requests", async () => {
    vi.useFakeTimers()
    let resolveChanges: ((response: Response) => void) | null = null
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const resolvedUrl = String(url)
      if (resolvedUrl.includes("/api/changes")) {
        return await new Promise<Response>(resolve => {
          resolveChanges = resolve
        })
      }
      throw new Error(`unexpected request: ${resolvedUrl}`)
    })

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    const pushed = vi.fn()
    const diagnosticsUpdates: ReturnType<typeof adapter.getChangeFeedDiagnostics>[] = []
    const unsubscribe = adapter.subscribe!(pushed)
    const unsubscribeDiagnostics = adapter.subscribeChangeFeedDiagnostics(state => {
      diagnosticsUpdates.push(state)
    })

    adapter.startChangeFeedPolling({ intervalMs: 250 })
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("/api/changes?sinceVersion=0")
    expect(adapter.getChangeFeedDiagnostics()).toMatchObject({
      polling: true,
      pending: true,
      appliedChanges: 0,
    })

    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    if (resolveChanges) {
      const resolveChangeFeed = resolveChanges as (response: Response) => void
      resolveChangeFeed(new Response(JSON.stringify({
        datasetVersion: 2,
        changes: [
          {
            type: "cell",
            invalidation: {
              type: "cell",
              cells: [{ rowId: "srv-000010", columnId: "name" }],
              rows: [],
              range: null,
            },
            rows: [
              {
                id: "srv-000010",
                index: 10,
                name: "Account 00010",
                segment: "Growth",
                status: "Active",
                region: "EMEA",
                value: 910,
                updatedAt: "2025-01-01T00:00:10Z",
              },
            ],
          },
        ],
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }))
    }
    await Promise.resolve()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()

    expect(pushed).toHaveBeenCalledWith({
      type: "upsert",
      rows: [
        {
          index: 9,
          rowId: "srv-000010",
          row: {
            id: "srv-000010",
            index: 10,
            name: "Account 00010",
            segment: "Growth",
            status: "Active",
            region: "EMEA",
            value: 910,
            updatedAt: "2025-01-01T00:00:10Z",
          },
        },
      ],
    })
    expect(adapter.lastSeenVersion).toBe(2)
    expect(adapter.getChangeFeedDiagnostics()).toMatchObject({
      polling: true,
      pending: false,
      appliedChanges: 1,
    })

    adapter.stopChangeFeedPolling()
    unsubscribeDiagnostics()
    unsubscribe()
    expect(diagnosticsUpdates.length).toBeGreaterThan(0)
  })

  it("emits range invalidations and dataset fallbacks from the change feed", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      datasetVersion: 4,
      changes: [
        {
          type: "range",
          invalidation: {
            type: "range",
            range: { startRow: 3, endRow: 7, startColumn: "name", endColumn: "status" },
          },
        },
        {
          type: "dataset",
          invalidation: {
            type: "dataset",
          },
        },
      ],
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    const pushed = vi.fn()
    adapter.subscribe!(pushed)

    await adapter.getChangesSinceVersion({ sinceVersion: 3 })

    expect(pushed).toHaveBeenNthCalledWith(1, {
      type: "invalidate",
      invalidation: {
        kind: "range",
        range: { start: 3, end: 7 },
      },
    })
    expect(pushed).toHaveBeenNthCalledWith(2, {
      type: "invalidate",
      invalidation: {
        kind: "all",
      },
    })
  })

  it("polls from the latest seen version after a mutation response", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const resolvedUrl = String(url)
      if (resolvedUrl.includes("/api/server-demo/edits")) {
        return new Response(JSON.stringify({
          operationId: "op-inline-1",
          committed: [{ rowId: "srv-000001", columnId: "name", revision: "rev-row-1" }],
          committedRowIds: ["srv-000001"],
          rejected: [],
          affectedRows: 1,
          affectedCells: 1,
          revision: "rev-global-7",
          datasetVersion: 7,
          canUndo: true,
          canRedo: false,
          latestUndoOperationId: "op-inline-1",
          latestRedoOperationId: null,
          invalidation: null,
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      }
      if (resolvedUrl.includes("/api/changes")) {
        return new Response(JSON.stringify({
          datasetVersion: 8,
          changes: [],
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      }
      throw new Error(`unexpected request: ${resolvedUrl}`)
    })

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    await adapter.commitEdits!(createCommitEditsRequest())
    expect(adapter.lastSeenVersion).toBe(7)

    vi.useFakeTimers()
    adapter.startChangeFeedPolling({ intervalMs: 250 })
    await vi.advanceTimersByTimeAsync(0)

    const lastCall = fetchImpl.mock.calls[fetchImpl.mock.calls.length - 1]
    expect(String(lastCall?.[0])).toContain("/api/changes?sinceVersion=7")
    adapter.stopChangeFeedPolling()
  })

  it("moves the polling cursor back when undo returns an older authoritative dataset version", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const resolvedUrl = String(url)
      if (resolvedUrl.includes("/api/server-demo/edits")) {
        return new Response(JSON.stringify({
          operationId: "op-inline-1",
          committed: [{ rowId: "srv-000001", columnId: "name", revision: "rev-row-1" }],
          committedRowIds: ["srv-000001"],
          rejected: [],
          affectedRows: 1,
          affectedCells: 1,
          revision: "rev-global-7",
          datasetVersion: 7,
          canUndo: true,
          canRedo: false,
          latestUndoOperationId: "op-inline-1",
          latestRedoOperationId: null,
          invalidation: null,
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      }
      if (resolvedUrl.includes("/undo")) {
        return new Response(JSON.stringify({
          operationId: "op-inline-1",
          committed: [{ rowId: "srv-000001", columnId: "name", revision: "rev-row-1" }],
          committedRowIds: ["srv-000001"],
          rejected: [],
          revision: "rev-global-4",
          datasetVersion: 4,
          canUndo: true,
          canRedo: true,
          latestUndoOperationId: "op-inline-0",
          latestRedoOperationId: "op-inline-1",
          invalidation: null,
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      }
      if (resolvedUrl.includes("/api/changes")) {
        return new Response(JSON.stringify({
          datasetVersion: 4,
          changes: [],
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      }
      throw new Error(`unexpected request: ${resolvedUrl}`)
    })

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    await adapter.commitEdits!(createCommitEditsRequest())
    expect(adapter.lastSeenVersion).toBe(7)

    await adapter.undoHistoryStack({
      workspace_id: "server-demo-sandbox",
      table_id: "server_demo",
      session_id: "server-demo-session",
    })
    expect(adapter.lastSeenVersion).toBe(4)

    const response = await adapter.getChangesSinceVersion({ sinceVersion: 4 })
    expect(response.datasetVersion).toBe(4)
    const lastCall = fetchImpl.mock.calls[fetchImpl.mock.calls.length - 1]
    expect(String(lastCall?.[0])).toContain("/api/changes?sinceVersion=4")
  })

  it("applies cell, range, and dataset invalidations to the row model", () => {
    const patchRows = vi.fn()
    const invalidateRange = vi.fn()
    const invalidateRows = vi.fn()
    const invalidateAll = vi.fn()

    applyServerDemoMutationInvalidation(
      {
        patchRows,
        invalidateRange,
        invalidateRows,
        invalidateAll,
      },
      {
        type: "cell",
        cells: [
          { rowId: "srv-000001", columnId: "name" },
          { rowId: "srv-000002", columnId: "status" },
        ],
      },
      [
        { rowId: "srv-000001", data: { name: "Updated" } },
        { rowId: "srv-000002", data: { status: "Paused" } },
      ],
    )

    applyServerDemoMutationInvalidation(
      {
        patchRows,
        invalidateRange,
        invalidateRows,
        invalidateAll,
      },
      {
        type: "range",
        range: { startRow: 3, endRow: 7, startColumn: "name", endColumn: "status" },
      },
    )

    applyServerDemoMutationInvalidation(
      {
        patchRows,
        invalidateRange,
        invalidateRows,
        invalidateAll,
      },
      {
        type: "dataset",
      },
    )

    expect(patchRows).toHaveBeenCalledTimes(1)
    expect(patchRows).toHaveBeenCalledWith([
      { rowId: "srv-000001", data: { name: "Updated" } },
      { rowId: "srv-000002", data: { status: "Paused" } },
    ])
    expect(invalidateRange).toHaveBeenCalledWith({ start: 3, end: 7 })
    expect(invalidateAll).toHaveBeenCalledTimes(1)
    expect(invalidateRows).not.toHaveBeenCalled()
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
      affectedRows: 1,
      affectedCells: 1,
      revision: "rev-global-1",
      canUndo: true,
      canRedo: false,
      latestUndoOperationId: "op-inline-1",
      latestRedoOperationId: null,
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
    expect(result).toMatchObject({
      operationId: "op-inline-1",
      committed: [{ rowId: "srv-000001", revision: "rev-global-1" }],
      rejected: [],
      revision: "rev-global-1",
      affectedRows: 1,
      affectedCells: 1,
      canUndo: true,
      canRedo: false,
      latestUndoOperationId: "op-inline-1",
      latestRedoOperationId: null,
      invalidation: {
        kind: "range",
        range: { start: 1, end: 1 },
        reason: "server-demo-edits",
      },
    })
  })

  it("includes the shared history scope when posting inline edits", async () => {
    const scope = createServerDemoHistoryScope({
      user_id: "user-1",
    })
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      operationId: "op-inline-scope",
      committed: [{ rowId: "srv-000001", columnId: "name", revision: "rev-row-scope" }],
      committedRowIds: ["srv-000001"],
      rejected: [],
      revision: "rev-global-scope",
      invalidation: null,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl, historyScope: scope })
    await adapter.commitEdits!({
      edits: [{ rowId: "srv-000001", data: { name: "Scoped Name" } }],
    })

    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      workspace_id: scope.workspace_id,
      table_id: scope.table_id,
      user_id: scope.user_id ?? null,
      session_id: scope.session_id,
      edits: [
        { rowId: "srv-000001", columnId: "name", value: "Scoped Name" },
      ],
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
    expect(result).toMatchObject({
      operationId: "op-readonly-1",
      committed: [],
      rejected: [{ rowId: "srv-000004", reason: "id: readonly-column" }],
      revision: "rev-global-3",
      invalidation: null,
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

    expect(result).toMatchObject({
      operationId: "op-partial-1",
      committed: [{ rowId: "srv-000005", revision: "rev-global-4" }],
      rejected: [{ rowId: "srv-000006", reason: "status: invalid-enum-value" }],
      revision: "rev-global-4",
      invalidation: {
        kind: "range",
        range: { start: 5, end: 5 },
        reason: "server-demo-edits",
      },
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

  it("normalizes row invalidation payloads from the backend", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      operationId: "op-inline-rows",
      committed: [{ rowId: "srv-000008", columnId: "name", revision: "rev-row-8" }],
      committedRowIds: ["srv-000008"],
      rejected: [],
      revision: "rev-global-8",
      invalidation: {
        kind: "rows",
        rowIds: ["srv-000008", "srv-000009"],
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
      edits: [{ rowId: "srv-000008", data: { name: "Rows Payload" } }],
    })

    expect(result.invalidation).toEqual({
      kind: "rows",
      rowIds: ["srv-000008", "srv-000009"],
      reason: "server-demo-edits",
    })
  })

  it("posts fill boundary requests to the backend and maps the response", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      endRowIndex: 19,
      endRowId: "srv-000019",
      boundaryKind: "cache-boundary",
      scannedRowCount: 3,
      truncated: true,
      revision: "rev-boundary-1",
      projectionHash: "hash-boundary-1",
      boundaryToken: "token-boundary-1",
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ baseUrl: "http://localhost:8000", fetchImpl })
    const result = await adapter.resolveFillBoundary!({
      direction: "down",
      baseRange: { start: 10, end: 10 },
      fillColumns: ["name"],
      referenceColumns: ["name"],
      projection: createFillProjection(),
      startRowIndex: 11,
      startColumnIndex: 0,
      limit: 3,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("http://localhost:8000/api/server-demo/fill-boundary")
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      direction: "down",
      baseRange: { startRow: 10, endRow: 10, startColumn: 0, endColumn: 0 },
      fillColumns: ["name"],
      referenceColumns: ["name"],
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
            pageSize: 50,
            currentPage: 0,
            pageCount: 0,
            totalRowCount: 0,
            startIndex: 0,
            endIndex: 49,
          },
          cursor: null,
        },
      },
      startRowIndex: 11,
      startColumnIndex: 0,
      limit: 3,
    })
    expect(result).toEqual({
      endRowIndex: 19,
      endRowId: "srv-000019",
      boundaryKind: "cache-boundary",
      scannedRowCount: 3,
      truncated: true,
      revision: "rev-boundary-1",
      projectionHash: "hash-boundary-1",
      boundaryToken: "token-boundary-1",
    })
  })

  it("posts fill commit requests to the backend and preserves the operation id", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      operationId: "fill-123",
      affectedRowCount: 2,
      affectedCellCount: 4,
      affectedRows: 2,
      affectedCells: 4,
      canUndo: true,
      canRedo: false,
      latestUndoOperationId: "fill-123",
      latestRedoOperationId: null,
      revision: "rev-fill-1",
      invalidation: {
        kind: "range",
        range: { start: 11, end: 12 },
        reason: "server-demo-fill",
      },
      warnings: ["server fill committed"],
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ baseUrl: "http://localhost:8000", fetchImpl })
    const result = await adapter.commitFillOperation!({
      operationId: "fill-123",
      revision: "rev-before",
      baseRevision: "rev-boundary-1",
      projectionHash: "hash-boundary-1",
      boundaryToken: "token-boundary-1",
      projection: createFillProjection(),
      sourceRange: { start: 10, end: 11 },
      targetRange: { start: 12, end: 15 },
      sourceRowIds: ["srv-000010", "srv-000011"],
      targetRowIds: ["srv-000012", "srv-000013", "srv-000014", "srv-000015"],
      fillColumns: ["status", "region"],
      referenceColumns: ["status", "region"],
      mode: "copy",
      metadata: {
        origin: "double-click-fill",
        behaviorSource: "default",
      },
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("http://localhost:8000/api/server-demo/fill/commit")
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      operationId: "fill-123",
      revision: "rev-before",
      baseRevision: "rev-boundary-1",
      projectionHash: "hash-boundary-1",
      boundaryToken: "token-boundary-1",
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
            pageSize: 50,
            currentPage: 0,
            pageCount: 0,
            totalRowCount: 0,
            startIndex: 0,
            endIndex: 49,
          },
          cursor: null,
        },
      },
      sourceRange: { startRow: 10, endRow: 11, startColumn: 0, endColumn: 0 },
      targetRange: { startRow: 12, endRow: 15, startColumn: 0, endColumn: 0 },
      fillColumns: ["status", "region"],
      referenceColumns: ["status", "region"],
      mode: "copy",
      sourceRowIds: ["srv-000010", "srv-000011"],
      targetRowIds: ["srv-000012", "srv-000013", "srv-000014", "srv-000015"],
      metadata: {
        origin: "double-click-fill",
        behaviorSource: "default",
      },
    })
    expect(result).toMatchObject({
      operationId: "fill-123",
      affectedRowCount: 2,
      affectedCellCount: 4,
      affectedRows: 2,
      affectedCells: 4,
      canUndo: true,
      canRedo: false,
      latestUndoOperationId: "fill-123",
      latestRedoOperationId: null,
      revision: "rev-fill-1",
      invalidation: {
        kind: "range",
        range: { start: 11, end: 12 },
        reason: "server-demo-fill",
      },
      serverInvalidation: {
        type: "range",
        range: {
          startRow: 11,
          endRow: 12,
          startColumn: null,
          endColumn: null,
        },
      },
      warnings: ["server fill committed"],
    })
  })

  it("includes the shared history scope when posting fill commits", async () => {
    const scope = createServerDemoHistoryScope({
      user_id: "user-1",
    })
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      operationId: "fill-scope",
      affectedRowCount: 2,
      affectedCellCount: 4,
      revision: "rev-fill-scope",
      invalidation: null,
      warnings: [],
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl, historyScope: scope })
    await adapter.commitFillOperation!({
      operationId: "fill-scope",
      revision: "rev-before",
      baseRevision: "rev-boundary-1",
      projectionHash: "hash-boundary-1",
      boundaryToken: "token-boundary-1",
      projection: createFillProjection(),
      sourceRange: { start: 10, end: 11 },
      targetRange: { start: 12, end: 15 },
      sourceRowIds: ["srv-000010", "srv-000011"],
      targetRowIds: ["srv-000012", "srv-000013", "srv-000014", "srv-000015"],
      fillColumns: ["status", "region"],
      referenceColumns: ["status", "region"],
      mode: "copy",
      metadata: {
        origin: "double-click-fill",
        behaviorSource: "default",
      },
    })

    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      operationId: "fill-scope",
      workspace_id: scope.workspace_id,
      table_id: scope.table_id,
      user_id: scope.user_id ?? null,
      session_id: scope.session_id,
      revision: "rev-before",
      baseRevision: "rev-boundary-1",
      projectionHash: "hash-boundary-1",
      boundaryToken: "token-boundary-1",
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
            pageSize: 50,
            currentPage: 0,
            pageCount: 0,
            totalRowCount: 0,
            startIndex: 0,
            endIndex: 49,
          },
          cursor: null,
        },
      },
      sourceRange: { startRow: 10, endRow: 11, startColumn: 0, endColumn: 0 },
      targetRange: { startRow: 12, endRow: 15, startColumn: 0, endColumn: 0 },
      fillColumns: ["status", "region"],
      referenceColumns: ["status", "region"],
      mode: "copy",
      sourceRowIds: ["srv-000010", "srv-000011"],
      targetRowIds: ["srv-000012", "srv-000013", "srv-000014", "srv-000015"],
      metadata: {
        origin: "double-click-fill",
        behaviorSource: "default",
      },
    })
  })

  it("downgrades unsupported series fill commit requests to copy before posting", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      operationId: "fill-series-as-copy",
      affectedRowCount: 2,
      affectedCellCount: 2,
      revision: "rev-fill-copy",
      invalidation: {
        kind: "range",
        range: { start: 10, end: 12 },
        reason: "server-demo-fill",
      },
      warnings: [],
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    await adapter.commitFillOperation!({
      operationId: "fill-series-as-copy",
      projection: createFillProjection(),
      sourceRange: { start: 10, end: 10 },
      targetRange: { start: 10, end: 12 },
      sourceRowIds: ["srv-000010"],
      targetRowIds: ["srv-000010", "srv-000011", "srv-000012"],
      fillColumns: ["status"],
      referenceColumns: ["status"],
      mode: "series",
      metadata: {
        origin: "double-click-fill",
        behaviorSource: "default",
      },
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))
    expect(body).toMatchObject({
      operationId: "fill-series-as-copy",
      mode: "copy",
      sourceRowIds: ["srv-000010"],
      targetRowIds: ["srv-000010", "srv-000011", "srv-000012"],
      fillColumns: ["status"],
      referenceColumns: ["status"],
    })
    expect(body.mode).not.toBe("series")
  })

  it("maps fill commit no-op responses with explicit zero affected cells and warning", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      operationId: null,
      affectedRowCount: 0,
      affectedCellCount: 0,
      revision: "rev-fill-noop",
      invalidation: null,
      warnings: ["server fill no-op"],
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })
    const result = await adapter.commitFillOperation!({
      operationId: "fill-noop",
      revision: "rev-before",
      projection: createFillProjection(),
      sourceRange: { start: 10, end: 10 },
      targetRange: { start: 10, end: 10 },
      sourceRowIds: ["srv-000010"],
      targetRowIds: ["srv-000010"],
      fillColumns: ["status"],
      referenceColumns: ["status"],
      mode: "copy",
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      operationId: "fill-noop",
      sourceRowIds: ["srv-000010"],
      targetRowIds: ["srv-000010"],
      fillColumns: ["status"],
      referenceColumns: ["status"],
      mode: "copy",
    })
    expect(result).toMatchObject({
      operationId: "fill-noop",
      affectedRowCount: 0,
      affectedCellCount: 0,
      affectedRows: 0,
      affectedCells: 0,
      canUndo: undefined,
      canRedo: undefined,
      latestUndoOperationId: null,
      latestRedoOperationId: null,
      revision: "rev-fill-noop",
      invalidation: null,
      warnings: ["server fill no-op"],
    })
  })

  it("surfaces fill commit 409 errors through the existing HTTP error path", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      code: "stale-revision",
      message: "Fill commit revision is stale",
    }), {
      status: 409,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ fetchImpl })

    await expect(adapter.commitFillOperation!({
      operationId: "fill-409",
      projection: createFillProjection(),
      sourceRange: { start: 10, end: 10 },
      targetRange: { start: 10, end: 11 },
      sourceRowIds: ["srv-000010"],
      targetRowIds: ["srv-000010", "srv-000011"],
      fillColumns: ["status"],
      referenceColumns: ["status"],
      mode: "copy",
    })).rejects.toMatchObject({
      name: "ServerDemoHttpError",
      status: 409,
      code: "stale-revision",
      message: "Fill commit revision is stale",
    })
  })

  it("routes fill undo and redo through the shared operation endpoints", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      committed: [{ rowId: "srv-000012", columnId: "status", revision: "rev-fill-undo" }],
      committedRowIds: ["srv-000012"],
      rejected: [],
      revision: "rev-fill-undo",
      invalidation: {
        kind: "range",
        range: { start: 12, end: 12 },
        reason: "server-demo-fill",
      },
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }))

    const adapter = createServerDemoDatasourceHttpAdapter({ baseUrl: "http://localhost:8000", fetchImpl })
    await adapter.undoFillOperation!({
      operationId: "fill-123",
      revision: "rev-fill-undo",
      projection: createFillProjection(),
    })
    await adapter.redoFillOperation!({
      operationId: "fill-123",
      revision: "rev-fill-undo",
      projection: createFillProjection(),
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("http://localhost:8000/api/server-demo/operations/fill-123/undo")
    expect(fetchImpl.mock.calls[1]?.[0]).toBe("http://localhost:8000/api/server-demo/operations/fill-123/redo")
  })

  it("routes stack undo and redo through the history endpoints with scoped payloads", async () => {
    const scope = createServerDemoHistoryScope({
      user_id: "user-1",
    })
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
      const action = String(String(_url).includes("/redo") ? "redo" : "undo")
      return new Response(JSON.stringify({
        operationId: `${action}-stack-123`,
        action,
        canUndo: action === "undo",
        canRedo: action === "redo",
        affectedRows: 2,
        affectedCells: 3,
        committed: [],
        committedRowIds: [],
        rejected: [],
        revision: "rev-history-stack",
        rows: [
          {
            id: "srv-000010",
            index: 10,
            name: `${action === "undo" ? "Undo" : "Redo"} Row`,
            segment: "Growth",
            status: "Active",
            region: "EMEA",
            value: 10,
            updatedAt: "2025-01-01T00:00:10Z",
          },
        ],
        invalidation: {
          kind: "range",
          range: { start: 10, end: 12 },
          reason: "server-demo-history",
        },
        body,
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    })

    const adapter = createServerDemoDatasourceHttpAdapter({ baseUrl: "http://localhost:8000", fetchImpl })
    const undoResult = await adapter.undoHistoryStack!({
      ...scope,
    })
    const redoResult = await adapter.redoHistoryStack!({
      ...scope,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("http://localhost:8000/api/history/undo")
    expect(fetchImpl.mock.calls[1]?.[0]).toBe("http://localhost:8000/api/history/redo")
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body ?? "{}"))).toMatchObject({
      ...scope,
    })
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body ?? "{}"))).toMatchObject({
      workspace_id: scope.workspace_id,
      table_id: scope.table_id,
      session_id: scope.session_id,
    })
    expect(undoResult).toMatchObject({
      operationId: "undo-stack-123",
      action: "undo",
      canUndo: true,
      canRedo: false,
      affectedRows: 2,
      affectedCells: 3,
      rows: [
        {
          id: "srv-000010",
          index: 10,
          name: "Undo Row",
          segment: "Growth",
          status: "Active",
          region: "EMEA",
          value: 10,
          updatedAt: "2025-01-01T00:00:10Z",
        },
      ],
    })
    expect(redoResult).toMatchObject({
      operationId: "redo-stack-123",
      action: "redo",
      canUndo: false,
      canRedo: true,
      affectedRows: 2,
      affectedCells: 3,
      rows: [
        {
          id: "srv-000010",
          index: 10,
          name: "Redo Row",
          segment: "Growth",
          status: "Active",
          region: "EMEA",
          value: 10,
          updatedAt: "2025-01-01T00:00:10Z",
        },
      ],
    })
  })

  it("routes history status through the status endpoint with scoped payloads", async () => {
    const scope = createServerDemoHistoryScope({
      user_id: "user-1",
    })
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
      return new Response(JSON.stringify({
        workspace_id: body.workspace_id,
        table_id: body.table_id,
        user_id: body.user_id ?? null,
        session_id: body.session_id ?? null,
        canUndo: true,
        canRedo: false,
        latestUndoOperationId: "status-undo-1",
        latestRedoOperationId: null,
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    })

    const adapter = createServerDemoDatasourceHttpAdapter({ baseUrl: "http://localhost:8000", fetchImpl })
    const result = await adapter.getHistoryStatus!({
      ...scope,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("http://localhost:8000/api/history/status")
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body ?? "{}"))).toMatchObject({
      ...scope,
    })
    expect(result).toMatchObject({
      ...scope,
      canUndo: true,
      canRedo: false,
      latestUndoOperationId: "status-undo-1",
      latestRedoOperationId: null,
    })
  })
})
