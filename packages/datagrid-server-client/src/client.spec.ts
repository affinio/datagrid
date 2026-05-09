import { describe, expect, it, vi } from "vitest"
import type {
  DataGridDataSourcePullRequest,
  DataGridDataSourceRowEntry,
} from "@affino/datagrid-core"
import { createServerDatasourceHttpClient } from "./client"

function createResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })
}

function createPullRequest(start = 0): DataGridDataSourcePullRequest {
  return {
    range: { start, end: start },
    priority: "normal",
    reason: "manual",
    signal: new AbortController().signal,
    sortModel: [],
    filterModel: null,
    groupBy: null,
    groupExpansion: { expanded: [] },
    treeData: null,
    pivot: null,
    pagination: { enabled: false },
  }
}

function createClient(
  fetchImpl: typeof fetch,
  mapPullRequest?: (request: DataGridDataSourcePullRequest) => unknown,
) {
  return createServerDatasourceHttpClient({
    fetchImpl,
    endpoints: {
      pull: "/pull",
      histogram: "/histogram",
      commitEdits: "/edits",
      resolveFillBoundary: "/fill-boundary",
      commitFillOperation: "/fill/commit",
      undoOperation: operationId => `/operations/${operationId}/undo`,
      redoOperation: operationId => `/operations/${operationId}/redo`,
      historyStatus: "/history/status",
      changesSinceVersion: sinceVersion => `/changes?sinceVersion=${sinceVersion}`,
    },
    mapPullRequest: mapPullRequest ?? (request => ({
      range: request.range,
      priority: request.priority,
      reason: request.reason,
      sortModel: request.sortModel,
      filterModel: request.filterModel,
      groupBy: request.groupBy,
      groupExpansion: request.groupExpansion,
      treeData: request.treeData,
      pivot: request.pivot,
      pagination: request.pagination,
    })),
    mapPullResponse: response => {
      const parsed = response as {
        rows?: readonly { id: string; index: number; name: string }[]
        total?: number
        revision?: string | number | null
        datasetVersion?: number | null
      }
      return {
        rows: (parsed.rows ?? []).map(row => ({
          index: row.index,
          rowId: row.id,
          row,
        })) as readonly DataGridDataSourceRowEntry<{ id: string; index: number; name: string }>[],
        total: parsed.total ?? 0,
        revision: parsed.revision ?? null,
        datasetVersion: parsed.datasetVersion ?? null,
      }
    },
  })
}

describe("createServerDatasourceHttpClient", () => {
  it("pulls rows, updates datasetVersion, and applies row snapshots", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const resolvedUrl = String(url)
      if (resolvedUrl.includes("/pull")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
        expect(body.signal).toBeUndefined()
        return createResponse({
          rows: [
            { id: "row-1", index: 4, name: "Row 1" },
          ],
          total: 1,
          revision: "7",
          datasetVersion: 7,
        })
      }
      throw new Error(`unexpected request: ${resolvedUrl}`)
    })

    const client = createClient(fetchImpl)
    const pushed: unknown[] = []
    const unsubscribe = client.subscribe!(event => {
      pushed.push(event)
    })

    const result = await client.pull(createPullRequest(4))

    expect(result.rows).toEqual([
      {
        index: 4,
        rowId: "row-1",
        row: { id: "row-1", index: 4, name: "Row 1" },
      },
    ])
    expect(result.datasetVersion).toBe(7)
    expect(client.latestDatasetVersion).toBe(7)
    expect(client.lastSeenVersion).toBe(7)

    expect(client.applyRowSnapshots([
      { id: "row-2", index: 8, name: "Row 2" },
    ])).toBe(true)
    expect(pushed).toContainEqual({
      type: "upsert",
      rows: [
        {
          index: 8,
          rowId: "row-2",
          row: { id: "row-2", index: 8, name: "Row 2" },
        },
      ],
    })

    unsubscribe()
  })

  it("keeps quick filter inside the serialized filterModel", async () => {
    const bodies: unknown[] = []
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? "{}")))
      return createResponse({
        rows: [],
        total: 0,
        revision: "8",
        datasetVersion: 8,
      })
    })
    const client = createClient(fetchImpl)
    const request = createPullRequest(0)
    request.reason = "filter-change"
    request.filterModel = {
      columnFilters: {},
      advancedFilters: {},
      quickFilter: {
        query: " platform ",
        columns: [" owner ", "owner", ""],
        mode: "tokens",
      },
    }

    await client.pull(request)

    expect(bodies[0]).toMatchObject({
      reason: "filter-change",
      filterModel: {
        quickFilter: {
          query: " platform ",
          columns: [" owner ", "owner", ""],
          mode: "tokens",
        },
      },
    })
  })

  it("serializes caller-provided normalized query DTO without interpreting filter semantics", async () => {
    const bodies: unknown[] = []
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? "{}")))
      return createResponse({
        rows: [],
        total: 0,
        revision: "9",
        datasetVersion: 9,
      })
    })
    const normalizedQuery = {
      range: { startRow: 0, endRow: 1 },
      sortModel: [{ colId: "value", sort: "desc" }],
      filterModel: {
        columnFilters: {
          status: { kind: "valueSet", tokens: ["string:active"] },
        },
        quickFilter: {
          query: "platform",
          columns: ["owner", "service"],
          mode: "tokens",
        },
      },
      pagination: {
        pageSize: 50,
        currentPage: 0,
      },
    } as const
    const client = createClient(fetchImpl, () => normalizedQuery)

    await client.pull(createPullRequest(0))

    expect(bodies[0]).toEqual(normalizedQuery)
  })

  it.each([
    {
      label: "upsert",
      change: {
        type: "row" as const,
        invalidation: { kind: "rows", rowIds: ["row-3"], reason: "feed" },
        rows: [
          { rowId: "row-3", index: 10, row: { id: "row-3", index: 10, name: "Row 3" } },
        ],
      },
      expected: {
        type: "upsert",
        rows: [
          {
            index: 10,
            rowId: "row-3",
            row: { id: "row-3", index: 10, name: "Row 3" },
          },
        ],
      },
    },
    {
      label: "invalidate",
      change: {
        type: "dataset" as const,
        invalidation: { kind: "all", reason: "feed" },
      },
      expected: {
        type: "invalidate",
        invalidation: { kind: "all", reason: "change-feed" },
      },
    },
  ])("polls and emits $label change-feed events", async ({ change, expected }) => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const resolvedUrl = String(url)
      if (resolvedUrl.includes("/changes")) {
        return createResponse({
          datasetVersion: 9,
          changes: [change],
        })
      }
      throw new Error(`unexpected request: ${resolvedUrl}`)
    })

    try {
      const client = createClient(fetchImpl)
      const pushed: unknown[] = []
      const unsubscribe = client.subscribe!(event => {
        pushed.push(event)
      })

      client.startChangeFeedPolling({ intervalMs: 250 })
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()

      expect(pushed).toContainEqual({
        ...expected,
        datasetVersion: 9,
      })
      expect(client.latestDatasetVersion).toBe(9)
      expect(client.lastSeenVersion).toBe(9)
      expect(client.getChangeFeedDiagnostics()).toMatchObject({
        polling: true,
        pending: false,
        appliedChanges: 1,
      })

      client.stopChangeFeedPolling()
      unsubscribe()
    } finally {
      vi.useRealTimers()
    }
  })

  it("stops polling by aborting the in-flight request and not scheduling overlaps", async () => {
    vi.useFakeTimers()
    const abortSignals: AbortSignal[] = []
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const resolvedUrl = String(url)
      if (resolvedUrl.includes("/changes")) {
        abortSignals.push(init?.signal as AbortSignal)
        await new Promise<void>((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined
          if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"))
            return
          }
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"))
          }, { once: true })
        })
        return createResponse({
          datasetVersion: 4,
          changes: [],
        })
      }
      throw new Error(`unexpected request: ${resolvedUrl}`)
    })

    try {
      const client = createClient(fetchImpl)
      client.startChangeFeedPolling({ intervalMs: 250 })
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()
      expect(fetchImpl).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(250)
      await Promise.resolve()
      expect(fetchImpl).toHaveBeenCalledTimes(1)

      client.stopChangeFeedPolling()
      expect(abortSignals[0]?.aborted).toBe(true)
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(250)
      await Promise.resolve()
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
