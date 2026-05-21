import { describe, expect, it, vi } from "vitest"
import {
  createClientRowModel,
  createDataGridServerPivotRowId,
  createDataSourceBackedRowModel,
} from "../index"
import type {
  DataGridDataSource,
  DataGridDataSourceCommitEditsRequest,
  DataGridDataSourceColumnHistogramRequest,
  DataGridDataSourcePullRequest,
  DataGridDataSourcePullResult,
  DataGridDataSourcePushListener,
} from "../server/dataSourceProtocol"
import type { DataGridFilterSnapshot } from "../rowModel"

interface PullCall<TRow> {
  request: DataGridDataSourcePullRequest
  resolve: (result: DataGridDataSourcePullResult<TRow>) => void
  reject: (reason?: unknown) => void
}

interface CommitCall<TRow> {
  request: DataGridDataSourceCommitEditsRequest<TRow>
  resolve: (result: { committed?: readonly { rowId: number | string }[]; rejected?: readonly { rowId: number | string; reason?: string }[] }) => void
  reject: (reason?: unknown) => void
}

function flushMicrotasks(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve())
}

function buildRows(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, offset) => {
    const index = start + offset
    return {
      index,
      row: { id: index, value: `row-${index}` },
    }
  })
}

function createDeferredPullDataSource<TRow>() {
  const calls: PullCall<TRow>[] = []
  const dataSource: DataGridDataSource<TRow> = {
    pull(request) {
      return new Promise<DataGridDataSourcePullResult<TRow>>((resolve, reject) => {
        calls.push({
          request,
          resolve,
          reject,
        })
      })
    },
  }
  return { calls, dataSource }
}

function createAbortableDeferredPullDataSource<TRow>() {
  const calls: PullCall<TRow>[] = []
  const dataSource: DataGridDataSource<TRow> = {
    pull(request) {
      return new Promise<DataGridDataSourcePullResult<TRow>>((resolve, reject) => {
        const call: PullCall<TRow> = {
          request,
          resolve,
          reject,
        }
        calls.push(call)
        request.signal.addEventListener("abort", () => {
          reject({ name: "AbortError" })
        })
      })
    },
  }
  return { calls, dataSource }
}

function createDeferredCommitEdits<TRow>() {
  const calls: CommitCall<TRow>[] = []
  const commitEdits = vi.fn((request: DataGridDataSourceCommitEditsRequest<TRow>) => {
    return new Promise<{ committed?: readonly { rowId: number | string }[]; rejected?: readonly { rowId: number | string; reason?: string }[] }>((resolve, reject) => {
      calls.push({
        request,
        resolve,
        reject,
      })
    })
  })
  return { calls, commitEdits }
}

describe("createDataSourceBackedRowModel", () => {
  it("delegates column histograms to the data source with effective filter context", async () => {
    const histogramRequests: DataGridDataSourceColumnHistogramRequest[] = []
    const dataSource: DataGridDataSource<{ id: number; status: string; owner: string }> = {
      async pull() {
        return { rows: [], total: 2 }
      },
      async getColumnHistogram(request) {
        histogramRequests.push(request)
        return [
          { token: "string:active", value: "Active", count: 2, text: "Active" },
          { token: "", value: "ignored", count: 1 },
        ]
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 2,
      initialFilterModel: {
        columnFilters: {
          status: { kind: "valueSet", tokens: ["string:blocked"] },
          owner: { kind: "valueSet", tokens: ["string:noc"] },
        },
        columnStyleFilters: {
          status: { kind: "styleValueSet", styleKey: "backgroundColor", tokens: ["string:#fff"] },
        },
        advancedFilters: {
          status: { type: "text", clauses: [{ operator: "contains", value: "Blocked" }] },
        },
      },
    })

    expect(typeof model.getColumnHistogram).toBe("function")

    const getColumnHistogram = model.getColumnHistogram
    const histogram = getColumnHistogram
      ? await getColumnHistogram("status", {
          ignoreSelfFilter: true,
          orderBy: "valueAsc",
          search: " active ",
        })
      : null

    expect(histogram).toEqual([
      { token: "string:active", value: "Active", count: 2, text: "Active" },
    ])
    expect(histogramRequests).toHaveLength(1)
    expect(histogramRequests[0]?.columnId).toBe("status")
    expect(histogramRequests[0]?.options).toMatchObject({
      ignoreSelfFilter: true,
      orderBy: "valueAsc",
      search: "active",
    })
    expect(histogramRequests[0]?.filterModel?.columnFilters).toEqual({
      owner: { kind: "valueSet", tokens: ["string:noc"] },
    })
    expect(histogramRequests[0]?.filterModel?.columnStyleFilters).toEqual({})
    expect(histogramRequests[0]?.filterModel?.advancedFilters).toEqual({})

    model.dispose()
  })

  it("reports initialLoading while the first critical pull is pending", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 0,
    })

    model.setViewportRange({ start: 0, end: 0 })

    expect(calls).toHaveLength(1)
    expect(model.getSnapshot().initialLoading).toBe(true)
    expect(model.getSnapshot().refreshing).toBe(false)
    expect(model.getSnapshot().loading).toBe(true)

    model.dispose()
  })

  it("does not refetch the viewport after a resolved empty total", async () => {
    const calls: DataGridDataSourcePullRequest[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull(request) {
        calls.push(request)
        return {
          rows: [],
          total: 0,
          cursor: "rev-empty",
        }
      },
    }
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 100,
      prefetch: {
        enabled: false,
      },
    })

    model.setViewportRange({ start: 0, end: 24 })
    await flushMicrotasks()

    expect(calls).toHaveLength(1)
    expect(model.getSnapshot()).toMatchObject({
      rowCount: 0,
      error: null,
    })

    model.setViewportRange({ start: 0, end: 24 })
    model.setViewportRange({ start: 5, end: 29 })
    await flushMicrotasks()

    expect(calls).toHaveLength(1)

    model.dispose()
  })

  it("keeps previously cached viewport rows readable while a new viewport pull is pending", async () => {
    const { calls, dataSource } = createAbortableDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 20,
      prefetch: {
        enabled: false,
      },
    })

    model.setViewportRange({ start: 0, end: 2 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: buildRows(0, 2),
      total: 20,
    })
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 2 })?.map(row => row.row.value)).toEqual([
      "row-0",
      "row-1",
      "row-2",
    ])

    model.setViewportRange({ start: 10, end: 12 })
    expect(calls).toHaveLength(2)
    expect(model.getSnapshot().loading).toBe(true)
    expect(model.getRow(0)?.row.value).toBe("row-0")
    expect(model.getRow(1)?.row.value).toBe("row-1")
    expect(model.getRow(2)?.row.value).toBe("row-2")
    expect(model.getSparseRowModelDiagnostics().cachedRowCount).toBeGreaterThanOrEqual(3)

    model.dispose()
  })

  it("keeps partially cached viewport rows readable while missing rows load", async () => {
    const { calls, dataSource } = createAbortableDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 20,
      prefetch: {
        enabled: false,
      },
    })

    model.setViewportRange({ start: 1, end: 2 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: buildRows(1, 2),
      total: 20,
    })
    await flushMicrotasks()

    model.setViewportRange({ start: 1, end: 5 })
    expect(calls).toHaveLength(2)
    expect(model.getRow(1)?.row.value).toBe("row-1")
    expect(model.getRow(2)?.row.value).toBe("row-2")
    expect(model.getRow(3)).toBeUndefined()
    expect(model.getRow(4)).toBeUndefined()
    expect(model.getRow(5)).toBeUndefined()

    model.dispose()
  })

  it("returns stable loading rows for missing indexes in a pending viewport range", async () => {
    const { calls, dataSource } = createAbortableDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 20,
      prefetch: {
        enabled: false,
      },
    })

    model.setViewportRange({ start: 1, end: 2 })
    calls[0]?.resolve({
      rows: buildRows(1, 2),
      total: 20,
    })
    await flushMicrotasks()

    model.setViewportRange({ start: 1, end: 5 })
    expect(calls).toHaveLength(2)

    const rows = model.getRowsInRange({ start: 1, end: 5 })
    expect(rows).toHaveLength(5)
    expect(rows.map(row => row.displayIndex)).toEqual([1, 2, 3, 4, 5])
    expect(rows.slice(0, 2).map(row => row.row.value)).toEqual(["row-1", "row-2"])
    expect(rows.slice(2).map(row => String(row.rowId))).toEqual([
      "__affino_datagrid_data_source_loading__:3",
      "__affino_datagrid_data_source_loading__:4",
      "__affino_datagrid_data_source_loading__:5",
    ])
    expect(rows.slice(2).map(row => (row as { __placeholder?: boolean }).__placeholder)).toEqual([
      true,
      true,
      true,
    ])
    expect(rows.slice(2).map(row => row.row.value)).toEqual([undefined, undefined, undefined])
    expect(rows.slice(2).map(row => (row.row as Record<string, unknown>).__affinoDataGridDataSourceRowStatus)).toEqual([
      "loading",
      "loading",
      "loading",
    ])
    expect(model.getSparseRowModelDiagnostics()).toMatchObject({
      viewportRowCount: 5,
      viewportLoadedRowCount: 2,
      viewportLoadingRowCount: 3,
      viewportLoadingRowRatio: 0.6,
    })

    model.dispose()
  })

  it("applies resolved viewport rows after the pending pull completes", async () => {
    const { calls, dataSource } = createAbortableDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 20,
      prefetch: {
        enabled: false,
      },
    })

    model.setViewportRange({ start: 1, end: 2 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: buildRows(1, 2),
      total: 20,
    })
    await flushMicrotasks()

    model.setViewportRange({ start: 1, end: 5 })
    expect(calls).toHaveLength(2)

    calls[1]?.resolve({
      rows: buildRows(1, 5),
      total: 20,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getRow(1)?.row.value).toBe("row-1")
    expect(model.getRow(2)?.row.value).toBe("row-2")
    expect(model.getRow(3)?.row.value).toBe("row-3")
    expect(model.getRow(4)?.row.value).toBe("row-4")
    expect(model.getRow(5)?.row.value).toBe("row-5")

    model.dispose()
  })

  it("reports refreshing while a sort refresh is pending with cached rows present", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 2,
    })

    model.setViewportRange({ start: 0, end: 1 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: [
        { index: 0, row: { id: 1, value: "row-1" }, rowId: 1 },
        { index: 1, row: { id: 2, value: "row-2" }, rowId: 2 },
      ],
      total: 2,
    })
    await flushMicrotasks()

    model.setSortModel([{ key: "value", direction: "asc" }])

    expect(calls).toHaveLength(2)
    expect(model.getSnapshot().initialLoading).toBe(false)
    expect(model.getSnapshot().refreshing).toBe(true)
    expect(model.getSnapshot().loading).toBe(true)

    model.dispose()
  })

  it("keeps loaded rows visible, marks failed missing rows as error, and retries the viewport", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 20,
      prefetch: {
        enabled: false,
      },
    })

    model.setViewportRange({ start: 0, end: 2 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: buildRows(0, 2),
      total: 20,
    })
    await flushMicrotasks()

    model.setViewportRange({ start: 0, end: 5 })
    expect(calls).toHaveLength(2)
    calls[1]?.reject(new Error("viewport failed"))
    await flushMicrotasks()
    await flushMicrotasks()

    const failedRows = model.getRowsInRange({ start: 0, end: 5 })
    expect(failedRows.map(row => row.displayIndex)).toEqual([0, 1, 2, 3, 4, 5])
    expect(failedRows.slice(0, 3).map(row => row.row.value)).toEqual(["row-0", "row-1", "row-2"])
    expect(failedRows.slice(3).map(row => (row.row as Record<string, unknown>).__affinoDataGridDataSourceRowStatus)).toEqual([
      "error",
      "error",
      "error",
    ])
    expect(model.getSnapshot().error?.message).toBe("viewport failed")

    model.setViewportRange({ start: 0, end: 5 })
    expect(calls).toHaveLength(3)
    const retryRows = model.getRowsInRange({ start: 0, end: 5 })
    expect(retryRows.slice(3).map(row => (row.row as Record<string, unknown>).__affinoDataGridDataSourceRowStatus)).toEqual([
      "loading",
      "loading",
      "loading",
    ])

    calls[2]?.resolve({
      rows: buildRows(0, 5),
      total: 20,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 5 }).map(row => row.row.value)).toEqual([
      "row-0",
      "row-1",
      "row-2",
      "row-3",
      "row-4",
      "row-5",
    ])
    expect(model.getSnapshot().error).toBeNull()

    model.dispose()
  })

  it("ignores stale rejected viewport pulls after a state reset", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 20,
      prefetch: {
        enabled: false,
      },
    })

    model.setViewportRange({ start: 0, end: 2 })
    expect(calls).toHaveLength(1)

    model.setSortModel([{ key: "value", direction: "desc" }])
    expect(calls).toHaveLength(2)
    expect(calls[0]?.request.signal.aborted).toBe(true)

    calls[1]?.resolve({
      rows: [
        { index: 0, row: { id: 2, value: "sorted-2" } },
        { index: 1, row: { id: 1, value: "sorted-1" } },
      ],
      total: 2,
    })
    await flushMicrotasks()

    calls[0]?.reject(new Error("stale failed"))
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 1 }).map(row => row.row.value)).toEqual([
      "sorted-2",
      "sorted-1",
    ])
    expect(model.getSnapshot().error).toBeNull()

    model.dispose()
  })

  it("ignores stale resolved viewport pulls after a state reset", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 20,
      prefetch: {
        enabled: false,
      },
    })

    model.setViewportRange({ start: 0, end: 2 })
    expect(calls).toHaveLength(1)

    model.setSortModel([{ key: "value", direction: "desc" }])
    expect(calls).toHaveLength(2)
    expect(calls[0]?.request.signal.aborted).toBe(true)

    calls[1]?.resolve({
      rows: [
        { index: 0, row: { id: 2, value: "sorted-2" } },
        { index: 1, row: { id: 1, value: "sorted-1" } },
      ],
      total: 2,
    })
    await flushMicrotasks()

    calls[0]?.resolve({
      rows: [
        { index: 0, row: { id: 1, value: "stale-1" } },
        { index: 1, row: { id: 2, value: "stale-2" } },
        { index: 2, row: { id: 3, value: "stale-3" } },
      ],
      total: 20,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 1 }).map(row => row.row.value)).toEqual([
      "sorted-2",
      "sorted-1",
    ])
    expect(model.getSnapshot()).toMatchObject({
      rowCount: 2,
      error: null,
    })

    model.dispose()
  })

  it("clears loading flags after a pending sort refresh resolves", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 2,
    })

    model.setViewportRange({ start: 0, end: 1 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: [
        { index: 0, row: { id: 1, value: "row-1" }, rowId: 1 },
        { index: 1, row: { id: 2, value: "row-2" }, rowId: 2 },
      ],
      total: 2,
    })
    await flushMicrotasks()

    model.setSortModel([{ key: "value", direction: "asc" }])
    expect(calls).toHaveLength(2)
    expect(model.getSnapshot().initialLoading).toBe(false)
    expect(model.getSnapshot().refreshing).toBe(true)
    expect(model.getSnapshot().loading).toBe(true)

    calls[1]?.resolve({
      rows: [
        { index: 0, row: { id: 1, value: "sorted-1" }, rowId: 1 },
        { index: 1, row: { id: 2, value: "sorted-2" }, rowId: 2 },
      ],
      total: 2,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getSnapshot().initialLoading).toBe(false)
    expect(model.getSnapshot().refreshing).toBe(false)
    expect(model.getSnapshot().loading).toBe(false)

    model.dispose()
  })

  it("keeps old rows visible during pending sort refresh and swaps cache on success", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 2,
    })

    model.setViewportRange({ start: 0, end: 1 })
    expect(calls).toHaveLength(1)
    expect(model.getSnapshot().initialLoading).toBe(true)
    expect(model.getSnapshot().refreshing).toBe(false)
    calls[0]?.resolve({
      rows: [
        { index: 0, row: { id: 1, value: "old-1" }, rowId: 1 },
        { index: 1, row: { id: 2, value: "old-2" }, rowId: 2 },
      ],
      total: 2,
    })
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual(["old-1", "old-2"])
    expect(model.getSnapshot().initialLoading).toBe(false)
    expect(model.getSnapshot().refreshing).toBe(false)

    const sortModel = [{ key: "value", direction: "asc" as const, comparator: { kind: "natural" as const } }]
    model.setSortModel(sortModel)

    expect(calls).toHaveLength(2)
    expect(calls[1]?.request.sortModel).toEqual(sortModel)
    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual(["old-1", "old-2"])
    expect(model.getSnapshot().initialLoading).toBe(false)
    expect(model.getSnapshot().refreshing).toBe(true)

    calls[1]?.resolve({
      rows: [
        { index: 0, row: { id: 1, value: "sorted-1" }, rowId: 1 },
        { index: 1, row: { id: 2, value: "sorted-2" }, rowId: 2 },
      ],
      total: 2,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual(["sorted-1", "sorted-2"])
    expect(model.getSnapshot().refreshing).toBe(false)

    model.dispose()
  })

  it("retains stale visible rows after a partial sort replacement and reloads the current viewport", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 5,
    })

    model.setViewportRange({ start: 0, end: 4 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: [0, 1, 2, 3, 4].map(index => ({
        index,
        row: { id: index + 1, value: `old-${index + 1}` },
        rowId: index + 1,
      })),
      total: 5,
    })
    await flushMicrotasks()

    model.setViewportRange({ start: 0, end: 1 })
    model.setSortModel([{ key: "value", direction: "asc" }])
    expect(calls).toHaveLength(2)

    model.setViewportRange({ start: 0, end: 4 })
    expect(model.getRowsInRange({ start: 0, end: 4 })?.map(row => row.row.value)).toEqual([
      "old-1",
      "old-2",
      "old-3",
      "old-4",
      "old-5",
    ])

    calls[1]?.resolve({
      rows: [
        { index: 0, row: { id: 5, value: "sorted-1" }, rowId: 5 },
        { index: 1, row: { id: 4, value: "sorted-2" }, rowId: 4 },
      ],
      total: 5,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 4 })?.map(row => row.row.value)).toEqual([
      "sorted-1",
      "sorted-2",
      "old-3",
      "old-4",
      "old-5",
    ])
    expect(calls).toHaveLength(3)
    expect(calls[2]?.request.reason).toBe("viewport-change")
    expect(calls[2]?.request.range).toEqual({ start: 0, end: 4 })

    calls[2]?.resolve({
      rows: [0, 1, 2, 3, 4].map(index => ({
        index,
        row: { id: 5 - index, value: `sorted-full-${index + 1}` },
        rowId: 5 - index,
      })),
      total: 5,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 4 })?.map(row => row.row.value)).toEqual([
      "sorted-full-1",
      "sorted-full-2",
      "sorted-full-3",
      "sorted-full-4",
      "sorted-full-5",
    ])

    model.dispose()
  })

  it("retains visible rows when a replacement resolves after viewport direction reversal", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 10,
    })

    model.setViewportRange({ start: 0, end: 9 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(index => ({
        index,
        row: { id: index + 1, value: `old-${index + 1}` },
        rowId: index + 1,
      })),
      total: 10,
    })
    await flushMicrotasks()

    model.setViewportRange({ start: 0, end: 4 })
    model.setSortModel([{ key: "value", direction: "asc" }])
    expect(calls).toHaveLength(2)

    model.setViewportRange({ start: 5, end: 9 })
    expect(model.getRowsInRange({ start: 5, end: 9 })?.map(row => row.row.value)).toEqual([
      "old-6",
      "old-7",
      "old-8",
      "old-9",
      "old-10",
    ])

    calls[1]?.resolve({
      rows: [
        { index: 0, row: { id: 10, value: "sorted-1" }, rowId: 10 },
        { index: 1, row: { id: 9, value: "sorted-2" }, rowId: 9 },
      ],
      total: 10,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 5, end: 9 })?.map(row => row.row.value)).toEqual([
      "old-6",
      "old-7",
      "old-8",
      "old-9",
      "old-10",
    ])
    expect(calls).toHaveLength(3)
    expect(calls[2]?.request.reason).toBe("viewport-change")
    expect(calls[2]?.request.range).toEqual({ start: 5, end: 9 })

    calls[2]?.resolve({
      rows: [5, 6, 7, 8, 9].map(index => ({
        index,
        row: { id: 10 - index, value: `sorted-tail-${index + 1}` },
        rowId: 10 - index,
      })),
      total: 10,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 5, end: 9 })?.map(row => row.row.value)).toEqual([
      "sorted-tail-6",
      "sorted-tail-7",
      "sorted-tail-8",
      "sorted-tail-9",
      "sorted-tail-10",
    ])

    model.dispose()
  })

  it("retains stale visible rows after a partial replacement reload fails and retries the viewport", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 5,
    })

    model.setViewportRange({ start: 0, end: 4 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: [0, 1, 2, 3, 4].map(index => ({
        index,
        row: { id: index + 1, value: `old-${index + 1}` },
        rowId: index + 1,
      })),
      total: 5,
    })
    await flushMicrotasks()

    model.setViewportRange({ start: 0, end: 1 })
    model.setSortModel([{ key: "value", direction: "asc" }])
    expect(calls).toHaveLength(2)
    model.setViewportRange({ start: 0, end: 4 })

    calls[1]?.resolve({
      rows: [
        { index: 0, row: { id: 5, value: "sorted-1" }, rowId: 5 },
        { index: 1, row: { id: 4, value: "sorted-2" }, rowId: 4 },
      ],
      total: 5,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(calls).toHaveLength(3)
    expect(model.getRowsInRange({ start: 0, end: 4 })?.map(row => row.row.value)).toEqual([
      "sorted-1",
      "sorted-2",
      "old-3",
      "old-4",
      "old-5",
    ])

    calls[2]?.reject(new Error("viewport reload failed"))
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 4 })?.map(row => row.row.value)).toEqual([
      "sorted-1",
      "sorted-2",
      "old-3",
      "old-4",
      "old-5",
    ])
    expect(model.getSnapshot().error?.message).toBe("viewport reload failed")

    model.setViewportRange({ start: 0, end: 4 })
    expect(calls).toHaveLength(4)
    expect(calls[3]?.request.range).toEqual({ start: 0, end: 4 })

    calls[3]?.resolve({
      rows: [0, 1, 2, 3, 4].map(index => ({
        index,
        row: { id: 5 - index, value: `sorted-retry-${index + 1}` },
        rowId: 5 - index,
      })),
      total: 5,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 4 })?.map(row => row.row.value)).toEqual([
      "sorted-retry-1",
      "sorted-retry-2",
      "sorted-retry-3",
      "sorted-retry-4",
      "sorted-retry-5",
    ])
    expect(model.getSnapshot().error).toBeNull()

    model.dispose()
  })

  it("keeps visible rows during manual refresh failure and retry", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 5,
    })

    model.setViewportRange({ start: 0, end: 4 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: [0, 1, 2, 3, 4].map(index => ({
        index,
        row: { id: index + 1, value: `old-${index + 1}` },
        rowId: index + 1,
      })),
      total: 5,
    })
    await flushMicrotasks()

    const refresh = model.refresh("manual")
    expect(calls).toHaveLength(2)
    expect(model.getRowsInRange({ start: 0, end: 4 })?.map(row => row.row.value)).toEqual([
      "old-1",
      "old-2",
      "old-3",
      "old-4",
      "old-5",
    ])

    calls[1]?.reject(new Error("manual refresh failed"))
    await refresh.catch(() => {})
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 4 })?.map(row => row.row.value)).toEqual([
      "old-1",
      "old-2",
      "old-3",
      "old-4",
      "old-5",
    ])
    expect(model.getSnapshot().error?.message).toBe("manual refresh failed")

    const retry = model.refresh("manual")
    expect(calls).toHaveLength(3)
    calls[2]?.resolve({
      rows: [0, 1, 2, 3, 4].map(index => ({
        index,
        row: { id: index + 1, value: `fresh-${index + 1}` },
        rowId: index + 1,
      })),
      total: 5,
    })
    await retry
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 4 })?.map(row => row.row.value)).toEqual([
      "fresh-1",
      "fresh-2",
      "fresh-3",
      "fresh-4",
      "fresh-5",
    ])
    expect(model.getSnapshot().error).toBeNull()

    model.dispose()
  })

  it("tracks placeholder exposure and viewport data availability telemetry", async () => {
    const now = vi.spyOn(globalThis.performance, "now")
    now.mockReturnValue(0)
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 4,
    })

    model.setViewportRange({ start: 0, end: 3 })
    expect(calls).toHaveLength(1)
    expect(model.getSparseRowModelDiagnostics()).toMatchObject({
      placeholderExposureActiveRows: 4,
      placeholderExposureEvents: 0,
      viewportDataAvailabilityEvents: 0,
      viewportCacheHitRows: 0,
      viewportCacheMissRows: 4,
      viewportCacheHitRatio: 0,
      blankViewportActive: true,
      blankViewportEvents: 1,
      pullDurationEvents: 0,
    })

    now.mockReturnValue(25)
    calls[0]?.resolve({
      rows: [
        { index: 0, row: { id: 1, value: "row-1" }, rowId: 1 },
        { index: 1, row: { id: 2, value: "row-2" }, rowId: 2 },
        { index: 2, row: { id: 3, value: "row-3" }, rowId: 3 },
        { index: 3, row: { id: 4, value: "row-4" }, rowId: 4 },
      ],
      total: 4,
    })
    await flushMicrotasks()

    expect(model.getSparseRowModelDiagnostics()).toMatchObject({
      placeholderExposureActiveRows: 0,
      placeholderExposureEvents: 4,
      placeholderExposureTotalMs: 100,
      placeholderExposureMaxMs: 25,
      placeholderExposureLastMs: 25,
      viewportDataAvailabilityEvents: 1,
      viewportDataAvailabilityTotalMs: 25,
      viewportDataAvailabilityMaxMs: 25,
      viewportDataAvailabilityLastMs: 25,
      viewportCacheHitRows: 4,
      viewportCacheMissRows: 0,
      viewportCacheHitRatio: 1,
      blankViewportActive: false,
      blankViewportEvents: 1,
      pullDurationEvents: 1,
      pullDurationTotalMs: 25,
      pullDurationMaxMs: 25,
      pullDurationLastMs: 25,
    })
    expect(model.getBackpressureDiagnostics()).toMatchObject({
      placeholderExposureEvents: 4,
      viewportDataAvailabilityEvents: 1,
      blankViewportEvents: 1,
      pullDurationEvents: 1,
    })

    model.dispose()
    now.mockRestore()
  })

  it("keeps old rows visible during pending filter refresh and swaps cache on success", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string; status: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 2,
    })

    model.setViewportRange({ start: 0, end: 1 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: [
        { index: 0, row: { id: 1, value: "old-1", status: "inactive" }, rowId: 1 },
        { index: 1, row: { id: 2, value: "old-2", status: "inactive" }, rowId: 2 },
      ],
      total: 2,
    })
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual(["old-1", "old-2"])

    const filterModel = {
      columnFilters: {
        status: { kind: "valueSet", tokens: ["string:active"] },
      },
      advancedFilters: {},
      quickFilter: {
        query: "filtered",
        columns: ["value"],
      },
    } satisfies DataGridFilterSnapshot
    model.setFilterModel(filterModel)

    expect(calls).toHaveLength(2)
    expect(calls[1]?.request.reason).toBe("filter-change")
    expect(calls[1]?.request.filterModel).toMatchObject(filterModel)
    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual(["old-1", "old-2"])
    expect(model.getSnapshot().initialLoading).toBe(false)
    expect(model.getSnapshot().refreshing).toBe(true)

    calls[1]?.resolve({
      rows: [
        { index: 0, row: { id: 1, value: "filtered-1", status: "active" }, rowId: 1 },
        { index: 1, row: { id: 2, value: "filtered-2", status: "active" }, rowId: 2 },
      ],
      total: 2,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual(["filtered-1", "filtered-2"])
    expect(model.getSnapshot().refreshing).toBe(false)

    model.dispose()
  })

  it("keeps old rows visible during pending group refresh and swaps cache on success", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string; status: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 2,
    })

    model.setViewportRange({ start: 0, end: 1 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: [
        { index: 0, row: { id: 1, value: "old-1", status: "inactive" }, rowId: 1 },
        { index: 1, row: { id: 2, value: "old-2", status: "inactive" }, rowId: 2 },
      ],
      total: 2,
    })
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual(["old-1", "old-2"])

    const groupBy = { fields: ["status"], expandedByDefault: true }
    model.setGroupBy(groupBy)

    expect(calls).toHaveLength(2)
    expect(calls[1]?.request.reason).toBe("group-change")
    expect(calls[1]?.request.groupBy).toEqual(groupBy)
    expect(calls[1]?.request.treeData).toEqual({
      operation: "set-group-by",
      scope: "all",
      groupKeys: [],
    })
    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual(["old-1", "old-2"])
    expect(model.getSnapshot().refreshing).toBe(true)

    calls[1]?.resolve({
      rows: [
        {
          index: 0,
          kind: "group",
          rowId: "status=active",
          row: { id: 0, value: "status=active", status: "active" },
        },
      ],
      total: 1,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getRowCount()).toBe(1)
    expect(model.getRow(0)?.kind).toBe("group")
    expect(model.getRow(0)?.row).toMatchObject({ value: "status=active", status: "active" })
    expect(model.getRowsInRange({ start: 0, end: 1 })?.length).toBe(1)
    expect(model.getSnapshot().refreshing).toBe(false)

    model.dispose()
  })

  it("drops out-of-window cached rows after branch group expansion changes projection", async () => {
    type GroupedRow = { id: string; label: string; region: string }
    let pushListener: DataGridDataSourcePushListener<GroupedRow> | null = null
    const calls: PullCall<GroupedRow>[] = []
    const dataSource: DataGridDataSource<GroupedRow> = {
      pull(request) {
        return new Promise<DataGridDataSourcePullResult<GroupedRow>>((resolve, reject) => {
          calls.push({ request, resolve, reject })
        })
      },
      subscribe(listener) {
        pushListener = listener
        return () => {
          pushListener = null
        }
      },
    }
    const createGroupRow = (
      index: number,
      region: string,
      expanded: boolean,
    ): DataGridDataSourcePullResult<GroupedRow>["rows"][number] => ({
      index,
      rowId: `group:region:${region}`,
      kind: "group",
      state: { expanded },
      groupMeta: {
        groupKey: `group:region:${region}`,
        groupField: "region",
        groupValue: region,
        level: 0,
        childrenCount: 2,
      },
      row: { id: `group:region:${region}`, label: `Region ${region}`, region },
    })

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 4,
      initialGroupBy: { fields: ["region"], expandedByDefault: false },
    })

    model.setViewportRange({ start: 0, end: 1 })
    calls[0]?.resolve({
      rows: [
        createGroupRow(0, "AMER", false),
        createGroupRow(1, "EMEA", false),
      ],
      total: 4,
    })
    await flushMicrotasks()

    pushListener?.({
      type: "upsert",
      rows: [
        createGroupRow(2, "APAC", false),
      ],
      total: 4,
    })
    expect(model.getRow(2)?.row.label).toBe("Region APAC")

    model.expandGroup("group:region:AMER")
    expect(calls[1]?.request.groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: ["group:region:AMER"],
    })
    expect(calls[1]?.request.treeData).toEqual({
      operation: "expand-group",
      scope: "branch",
      groupKeys: ["group:region:AMER"],
    })
    calls[1]?.resolve({
      rows: [
        createGroupRow(0, "AMER", true),
        {
          index: 1,
          rowId: "srv-amer-1",
          kind: "leaf",
          row: { id: "srv-amer-1", label: "AMER 1", region: "AMER" },
        },
      ],
      total: 6,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getRow(2)).toBeUndefined()
    model.setViewportRange({ start: 2, end: 2 })
    expect(calls[2]?.request.range).toEqual({ start: 2, end: 2 })

    model.dispose()
  })

  it("keeps old rows visible during pending batched sort and filter refresh and swaps cache on success", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string; status: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 2,
    })

    model.setViewportRange({ start: 0, end: 1 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: [
        { index: 0, row: { id: 1, value: "old-1", status: "inactive" }, rowId: 1 },
        { index: 1, row: { id: 2, value: "old-2", status: "inactive" }, rowId: 2 },
      ],
      total: 2,
    })
    await flushMicrotasks()

    const sortModel = [{
      key: "value",
      direction: "asc" as const,
      comparator: { kind: "custom" as const, comparatorId: "server-priority" },
    }]
    const filterModel = {
      columnFilters: {
        status: { kind: "valueSet", tokens: ["string:active"] },
      },
      advancedFilters: {},
    } satisfies DataGridFilterSnapshot
    const setSortAndFilterModel = model.setSortAndFilterModel
    if (setSortAndFilterModel) {
      setSortAndFilterModel({
        sortModel,
        filterModel,
      })
    }

    expect(calls).toHaveLength(2)
    expect(calls[1]?.request.sortModel).toEqual(sortModel)
    expect(calls[1]?.request.filterModel).toMatchObject(filterModel)
    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual(["old-1", "old-2"])
    expect(model.getSnapshot().initialLoading).toBe(false)
    expect(model.getSnapshot().refreshing).toBe(true)

    calls[1]?.resolve({
      rows: [
        { index: 0, row: { id: 1, value: "sorted-filtered-1", status: "active" }, rowId: 1 },
        { index: 1, row: { id: 2, value: "sorted-filtered-2", status: "active" }, rowId: 2 },
      ],
      total: 2,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(calls).toHaveLength(2)
    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual([
      "sorted-filtered-1",
      "sorted-filtered-2",
    ])
    expect(model.getSnapshot().refreshing).toBe(false)

    model.dispose()
  })

  it("keeps old rows visible and surfaces error when a sort refresh fails", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 2,
    })

    model.setViewportRange({ start: 0, end: 1 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: [
        { index: 0, row: { id: 1, value: "old-1" }, rowId: 1 },
        { index: 1, row: { id: 2, value: "old-2" }, rowId: 2 },
      ],
      total: 2,
    })
    await flushMicrotasks()

    model.setSortModel([{ key: "value", direction: "desc" }])
    expect(calls).toHaveLength(2)
    calls[1]?.reject(new Error("sort failed"))
    await flushMicrotasks()
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual(["old-1", "old-2"])
    expect(model.getSnapshot().error?.message).toBe("sort failed")

    model.dispose()
  })

  it("exposes patchRows when the data source implements commitEdits without refreshing unaffected projections", async () => {
    const rows = [
      { id: 1, value: "row-1" },
      { id: 2, value: "row-2" },
    ]
    const pullRequests: DataGridDataSourcePullRequest[] = []
    const commitEdits = vi.fn(async ({ edits }: { edits: ReadonlyArray<{ rowId: number; data: { value?: string } }> }) => {
      for (const edit of edits) {
        const row = rows.find(candidate => candidate.id === edit.rowId)
        if (row && typeof edit.data.value === "string") {
          row.value = edit.data.value
        }
      }
      return { committed: edits.map(edit => ({ rowId: edit.rowId })) }
    })
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull(request) {
        pullRequests.push(request)
        return {
          rows: rows
            .filter(row => row.id >= request.range.start + 1 && row.id <= request.range.end + 1)
            .map((row, offset) => ({
              index: request.range.start + offset,
              row,
              rowId: row.id,
            })),
          total: rows.length,
        }
      },
      commitEdits,
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: rows.length,
    })

    expect(typeof model.patchRows).toBe("function")

    model.setViewportRange({ start: 0, end: 0 })
    await flushMicrotasks()

    const patchRows = model.patchRows
    if (patchRows) {
      patchRows([
        { rowId: 1, data: { value: "updated" } },
      ])
    }

    await flushMicrotasks()
    await flushMicrotasks()

    expect(commitEdits).toHaveBeenCalledWith({
      edits: [
        { rowId: 1, data: { value: "updated" } },
      ],
    })
    expect(pullRequests.filter(request => request.reason === "refresh")).toHaveLength(0)
    expect(model.getRow(0)?.row.value).toBe("updated")

    model.dispose()
  })

  it("applies row snapshots returned from datasource commitEdits", async () => {
    const commitEdits = vi.fn(async () => ({
      committed: [{ rowId: 1 }],
      datasetVersion: 2,
      rows: [{ index: 0, rowId: 1, row: { id: 1, value: "server" } }],
    }))
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull() {
        return {
          rows: [{ index: 0, rowId: 1, row: { id: 1, value: "initial" } }],
          total: 1,
          datasetVersion: 1,
        }
      },
      commitEdits,
    }
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 1,
    })

    model.setViewportRange({ start: 0, end: 0 })
    await flushMicrotasks()
    await Promise.resolve(model.patchRows?.([{ rowId: 1, data: { value: "local" } }]))

    expect(model.getRow(0)?.row.value).toBe("server")
    expect(model.getSnapshot().datasetVersion).toBe(2)

    model.dispose()
  })

  it("applies invalidation returned from datasource commitEdits when rows are absent", async () => {
    const pullRequests: DataGridDataSourcePullRequest[] = []
    const commitEdits = vi.fn(async () => ({
      committed: [{ rowId: 1 }],
      invalidation: { kind: "range" as const, range: { start: 0, end: 0 }, reason: "commit" },
    }))
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull(request) {
        pullRequests.push(request)
        return {
          rows: [{ index: 0, rowId: 1, row: { id: 1, value: request.reason } }],
          total: 1,
        }
      },
      commitEdits,
    }
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 1,
    })

    model.setViewportRange({ start: 0, end: 0 })
    await flushMicrotasks()
    await Promise.resolve(model.patchRows?.([{ rowId: 1, data: { value: "local" } }]))
    await flushMicrotasks()

    expect(pullRequests.some(request => request.reason === "push-invalidation")).toBe(true)

    model.dispose()
  })

  it("applies external updates to loaded datasource rows without commitEdits", async () => {
    const rows = [
      { id: 1, value: "row-1", status: "open" },
      { id: 2, value: "row-2", status: "open" },
    ]
    const commitEdits = vi.fn(async () => ({ committed: [] }))
    const dataSource: DataGridDataSource<{ id: number; value: string; status: string }> = {
      async pull(request) {
        return {
          rows: rows
            .slice(request.range.start, request.range.end + 1)
            .map((row, offset) => ({
              index: request.range.start + offset,
              row,
              rowId: row.id,
            })),
          total: rows.length,
        }
      },
      commitEdits,
    }
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: rows.length,
    })
    const snapshots: unknown[] = []
    const unsubscribe = model.subscribe(snapshot => {
      snapshots.push(snapshot)
    })

    model.setViewportRange({ start: 0, end: 1 })
    await flushMicrotasks()
    expect(typeof model.applyExternalUpdates).toBe("function")

    model.applyExternalUpdates?.([
      { rowId: 1, data: { value: "server-updated" } },
    ])

    expect(commitEdits).not.toHaveBeenCalled()
    expect(model.getRow(0)?.row.value).toBe("server-updated")
    expect(model.getRow(0)?.row.status).toBe("open")
    expect(snapshots.length).toBeGreaterThan(0)

    const invalidBothUpdate = [{
      rowId: 1,
      data: { value: "patch-ignored" },
      row: { id: 1, value: "row-wins", status: "closed" },
    }] as unknown as Parameters<NonNullable<typeof model.applyExternalUpdates>>[0]
    model.applyExternalUpdates?.(invalidBothUpdate)

    expect(model.getRow(0)?.row).toEqual({ id: 1, value: "row-wins", status: "closed" })

    unsubscribe()
    model.dispose()
  })

  it("keeps cleared values in optimistic commitEdits payloads", async () => {
    const rows = [
      { id: 1, value: "row-1" },
    ]
    const commitEdits = vi.fn(async ({ edits }: { edits: ReadonlyArray<{ rowId: number; data: { value?: string } }> }) => {
      for (const edit of edits) {
        const row = rows.find(candidate => candidate.id === edit.rowId)
        if (row && typeof edit.data.value === "string") {
          row.value = edit.data.value
        }
      }
      return { committed: edits.map(edit => ({ rowId: edit.rowId })) }
    })
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull(request) {
        return {
          rows: rows
            .filter(row => row.id >= request.range.start + 1 && row.id <= request.range.end + 1)
            .map((row, offset) => ({
              index: request.range.start + offset,
              row,
              rowId: row.id,
            })),
          total: rows.length,
        }
      },
      commitEdits,
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: rows.length,
    })

    model.setViewportRange({ start: 0, end: 0 })
    await flushMicrotasks()

    const patchRows = model.patchRows
    if (patchRows) {
      patchRows([
        { rowId: 1, data: { value: "" } },
      ])
    }

    await flushMicrotasks()
    await flushMicrotasks()

    expect(commitEdits).toHaveBeenCalledWith({
      edits: [
        { rowId: 1, data: { value: "" } },
      ],
    })
    expect(model.getRow(0)?.row.value).toBe("")

    model.dispose()
  })

  it("applies optimistic inline edits to cached rows before commit resolves", async () => {
    const rows = [
      { id: 1, value: "row-1" },
      { id: 2, value: "row-2" },
    ]
    const { calls: commitCalls, commitEdits } = createDeferredCommitEdits<{ id: number; value: string }>()
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull(request) {
        return {
          rows: rows
            .filter(row => row.id >= request.range.start + 1 && row.id <= request.range.end + 1)
            .map((row, offset) => ({
              index: request.range.start + offset,
              row,
              rowId: row.id,
            })),
          total: rows.length,
        }
      },
      commitEdits,
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: rows.length,
    })

    model.setViewportRange({ start: 0, end: 1 })
    await flushMicrotasks()

    const patchRows = model.patchRows
    const patchPromise = Promise.resolve(patchRows ? patchRows([
      { rowId: 1, data: { value: "updated" } },
    ]) : undefined)

    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual([
      "updated",
      "row-2",
    ])

    await flushMicrotasks()
    expect(commitCalls).toHaveLength(1)
    expect(commitCalls[0]?.request.edits).toEqual([
      { rowId: 1, data: { value: "updated" } },
    ])

    rows[0] = { ...rows[0], value: "updated" }
    commitCalls[0]?.resolve({
      committed: [{ rowId: 1 }],
    })
    await patchPromise

    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual([
      "updated",
      "row-2",
    ])

    model.dispose()
  })

  it("keeps visible rows stable when commit success invalidates a touched row", async () => {
    const rows = [
      { id: 1, value: "row-1" },
      { id: 2, value: "row-2" },
    ]
    const calls: PullCall<{ id: number; value: string }>[] = []
    let invalidateRows: ((rowIds: readonly number[]) => void) | null = null
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise<DataGridDataSourcePullResult<{ id: number; value: string }>>((resolve, reject) => {
          calls.push({
            request,
            resolve,
            reject,
          })
        })
      },
      async commitEdits() {
        rows[0] = { ...rows[0], value: "server-updated" }
        invalidateRows?.([1])
        return { committed: [{ rowId: 1 }] }
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: rows.length,
    })
    invalidateRows = rowIds => model.invalidateRows(rowIds)

    model.setViewportRange({ start: 0, end: 1 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: rows.map((row, index) => ({ index, row, rowId: row.id })),
      total: rows.length,
    })
    await flushMicrotasks()

    const patchRows = model.patchRows
    const patchPromise = Promise.resolve(patchRows ? patchRows([
      { rowId: 1, data: { value: "updated" } },
    ]) : undefined)

    await patchPromise

    expect(calls).toHaveLength(2)
    expect(calls[1]?.request.reason).toBe("invalidation")
    expect(model.getSnapshot().loading).toBe(false)
    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual([
      "updated",
      "row-2",
    ])

    calls[1]?.resolve({
      rows: rows.map((row, index) => ({ index, row, rowId: row.id })),
      total: rows.length,
    })
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual([
      "server-updated",
      "row-2",
    ])

    model.dispose()
  })

  it("reconciles optimistic inline edits with server refresh data after commit success", async () => {
    const rows = [
      { id: 1, value: "row-1" },
      { id: 2, value: "row-2" },
    ]
    const { calls: commitCalls, commitEdits } = createDeferredCommitEdits<{ id: number; value: string }>()
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull(request) {
        return {
          rows: rows
            .filter(row => row.id >= request.range.start + 1 && row.id <= request.range.end + 1)
            .map((row, offset) => ({
              index: request.range.start + offset,
              row,
              rowId: row.id,
            })),
          total: rows.length,
        }
      },
      commitEdits,
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: rows.length,
      initialSortModel: [{ key: "value", direction: "asc" }],
    })

    model.setViewportRange({ start: 0, end: 1 })
    await flushMicrotasks()

    const patchRows = model.patchRows
    const patchPromise = Promise.resolve(patchRows ? patchRows([
      { rowId: 1, data: { value: "updated" } },
    ]) : undefined)

    await flushMicrotasks()
    expect(commitCalls).toHaveLength(1)
    rows[0] = { ...rows[0], value: "server-updated" }
    commitCalls[0]?.resolve({
      committed: [{ rowId: 1 }],
    })
    await patchPromise
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual([
      "server-updated",
      "row-2",
    ])

    model.dispose()
  })

  it("rolls back a failed optimistic inline edit and surfaces an error", async () => {
    const rows = [
      { id: 1, value: "row-1" },
      { id: 2, value: "row-2" },
    ]
    const { calls: commitCalls, commitEdits } = createDeferredCommitEdits<{ id: number; value: string }>()
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull(request) {
        return {
          rows: rows
            .filter(row => row.id >= request.range.start + 1 && row.id <= request.range.end + 1)
            .map((row, offset) => ({
              index: request.range.start + offset,
              row,
              rowId: row.id,
            })),
          total: rows.length,
        }
      },
      commitEdits,
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: rows.length,
    })

    model.setViewportRange({ start: 0, end: 1 })
    await flushMicrotasks()

    const patchRows = model.patchRows
    const patchPromise = Promise.resolve(patchRows ? patchRows([
      { rowId: 1, data: { value: "updated" } },
    ]) : undefined)

    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual([
      "updated",
      "row-2",
    ])

    await flushMicrotasks()
    expect(commitCalls).toHaveLength(1)
    commitCalls[0]?.reject(new Error("commit failed"))
    await expect(patchPromise).rejects.toThrow("commit failed")
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual([
      "row-1",
      "row-2",
    ])
    expect(model.getSnapshot().error?.message).toBe("commit failed")

    model.dispose()
  })

  it("leaves unrelated cached rows unchanged during optimistic inline edits", async () => {
    const rows = [
      { id: 1, value: "row-1" },
      { id: 2, value: "row-2" },
      { id: 3, value: "row-3" },
    ]
    const { calls: commitCalls, commitEdits } = createDeferredCommitEdits<{ id: number; value: string }>()
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull(request) {
        return {
          rows: rows
            .filter(row => row.id >= request.range.start + 1 && row.id <= request.range.end + 1)
            .map((row, offset) => ({
              index: request.range.start + offset,
              row,
              rowId: row.id,
            })),
          total: rows.length,
        }
      },
      commitEdits,
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: rows.length,
    })

    model.setViewportRange({ start: 0, end: 2 })
    await flushMicrotasks()

    const patchRows = model.patchRows
    const patchPromise = Promise.resolve(patchRows ? patchRows([
      { rowId: 1, data: { value: "updated" } },
    ]) : undefined)

    expect(model.getRowsInRange({ start: 0, end: 2 })?.map(row => row.row.value)).toEqual([
      "updated",
      "row-2",
      "row-3",
    ])

    await flushMicrotasks()
    expect(commitCalls).toHaveLength(1)
    rows[0] = { ...rows[0], value: "updated" }
    commitCalls[0]?.resolve({
      committed: [{ rowId: 1 }],
    })
    await patchPromise
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 2 })?.map(row => row.row.value)).toEqual([
      "updated",
      "row-2",
      "row-3",
    ])

    model.dispose()
  })

  it("waits for the refresh pull to complete before resolving patchRows", async () => {
    const rows = [
      { id: 1, value: "row-1" },
    ]
    let resolveRefresh: ((result: DataGridDataSourcePullResult<{ id: number; value: string }>) => void) | null = null
    const commitEdits = vi.fn(async ({ edits }: { edits: ReadonlyArray<{ rowId: number; data: { value?: string } }> }) => {
      for (const edit of edits) {
        const row = rows.find(candidate => candidate.id === edit.rowId)
        if (row && typeof edit.data.value === "string") {
          row.value = edit.data.value
        }
      }
      return { committed: edits.map(edit => ({ rowId: edit.rowId })) }
    })
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull(request) {
        if (request.reason === "refresh") {
          return await new Promise<DataGridDataSourcePullResult<{ id: number; value: string }>>(resolve => {
            resolveRefresh = resolve
          })
        }
        return {
          rows: rows
            .filter(row => row.id >= request.range.start + 1 && row.id <= request.range.end + 1)
            .map((row, offset) => ({
              index: request.range.start + offset,
              row,
              rowId: row.id,
            })),
          total: rows.length,
        }
      },
      commitEdits,
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: rows.length,
      initialSortModel: [{ key: "value", direction: "asc" }],
    })

    model.setViewportRange({ start: 0, end: 0 })
    await flushMicrotasks()

    const patchRows = model.patchRows
    const patchPromise = Promise.resolve(patchRows ? patchRows([
      { rowId: 1, data: { value: "updated" } },
    ]) : undefined)
    let resolved = false
    patchPromise.then(() => {
      resolved = true
    })

    await flushMicrotasks()
    expect(resolved).toBe(false)
    expect(resolveRefresh).not.toBeNull()

    const resolvedRefresh = resolveRefresh
    if (resolvedRefresh) {
      resolvedRefresh({
        rows: [
          { index: 0, row: rows[0]!, rowId: 1 },
        ],
        total: rows.length,
      })
    }
    await patchPromise
    expect(resolved).toBe(true)
    expect(model.getRow(0)?.row.value).toBe("updated")

    model.dispose()
  })

  it("does not refresh when commitEdits throws", async () => {
    const rows = [
      { id: 1, value: "row-1" },
      { id: 2, value: "row-2" },
    ]
    const commitEdits = vi.fn(async () => {
      throw new Error("commit failed")
    })
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull(request) {
        return {
          rows: rows
            .filter(row => row.id >= request.range.start + 1 && row.id <= request.range.end + 1)
            .map((row, offset) => ({
              index: request.range.start + offset,
              row,
              rowId: row.id,
            })),
          total: rows.length,
        }
      },
      commitEdits,
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: rows.length,
    })

    const refreshSpy = vi.spyOn(model, "refresh")
    model.setViewportRange({ start: 0, end: 0 })
    await flushMicrotasks()

    const patchRows = model.patchRows
    let patchPromise: Promise<unknown> | null = null
    if (patchRows) {
      patchPromise = Promise.resolve(patchRows([
        { rowId: 1, data: { value: "updated" } },
      ]))
    }

    await flushMicrotasks()
    await expect(patchPromise).rejects.toThrow("commit failed")

    expect(commitEdits).toHaveBeenCalledWith({
      edits: [
        { rowId: 1, data: { value: "updated" } },
      ],
    })
    expect(refreshSpy).not.toHaveBeenCalled()
    expect(model.getRow(0)?.row.value).toBe("row-1")

    model.dispose()
  })

  it("does not refresh when commitEdits returns rejected rows", async () => {
    const rows = [
      { id: 1, value: "row-1" },
      { id: 2, value: "row-2" },
    ]
    const commitEdits = vi.fn(async () => ({
      rejected: [{ rowId: 1, reason: "conflict" }],
    }))
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull(request) {
        return {
          rows: rows
            .filter(row => row.id >= request.range.start + 1 && row.id <= request.range.end + 1)
            .map((row, offset) => ({
              index: request.range.start + offset,
              row,
              rowId: row.id,
            })),
          total: rows.length,
        }
      },
      commitEdits,
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: rows.length,
    })

    const refreshSpy = vi.spyOn(model, "refresh")
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    model.setViewportRange({ start: 0, end: 0 })
    await flushMicrotasks()

    const patchRows = model.patchRows
    let patchPromise: Promise<unknown> | null = null
    if (patchRows) {
      patchPromise = Promise.resolve(patchRows([
        { rowId: 1, data: { value: "updated" } },
      ]))
    }

    await flushMicrotasks()
    await expect(patchPromise).rejects.toThrow("conflict")

    expect(commitEdits).toHaveBeenCalledWith({
      edits: [
        { rowId: 1, data: { value: "updated" } },
      ],
    })
    expect(refreshSpy).not.toHaveBeenCalled()
    expect(model.getRow(0)?.row.value).toBe("row-1")
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
    model.dispose()
  })

  it("keeps patchRows unavailable when the data source does not implement commitEdits", async () => {
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull() {
        return {
          rows: [],
          total: 0,
        }
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 0,
    })

    expect(model.patchRows).toBeUndefined()

    model.dispose()
  })

  it("coalesces viewport overload into the latest critical pull", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          const call: PullCall<{ id: number; value: string }> = {
            request,
            resolve,
            reject,
          }
          calls.push(call)
          request.signal.addEventListener("abort", () => {
            reject({ name: "AbortError" })
          })
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 10_000,
    })

    model.setViewportRange({ start: 0, end: 10 })
    model.setViewportRange({ start: 100, end: 120 })
    model.setViewportRange({ start: 200, end: 220 })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.request.signal.aborted).toBe(false)
    expect(model.getBackpressureDiagnostics().hasPendingPull).toBe(true)

    await flushMicrotasks()

    expect(calls).toHaveLength(2)
    expect(calls[0]?.request.signal.aborted).toBe(true)
    expect(calls[1]?.request.signal.aborted).toBe(false)
    expect(calls[1]?.request.range).toEqual({ start: 200, end: 220 })
    expect(calls[1]?.request.groupBy).toBeNull()
    expect(calls[1]?.request.groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [],
    })
    expect(calls[1]?.request.treeData).toBeNull()

    calls[1]?.resolve({
      rows: Array.from({ length: 21 }, (_, offset) => {
        const index = 200 + offset
        return {
          index,
          row: { id: index, value: `row-${index}` },
        }
      }),
      total: 10_000,
    })

    await flushMicrotasks()

    expect(model.getRow(200)?.row.value).toBe("row-200")
    expect(model.getRow(0)).toBeUndefined()

    const diagnostics = model.getBackpressureDiagnostics()
    expect(diagnostics.pullRequested).toBe(2)
    expect(diagnostics.pullDeferred).toBeGreaterThanOrEqual(2)
    expect(diagnostics.pullCoalesced).toBeGreaterThanOrEqual(1)
    expect(diagnostics.pullAborted).toBeGreaterThanOrEqual(1)
    expect(diagnostics.pullCompleted).toBe(1)

    model.dispose()
  })

  it("routes viewport-change refresh through pending viewport critical pulls", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          const call: PullCall<{ id: number; value: string }> = {
            request,
            resolve,
            reject,
          }
          calls.push(call)
          request.signal.addEventListener("abort", () => {
            reject({ name: "AbortError" })
          })
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 10_000,
    })

    model.setViewportRange({ start: 0, end: 10 })
    model.setViewportRange({ start: 100, end: 110 })
    const refreshA = model.refresh("viewport-change")
    model.setViewportRange({ start: 200, end: 210 })
    const refreshB = model.refresh("viewport-change")

    await flushMicrotasks()

    expect(calls).toHaveLength(2)
    expect(calls[0]?.request.signal.aborted).toBe(true)
    expect(calls[1]?.request.reason).toBe("viewport-change")
    expect(calls[1]?.request.priority).toBe("critical")
    expect(calls[1]?.request.range).toEqual({ start: 200, end: 210 })

    calls[1]?.resolve({
      rows: Array.from({ length: 11 }, (_, offset) => {
        const index = 200 + offset
        return {
          index,
          row: { id: index, value: `row-${index}` },
        }
      }),
      total: 10_000,
    })
    await Promise.all([refreshA, refreshB])
    await flushMicrotasks()

    expect(calls).toHaveLength(2)
    expect(model.getRow(200)?.row.value).toBe("row-200")

    const diagnostics = model.getBackpressureDiagnostics()
    expect(diagnostics.pullRequested).toBe(2)
    expect(diagnostics.pullAborted).toBe(1)
    expect(diagnostics.pullCompleted).toBe(1)

    model.dispose()
  })

  it("keeps the final viewport materialized with loading rows during rapid far jumps", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          const call: PullCall<{ id: number; value: string }> = {
            request,
            resolve,
            reject,
          }
          calls.push(call)
          request.signal.addEventListener("abort", () => {
            reject({ name: "AbortError" })
          })
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 100_000,
      prefetch: {
        enabled: false,
      },
    })

    model.setViewportRange({ start: 0, end: 20 })
    model.setViewportRange({ start: 50_000, end: 50_020 })
    model.setViewportRange({ start: 99_500, end: 99_520 })

    expect(calls).toHaveLength(1)

    await flushMicrotasks()

    expect(calls).toHaveLength(2)
    expect(calls[0]?.request.signal.aborted).toBe(true)
    expect(calls[1]?.request.range).toEqual({ start: 99_500, end: 99_520 })

    const rows = model.getRowsInRange({ start: 99_500, end: 99_520 })
    expect(rows).toHaveLength(21)
    expect(rows.map(row => row.displayIndex)).toEqual(
      Array.from({ length: 21 }, (_unused, offset) => 99_500 + offset),
    )
    expect(rows.every(row => (row as { __placeholder?: boolean }).__placeholder === true)).toBe(true)
    expect(rows.every(row => (
      (row.row as Record<string, unknown>).__affinoDataGridDataSourceRowStatus === "loading"
    ))).toBe(true)

    calls[1]?.resolve({
      rows: Array.from({ length: 21 }, (_unused, offset) => {
        const index = 99_500 + offset
        return {
          index,
          row: { id: index, value: `row-${index}` },
        }
      }),
      total: 100_000,
    })
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 99_500, end: 99_520 }).map(row => row.row.value)).toEqual(
      Array.from({ length: 21 }, (_unused, offset) => `row-${99_500 + offset}`),
    )

    model.dispose()
  })

  it("drops scheduled viewport pulls on dispose", async () => {
    const { calls, dataSource } = createAbortableDeferredPullDataSource<{ id: number; value: string }>()

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 1_000,
      prefetch: {
        enabled: false,
      },
    })

    model.setViewportRange({ start: 0, end: 20 })
    model.setViewportRange({ start: 500, end: 520 })

    expect(calls).toHaveLength(1)
    expect(model.getBackpressureDiagnostics().hasPendingPull).toBe(true)

    model.dispose()
    await flushMicrotasks()

    expect(calls).toHaveLength(1)
    expect(calls[0]?.request.signal.aborted).toBe(true)
    expect(model.getBackpressureDiagnostics().hasPendingPull).toBe(false)
  })

  it("clears scheduled viewport pulls when a state reset starts", async () => {
    const { calls, dataSource } = createAbortableDeferredPullDataSource<{ id: number; value: string }>()

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 1_000,
      prefetch: {
        enabled: false,
      },
    })

    model.setViewportRange({ start: 0, end: 20 })
    model.setViewportRange({ start: 500, end: 520 })

    expect(calls).toHaveLength(1)
    expect(model.getBackpressureDiagnostics().hasPendingPull).toBe(true)

    model.setSortModel([{ key: "value", direction: "desc" }])

    expect(calls).toHaveLength(2)
    expect(calls[0]?.request.signal.aborted).toBe(true)
    expect(calls[1]?.request.reason).toBe("sort-change")

    await flushMicrotasks()

    expect(calls).toHaveLength(2)
    expect(model.getBackpressureDiagnostics().hasPendingPull).toBe(false)

    const sortRange = calls[1]?.request.range ?? { start: 0, end: 0 }
    calls[1]?.resolve({
      rows: buildRows(sortRange.start, sortRange.end),
      total: 1_000,
    })
    await flushMicrotasks()

    model.dispose()
  })

  it("coalesces identical inflight viewport pulls instead of spawning duplicate requests", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          const call: PullCall<{ id: number; value: string }> = {
            request,
            resolve,
            reject,
          }
          calls.push(call)
          request.signal.addEventListener("abort", () => {
            reject({ name: "AbortError" })
          })
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 1_000,
    })

    model.setViewportRange({ start: 120, end: 140 })
    model.setViewportRange({ start: 120, end: 140 })
    model.setViewportRange({ start: 120, end: 140 })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.request.signal.aborted).toBe(false)

    calls[0]?.resolve({
      rows: Array.from({ length: 21 }, (_, offset) => {
        const index = 120 + offset
        return {
          index,
          row: { id: index, value: `row-${index}` },
        }
      }),
      total: 1_000,
    })
    await flushMicrotasks()

    expect(model.getRow(120)?.row.value).toBe("row-120")
    const diagnostics = model.getBackpressureDiagnostics()
    expect(diagnostics.pullRequested).toBe(1)
    expect(diagnostics.pullCoalesced).toBe(2)
    expect(diagnostics.pullAborted).toBe(0)
    expect(diagnostics.pullDeferred).toBe(0)

    model.dispose()
  })

  it("coalesces subset viewport demand when broader inflight range already covers it", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          const call: PullCall<{ id: number; value: string }> = {
            request,
            resolve,
            reject,
          }
          calls.push(call)
          request.signal.addEventListener("abort", () => {
            reject({ name: "AbortError" })
          })
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 2_000,
    })

    model.setViewportRange({ start: 300, end: 360 })
    model.setViewportRange({ start: 320, end: 330 })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.request.range).toEqual({ start: 300, end: 360 })

    calls[0]?.resolve({
      rows: Array.from({ length: 61 }, (_, offset) => {
        const index = 300 + offset
        return {
          index,
          row: { id: index, value: `row-${index}` },
        }
      }),
      total: 2_000,
    })
    await flushMicrotasks()

    const diagnostics = model.getBackpressureDiagnostics()
    expect(diagnostics.pullRequested).toBe(1)
    expect(diagnostics.pullCoalesced).toBeGreaterThanOrEqual(1)
    expect(diagnostics.pullAborted).toBe(0)

    model.dispose()
  })

  it("coalesces rapid viewport changes while a critical pull is inflight", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          calls.push({ request, resolve, reject })
          request.signal.addEventListener("abort", () => reject({ name: "AbortError" }))
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 2_000,
      prefetch: {
        enabled: false,
      },
    })

    model.setViewportRange({ start: 0, end: 29 })
    expect(calls).toHaveLength(1)

    model.setViewportRange({ start: 30, end: 59 })
    model.setViewportRange({ start: 60, end: 89 })
    model.setViewportRange({ start: 90, end: 119 })

    expect(calls).toHaveLength(1)
    await flushMicrotasks()

    expect(calls).toHaveLength(2)
    expect(calls[0]?.request.signal.aborted).toBe(true)
    expect(calls[1]?.request.reason).toBe("viewport-change")
    expect(calls[1]?.request.priority).toBe("critical")
    expect(calls[1]?.request.range).toEqual({ start: 90, end: 119 })

    const diagnostics = model.getBackpressureDiagnostics()
    expect(diagnostics.pullDeferred).toBeGreaterThanOrEqual(1)
    expect(diagnostics.pullCoalesced).toBeGreaterThanOrEqual(2)

    model.dispose()
  })

  it("expands fast backend viewport pulls with velocity-aware forward overscan", async () => {
    const { calls, dataSource } = createAbortableDeferredPullDataSource<{ id: number; value: string }>()

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 10_000,
      prefetch: {
        enabled: true,
      },
    })

    try {
      model.setViewportRange({ start: 0, end: 19 })
      expect(calls[0]?.request.range).toEqual({ start: 0, end: 19 })

      model.setViewportRange({ start: 500, end: 519 })
      await flushMicrotasks()

      expect(calls).toHaveLength(2)
      expect(calls[1]?.request.range.start).toBeLessThan(500)
      expect(calls[1]?.request.range.end).toBeGreaterThan(519)
      expect(519 - (calls[1]?.request.range.start ?? 519)).toBeLessThan(
        (calls[1]?.request.range.end ?? 500) - 500,
      )
    } finally {
      model.dispose()
    }
  })

  it("schedules background prefetch after initial critical viewport load", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          calls.push({ request, resolve, reject })
          request.signal.addEventListener("abort", () => reject({ name: "AbortError" }))
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 100_000,
      prefetch: {
        enabled: true,
        triggerViewportFactor: 1,
        windowViewportFactor: 3,
        minBatchSize: 30,
        maxBatchSize: 90,
      },
    })

    model.setViewportRange({ start: 0, end: 29 })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.request.reason).toBe("viewport-change")
    expect(calls[0]?.request.priority).toBe("critical")

    calls[0]?.resolve({
      rows: buildRows(0, 29),
      total: 100_000,
    })
    await flushMicrotasks()

    expect(calls).toHaveLength(2)
    expect(calls[1]?.request.reason).toBe("prefetch")
    expect(calls[1]?.request.priority).toBe("background")
    expect(calls[1]?.request.range).toEqual({ start: 30, end: 119 })

    calls[1]?.resolve({
      rows: buildRows(30, 119),
      total: 100_000,
    })
    await flushMicrotasks()

    const diagnostics = model.getBackpressureDiagnostics()
    expect(diagnostics.prefetchScheduled).toBeGreaterThanOrEqual(1)
    expect(diagnostics.prefetchStarted).toBeGreaterThanOrEqual(1)
    expect(diagnostics.prefetchCompleted).toBeGreaterThanOrEqual(1)
    expect(diagnostics.cachedAheadRows).toBeGreaterThan(0)

    model.dispose()
  })

  it("scrolls within loaded buffer and starts next background prefetch before hitting the edge", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          calls.push({ request, resolve, reject })
          request.signal.addEventListener("abort", () => reject({ name: "AbortError" }))
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 100_000,
      prefetch: {
        enabled: true,
        triggerViewportFactor: 1,
        windowViewportFactor: 2,
        minBatchSize: 30,
        maxBatchSize: 60,
      },
    })

    model.setViewportRange({ start: 0, end: 29 })
    calls[0]?.resolve({ rows: buildRows(0, 29), total: 100_000 })
    await flushMicrotasks()
    calls[1]?.resolve({ rows: buildRows(30, 89), total: 100_000 })
    await flushMicrotasks()

    const callCountBeforeScroll = calls.length
    model.setViewportRange({ start: 30, end: 59 })
    await flushMicrotasks()

    const visibleRows = model.getRowsInRange({ start: 30, end: 59 })
    expect(visibleRows).toHaveLength(30)
    expect(visibleRows.every(row => (row as { __placeholder?: boolean }).__placeholder !== true)).toBe(true)
    expect(visibleRows.map(row => row.row.value)).toEqual(
      Array.from({ length: 30 }, (_unused, offset) => `row-${30 + offset}`),
    )
    expect(calls.length).toBe(callCountBeforeScroll + 1)
    expect(calls[calls.length - 1]?.request.reason).toBe("prefetch")
    expect(calls[calls.length - 1]?.request.priority).toBe("background")
    expect(calls[calls.length - 1]?.request.range).toEqual({ start: 90, end: 149 })
    expect(calls.some(call => call.request.reason === "viewport-change" && call.request.range.start === 30)).toBe(false)

    model.dispose()
  })

  it("coalesces repeated forward prefetch demand instead of duplicating requests", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          calls.push({ request, resolve, reject })
          request.signal.addEventListener("abort", () => reject({ name: "AbortError" }))
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 100_000,
      prefetch: {
        enabled: true,
        triggerViewportFactor: 1,
        windowViewportFactor: 2,
        minBatchSize: 30,
        maxBatchSize: 60,
      },
    })

    model.setViewportRange({ start: 0, end: 29 })
    calls[0]?.resolve({ rows: buildRows(0, 29), total: 100_000 })
    await flushMicrotasks()
    calls[1]?.resolve({ rows: buildRows(30, 89), total: 100_000 })
    await flushMicrotasks()

    model.setViewportRange({ start: 30, end: 59 })
    await flushMicrotasks()
    expect(calls[calls.length - 1]?.request.range).toEqual({ start: 90, end: 149 })

    const callCountWithActivePrefetch = calls.length
    model.setViewportRange({ start: 35, end: 64 })
    model.setViewportRange({ start: 40, end: 69 })
    await flushMicrotasks()

    expect(calls).toHaveLength(callCountWithActivePrefetch)
    const diagnostics = model.getBackpressureDiagnostics()
    expect(diagnostics.prefetchCoalesced).toBeGreaterThanOrEqual(1)
    expect(diagnostics.prefetchAborted).toBe(0)

    model.dispose()
  })

  it("supports backward prefetch when the user scrolls upward", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          calls.push({ request, resolve, reject })
          request.signal.addEventListener("abort", () => reject({ name: "AbortError" }))
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 100_000,
      prefetch: {
        enabled: true,
        triggerViewportFactor: 1,
        windowViewportFactor: 1,
        minBatchSize: 30,
        maxBatchSize: 30,
        directionalBias: "scroll-direction",
      },
    })

    model.setViewportRange({ start: 200, end: 229 })
    calls[0]?.resolve({ rows: buildRows(200, 229), total: 100_000 })
    await flushMicrotasks()
    calls[1]?.resolve({ rows: buildRows(230, 259), total: 100_000 })
    await flushMicrotasks()

    model.setViewportRange({ start: 170, end: 199 })
    expect(calls[calls.length - 1]?.request.reason).toBe("viewport-change")
    calls[calls.length - 1]?.resolve({ rows: buildRows(170, 199), total: 100_000 })
    await flushMicrotasks()

    expect(calls[calls.length - 1]?.request.reason).toBe("prefetch")
    expect(calls[calls.length - 1]?.request.priority).toBe("background")
    expect(calls[calls.length - 1]?.request.range).toEqual({ start: 140, end: 169 })

    model.dispose()
  })

  it("keeps critical viewport pulls independent from background prefetch work", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          calls.push({ request, resolve, reject })
          request.signal.addEventListener("abort", () => reject({ name: "AbortError" }))
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 100_000,
      prefetch: {
        enabled: true,
        triggerViewportFactor: 1,
        windowViewportFactor: 2,
        minBatchSize: 30,
        maxBatchSize: 60,
      },
    })

    model.setViewportRange({ start: 0, end: 29 })
    calls[0]?.resolve({ rows: buildRows(0, 29), total: 100_000 })
    await flushMicrotasks()

    expect(calls[1]?.request.reason).toBe("prefetch")
    model.setViewportRange({ start: 200, end: 229 })

    expect(calls).toHaveLength(3)
    expect(calls[1]?.request.signal.aborted).toBe(false)
    expect(calls[2]?.request.reason).toBe("viewport-change")
    expect(calls[2]?.request.priority).toBe("critical")

    calls[2]?.resolve({ rows: buildRows(200, 229), total: 100_000 })
    await flushMicrotasks()
    expect(calls[2]?.request.signal.aborted).toBe(false)

    model.dispose()
  })

  it("applies row updates while background prefetch is inflight", async () => {
    let pushListener: DataGridDataSourcePushListener<{ id: number; value: string }> | null = null
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          calls.push({ request, resolve, reject })
          request.signal.addEventListener("abort", () => reject({ name: "AbortError" }))
        })
      },
      subscribe(listener) {
        pushListener = listener
        return () => {
          pushListener = null
        }
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 100_000,
      prefetch: {
        enabled: true,
        triggerViewportFactor: 1,
        windowViewportFactor: 2,
        minBatchSize: 30,
        maxBatchSize: 60,
      },
    })

    model.setViewportRange({ start: 0, end: 29 })
    calls[0]?.resolve({ rows: buildRows(0, 29), total: 100_000 })
    await flushMicrotasks()

    const listener = pushListener
    if (listener) {
      listener({
        type: "upsert",
        rows: [{ index: 5, row: { id: 5, value: "patched-5" } }],
        total: 100_000,
      })
    }
    expect(model.getRow(5)?.row.value).toBe("patched-5")

    calls[1]?.resolve({ rows: buildRows(30, 89), total: 100_000 })
    await flushMicrotasks()
    expect(model.getRow(5)?.row.value).toBe("patched-5")

    model.dispose()
  })

  it("keeps prefetched near-future rows available under cache pressure", async () => {
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull(request) {
        return {
          rows: buildRows(request.range.start, request.range.end),
          total: 100_000,
        }
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 100_000,
      rowCacheLimit: 48,
      prefetch: {
        enabled: true,
        triggerViewportFactor: 1,
        windowViewportFactor: 2,
        minBatchSize: 20,
        maxBatchSize: 20,
      },
    })

    model.setViewportRange({ start: 0, end: 19 })
    await flushMicrotasks()
    await flushMicrotasks()
    expect(model.getRow(20)?.row.value).toBe("row-20")
    expect(model.getRow(39)?.row.value).toBe("row-39")

    model.setViewportRange({ start: 20, end: 39 })
    await flushMicrotasks()
    await flushMicrotasks()
    expect(model.getRow(40)?.row.value).toBe("row-40")
    expect(model.getRow(59)?.row.value).toBe("row-59")

    const diagnostics = model.getBackpressureDiagnostics()
    expect(diagnostics.rowCacheSize).toBeLessThanOrEqual(diagnostics.rowCacheLimit)
    expect(diagnostics.cachedAheadRows).toBeGreaterThanOrEqual(20)

    model.dispose()
  })

  it("defers lower-priority invalidation pull while critical viewport pull is inflight", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          const call: PullCall<{ id: number; value: string }> = {
            request,
            resolve,
            reject,
          }
          calls.push(call)
          request.signal.addEventListener("abort", () => {
            reject({ name: "AbortError" })
          })
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 10_000,
    })

    model.setViewportRange({ start: 40, end: 80 })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.request.priority).toBe("critical")

    model.invalidateAll()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.request.signal.aborted).toBe(false)

    calls[0]?.resolve({
      rows: Array.from({ length: 41 }, (_, offset) => {
        const index = 40 + offset
        return {
          index,
          row: { id: index, value: `row-${index}` },
        }
      }),
      total: 10_000,
    })
    await flushMicrotasks()

    expect(calls).toHaveLength(2)
    expect(calls[1]?.request.priority).toBe("normal")
    expect(calls[1]?.request.reason).toBe("invalidation")
    expect(calls[0]?.request.signal.aborted).toBe(false)

    calls[1]?.resolve({
      rows: Array.from({ length: 41 }, (_, offset) => {
        const index = 40 + offset
        return {
          index,
          row: { id: index, value: `row-${index}` },
        }
      }),
      total: 10_000,
    })
    await flushMicrotasks()

    const diagnostics = model.getBackpressureDiagnostics()
    expect(diagnostics.pullRequested).toBe(2)
    expect(diagnostics.pullDeferred).toBeGreaterThanOrEqual(1)
    expect(diagnostics.pullAborted).toBe(0)

    model.dispose()
  })

  it("preempts lower-priority inflight pull when critical viewport demand arrives", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          const call: PullCall<{ id: number; value: string }> = {
            request,
            resolve,
            reject,
          }
          calls.push(call)
          request.signal.addEventListener("abort", () => {
            reject({ name: "AbortError" })
          })
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 10_000,
    })

    model.invalidateAll()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.request.priority).toBe("normal")

    model.setViewportRange({ start: 400, end: 430 })
    expect(calls).toHaveLength(1)

    await flushMicrotasks()

    expect(calls).toHaveLength(2)
    expect(calls[0]?.request.signal.aborted).toBe(true)
    expect(calls[1]?.request.priority).toBe("critical")
    expect(calls[1]?.request.reason).toBe("viewport-change")

    calls[1]?.resolve({
      rows: Array.from({ length: 31 }, (_, offset) => {
        const index = 400 + offset
        return {
          index,
          row: { id: index, value: `row-${index}` },
        }
      }),
      total: 10_000,
    })
    await flushMicrotasks()

    const diagnostics = model.getBackpressureDiagnostics()
    expect(diagnostics.pullRequested).toBe(2)
    expect(diagnostics.pullAborted).toBeGreaterThanOrEqual(1)
    expect(diagnostics.pullDeferred).toBeGreaterThanOrEqual(1)

    model.dispose()
  })

  it("collapses repeated deferred invalidation pulls into single pending request", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          const call: PullCall<{ id: number; value: string }> = {
            request,
            resolve,
            reject,
          }
          calls.push(call)
          request.signal.addEventListener("abort", () => {
            reject({ name: "AbortError" })
          })
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 8_000,
    })

    model.setViewportRange({ start: 1_000, end: 1_050 })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.request.priority).toBe("critical")

    model.invalidateAll()
    model.invalidateAll()
    model.invalidateAll()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.request.signal.aborted).toBe(false)

    calls[0]?.resolve({
      rows: Array.from({ length: 51 }, (_, offset) => {
        const index = 1_000 + offset
        return {
          index,
          row: { id: index, value: `row-${index}` },
        }
      }),
      total: 8_000,
    })
    await flushMicrotasks()

    expect(calls).toHaveLength(2)
    expect(calls[1]?.request.priority).toBe("normal")
    expect(calls[1]?.request.reason).toBe("invalidation")

    calls[1]?.resolve({
      rows: Array.from({ length: 51 }, (_, offset) => {
        const index = 1_000 + offset
        return {
          index,
          row: { id: index, value: `row-${index}` },
        }
      }),
      total: 8_000,
    })
    await flushMicrotasks()

    const diagnostics = model.getBackpressureDiagnostics()
    expect(diagnostics.pullRequested).toBe(2)
    expect(diagnostics.pullDeferred).toBeGreaterThanOrEqual(1)
    expect(diagnostics.pullCoalesced).toBeGreaterThanOrEqual(2)
    expect(diagnostics.pullAborted).toBe(0)

    model.dispose()
  })

  it("suspends new datasource pulls without dropping cached rows", async () => {
    const { calls, dataSource } = createDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 100,
    })

    model.setViewportRange({ start: 0, end: 2 })
    expect(calls).toHaveLength(1)
    calls[0]?.resolve({
      rows: buildRows(0, 2),
      total: 100,
    })
    await flushMicrotasks()

    expect(model.getRow(0)?.row).toEqual({ id: 0, value: "row-0" })
    expect(model.pauseBackpressure()).toBe(true)

    model.setViewportRange({ start: 10, end: 12 })
    await flushMicrotasks()

    expect(calls).toHaveLength(1)
    expect(model.getRow(0)?.row).toEqual({ id: 0, value: "row-0" })
    expect(model.getBackpressureDiagnostics()).toMatchObject({
      paused: true,
      hasPendingPull: true,
      rowCacheSize: 3,
    })

    expect(model.resumeBackpressure()).toBe(true)
    await flushMicrotasks()

    expect(calls).toHaveLength(2)
    expect(calls[1]?.request.range).toEqual({ start: 10, end: 12 })

    calls[1]?.resolve({
      rows: buildRows(10, 12),
      total: 100,
    })
    await flushMicrotasks()

    model.dispose()
  })

  it("dispose aborts active pulls and clears suspended pending work", async () => {
    const { calls, dataSource } = createAbortableDeferredPullDataSource<{ id: number; value: string }>()
    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 100,
    })

    model.setViewportRange({ start: 0, end: 2 })
    expect(calls).toHaveLength(1)

    expect(model.pauseBackpressure()).toBe(true)
    model.setViewportRange({ start: 10, end: 12 })
    await flushMicrotasks()

    expect(calls).toHaveLength(1)
    expect(model.getBackpressureDiagnostics().hasPendingPull).toBe(true)

    model.dispose()
    await flushMicrotasks()

    expect(calls[0]?.request.signal.aborted).toBe(true)
    expect(calls).toHaveLength(1)
  })

  it("propagates group-by state into pull request and issues group-change pull", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          const call: PullCall<{ id: number; value: string }> = {
            request,
            resolve,
            reject,
          }
          calls.push(call)
          request.signal.addEventListener("abort", () => {
            reject({ name: "AbortError" })
          })
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 1_000,
    })

    model.setViewportRange({ start: 10, end: 20 })
    calls[0]?.resolve({
      rows: Array.from({ length: 11 }, (_, offset) => {
        const index = 10 + offset
        return {
          index,
          row: { id: index, value: `row-${index}` },
        }
      }),
      total: 1_000,
    })
    await flushMicrotasks()

    model.setGroupBy({ fields: ["value"], expandedByDefault: true })
    expect(calls[calls.length - 1]?.request.reason).toBe("group-change")
    expect(calls[calls.length - 1]?.request.groupBy).toEqual({
      fields: ["value"],
      expandedByDefault: true,
    })
    expect(calls[calls.length - 1]?.request.groupExpansion).toEqual({
      expandedByDefault: true,
      toggledGroupKeys: [],
    })
    expect(calls[calls.length - 1]?.request.treeData).toEqual({
      operation: "set-group-by",
      scope: "all",
      groupKeys: [],
    })

    model.collapseGroup("value=row-10")
    expect(calls[calls.length - 1]?.request.reason).toBe("group-change")
    expect(calls[calls.length - 1]?.request.groupExpansion).toEqual({
      expandedByDefault: true,
      toggledGroupKeys: ["value=row-10"],
    })
    expect(calls[calls.length - 1]?.request.treeData).toEqual({
      operation: "collapse-group",
      scope: "branch",
      groupKeys: ["value=row-10"],
    })

    model.expandGroup("value=row-10")
    expect(calls[calls.length - 1]?.request.groupExpansion).toEqual({
      expandedByDefault: true,
      toggledGroupKeys: [],
    })
    expect(calls[calls.length - 1]?.request.treeData).toEqual({
      operation: "expand-group",
      scope: "branch",
      groupKeys: ["value=row-10"],
    })

    model.toggleGroup("value=row-10")
    expect(calls[calls.length - 1]?.request.groupExpansion).toEqual({
      expandedByDefault: true,
      toggledGroupKeys: ["value=row-10"],
    })
    expect(calls[calls.length - 1]?.request.treeData).toEqual({
      operation: "toggle-group",
      scope: "branch",
      groupKeys: ["value=row-10"],
    })

    model.expandAllGroups()
    expect(calls[calls.length - 1]?.request.groupExpansion).toEqual({
      expandedByDefault: true,
      toggledGroupKeys: [],
    })
    expect(calls[calls.length - 1]?.request.treeData).toEqual({
      operation: "expand-all-groups",
      scope: "all",
      groupKeys: [],
    })

    model.collapseAllGroups()
    expect(calls[calls.length - 1]?.request.groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [],
    })
    expect(calls[calls.length - 1]?.request.treeData).toEqual({
      operation: "collapse-all-groups",
      scope: "all",
      groupKeys: [],
    })

    model.setGroupExpansion({
      expandedByDefault: false,
      toggledGroupKeys: ["value=row-11", "value=row-12"],
    })
    expect(calls[calls.length - 1]?.request.groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: ["value=row-11", "value=row-12"],
    })
    expect(calls[calls.length - 1]?.request.treeData).toEqual({
      operation: "set-group-expansion",
      scope: "all",
      groupKeys: ["value=row-11", "value=row-12"],
    })

    model.dispose()
  })

  it("coalesces sustained viewport churn into the final pull", async () => {
    const calls: PullCall<{ id: number; value: string }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          const call: PullCall<{ id: number; value: string }> = {
            request,
            resolve,
            reject,
          }
          calls.push(call)
          request.signal.addEventListener("abort", () => {
            reject({ name: "AbortError" })
          })
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 250_000,
    })

    for (let index = 0; index < 150; index += 1) {
      model.setViewportRange({ start: index * 25, end: index * 25 + 30 })
    }

    expect(calls).toHaveLength(1)
    expect(model.getBackpressureDiagnostics().hasPendingPull).toBe(true)

    await flushMicrotasks()

    expect(calls).toHaveLength(2)
    expect(calls[0]?.request.signal.aborted).toBe(true)
    expect(calls[1]?.request.signal.aborted).toBe(false)

    const finalStart = (150 - 1) * 25
    expect(calls[1]?.request.range).toEqual({ start: finalStart, end: finalStart + 30 })
    calls[1]?.resolve({
      rows: Array.from({ length: 31 }, (_, offset) => {
        const rowIndex = finalStart + offset
        return {
          index: rowIndex,
          row: { id: rowIndex, value: `row-${rowIndex}` },
        }
      }),
      total: 250_000,
    })

    await flushMicrotasks()

    expect(model.getRow(finalStart)?.row.value).toBe(`row-${finalStart}`)
    const diagnostics = model.getBackpressureDiagnostics()
    expect(diagnostics.pullRequested).toBe(2)
    expect(diagnostics.pullCoalesced).toBeGreaterThanOrEqual(148)
    expect(diagnostics.pullAborted).toBeGreaterThanOrEqual(1)

    model.dispose()
  })

  it("refreshes visible range invalidation without clearing cached rows first", async () => {
    const invalidate = vi.fn()
    let generation = 0
    const pull = vi.fn(async (request: DataGridDataSourcePullRequest) => {
      const rows = Array.from({ length: request.range.end - request.range.start + 1 }, (_, offset) => {
        const index = request.range.start + offset
        return {
          index,
          row: { id: index, value: generation > 0 ? `row-${index}-fresh` : `row-${index}` },
        }
      })
      return {
        rows,
        total: 1000,
      }
    })
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull,
      invalidate,
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 1000,
    })

    model.setViewportRange({ start: 10, end: 14 })
    await flushMicrotasks()
    expect(model.getRow(12)?.row.value).toBe("row-12")
    expect(model.getRow(11)?.row.value).toBe("row-11")

    generation = 1
    model.invalidateRange({ start: 12, end: 13 })
    expect(model.getRow(12)?.row.value).toBe("row-12")
    expect(model.getRow(11)?.row.value).toBe("row-11")
    expect(model.getSnapshot().loading).toBe(false)
    expect(invalidate).toHaveBeenCalledWith({
      kind: "range",
      range: { start: 12, end: 13 },
      reason: "model-range",
    })

    await flushMicrotasks()
    expect(model.getRow(11)?.row.value).toBe("row-11")
    expect(pull).toHaveBeenLastCalledWith(expect.objectContaining({
      range: { start: 12, end: 13 },
      reason: "invalidation",
    }))
    expect(model.getRow(12)?.row.value).toBe("row-12-fresh")
    expect(model.getRow(13)?.row.value).toBe("row-13-fresh")
    expect(model.getBackpressureDiagnostics().invalidatedRows).toBe(0)

    model.dispose()
  })

  it("refreshes a visible row invalidation without clearing cached rows first", async () => {
    let generation = 0
    const pull = vi.fn(async (request: DataGridDataSourcePullRequest) => {
      const rows = Array.from({ length: request.range.end - request.range.start + 1 }, (_, offset) => {
        const index = request.range.start + offset
        return {
          index,
          row: { id: index, value: generation > 0 ? `row-${index}-fresh` : `row-${index}` },
        }
      })
      return {
        rows,
        total: 1_000,
      }
    })

    const model = createDataSourceBackedRowModel({
      dataSource: { pull },
      resolveRowId: row => row.id,
      initialTotal: 1_000,
    })

    model.setViewportRange({ start: 10, end: 14 })
    await flushMicrotasks()

    expect(model.getRow(11)?.row.value).toBe("row-11")
    expect(model.getRow(12)?.row.value).toBe("row-12")
    expect(model.getRow(13)?.row.value).toBe("row-13")

    generation = 1
    model.invalidateRows([12])

    expect(model.getRow(12)?.row.value).toBe("row-12")
    expect(model.getRow(11)?.row.value).toBe("row-11")
    expect(model.getRow(13)?.row.value).toBe("row-13")
    expect(model.getSnapshot().loading).toBe(false)

    await flushMicrotasks()
    expect(pull).toHaveBeenLastCalledWith(expect.objectContaining({
      range: { start: 12, end: 12 },
      reason: "invalidation",
    }))

    expect(pull).toHaveBeenCalledTimes(2)
    expect(model.getRow(11)?.row.value).toBe("row-11")
    expect(model.getRow(12)?.row.value).toBe("row-12-fresh")
    expect(model.getRow(13)?.row.value).toBe("row-13")
    expect(model.getBackpressureDiagnostics().invalidatedRows).toBe(0)

    model.dispose()
  })

  it("refreshes only the invalidated grouped projection block with tree context", async () => {
    type GroupedRow = { id: string; label: string; region: string }
    const createGroupRow = (
      index: number,
      region: string,
      expanded: boolean,
    ): DataGridDataSourcePullResult<GroupedRow>["rows"][number] => ({
      index,
      rowId: `group:region:${region}`,
      kind: "group",
      state: { expanded },
      groupMeta: {
        groupKey: `group:region:${region}`,
        groupField: "region",
        groupValue: region,
        level: 0,
        childrenCount: 1,
      },
      row: { id: `group:region:${region}`, label: `Region ${region}`, region },
    })
    let generation = 0
    const pull = vi.fn(async (request: DataGridDataSourcePullRequest): Promise<DataGridDataSourcePullResult<GroupedRow>> => {
      const expanded = request.groupExpansion.toggledGroupKeys.includes("group:region:AMER")
      const projection: DataGridDataSourcePullResult<GroupedRow>["rows"] = expanded
        ? [
            createGroupRow(0, "AMER", true),
            {
              index: 1,
              rowId: "srv-amer-1",
              kind: "leaf",
              row: { id: "srv-amer-1", label: generation > 0 ? "AMER fresh" : "AMER", region: "AMER" },
            },
            createGroupRow(2, "EMEA", false),
          ]
        : [
            createGroupRow(0, "AMER", false),
            createGroupRow(1, "EMEA", false),
          ]
      return {
        rows: projection.filter(entry => entry.index >= request.range.start && entry.index <= request.range.end),
        total: projection.length,
      }
    })

    const model = createDataSourceBackedRowModel({
      dataSource: { pull },
      resolveRowId: row => row.id,
      initialTotal: 2,
      initialGroupBy: { fields: ["region"], expandedByDefault: false },
    })

    model.setViewportRange({ start: 0, end: 2 })
    await flushMicrotasks()
    model.expandGroup("group:region:AMER")
    await flushMicrotasks()

    expect(model.getRow(1)?.row.label).toBe("AMER")

    generation = 1
    model.invalidateRange({ start: 1, end: 1 })
    expect(model.getRow(1)?.row.label).toBe("AMER")
    await flushMicrotasks()

    expect(pull).toHaveBeenLastCalledWith(expect.objectContaining({
      range: { start: 1, end: 1 },
      reason: "invalidation",
      treeData: {
        operation: "set-group-expansion",
        scope: "all",
        groupKeys: ["group:region:AMER"],
      },
    }))
    expect(model.getRow(0)?.row.label).toBe("Region AMER")
    expect(model.getRow(1)?.row.label).toBe("AMER fresh")

    model.dispose()
  })

  it("deduplicates row ids and ignores empty row invalidations", async () => {
    const pull = vi.fn(async (request: DataGridDataSourcePullRequest) => {
      const rows = buildRows(request.range.start, request.range.end)
      return {
        rows,
        total: 1_000,
      }
    })

    const model = createDataSourceBackedRowModel({
      dataSource: { pull },
      resolveRowId: row => row.id,
      initialTotal: 1_000,
    })

    model.setViewportRange({ start: 20, end: 24 })
    await flushMicrotasks()

    model.invalidateRows([])
    model.invalidateRows([21, 21, 23, 23, 999])

    expect(pull).toHaveBeenCalledTimes(2)
    expect(model.getRow(20)?.row.value).toBe("row-20")
    expect(model.getRow(21)?.row.value).toBe("row-21")
    expect(model.getRow(22)?.row.value).toBe("row-22")
    expect(model.getRow(23)?.row.value).toBe("row-23")
    expect(model.getRow(24)?.row.value).toBe("row-24")
    expect(model.getSnapshot().loading).toBe(false)

    await flushMicrotasks()

    expect(pull).toHaveBeenCalledTimes(2)
    expect(model.getRow(21)?.row.value).toBe("row-21")
    expect(model.getRow(22)?.row.value).toBe("row-22")
    expect(model.getRow(23)?.row.value).toBe("row-23")

    model.dispose()
  })

  it("only refetches the viewport when invalidated rows are visible", async () => {
    const pull = vi.fn(async (request: DataGridDataSourcePullRequest) => {
      const rows = buildRows(request.range.start, request.range.end)
      return {
        rows,
        total: 1_000,
      }
    })

    const model = createDataSourceBackedRowModel({
      dataSource: { pull },
      resolveRowId: row => row.id,
      initialTotal: 1_000,
    })

    model.setViewportRange({ start: 50, end: 60 })
    await flushMicrotasks()

    model.invalidateRows([500])
    await flushMicrotasks()

    expect(pull).toHaveBeenCalledTimes(1)
    expect(model.getRow(50)?.row.value).toBe("row-50")
    expect(model.getRow(60)?.row.value).toBe("row-60")
    expect(model.getBackpressureDiagnostics().invalidatedRows).toBe(0)

    model.dispose()
  })

  it("does not refetch immediately when invalidated range is outside active viewport", async () => {
    const pull = vi.fn(async (request: DataGridDataSourcePullRequest) => {
      const rows = Array.from({ length: request.range.end - request.range.start + 1 }, (_, offset) => {
        const index = request.range.start + offset
        return {
          index,
          row: { id: index, value: `row-${index}` },
        }
      })
      return {
        rows,
        total: 1_000,
      }
    })

    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull,
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 1_000,
    })

    model.setViewportRange({ start: 50, end: 60 })
    await flushMicrotasks()
    expect(pull).toHaveBeenCalledTimes(1)

    model.invalidateRange({ start: 500, end: 520 })
    await flushMicrotasks()

    expect(pull).toHaveBeenCalledTimes(1)
    expect(model.getBackpressureDiagnostics().invalidatedRows).toBe(0)

    model.dispose()
  })

  it("keeps visible rows during dataset invalidation refresh", async () => {
    const invalidate = vi.fn()
    let generation = 0
    const pull = vi.fn(async (request: DataGridDataSourcePullRequest) => {
      const rows = Array.from({ length: request.range.end - request.range.start + 1 }, (_, offset) => {
        const index = request.range.start + offset
        return {
          index,
          row: { id: index, value: generation > 0 ? `row-${index}-fresh` : `row-${index}` },
        }
      })
      return {
        rows,
        total: 1_000,
      }
    })

    const model = createDataSourceBackedRowModel({
      dataSource: { pull, invalidate },
      resolveRowId: row => row.id,
      initialTotal: 1_000,
    })

    model.setViewportRange({ start: 70, end: 75 })
    await flushMicrotasks()
    expect(model.getRow(72)?.row.value).toBe("row-72")

    generation = 1
    model.invalidateAll()

    expect(model.getRow(72)?.row.value).toBe("row-72")
    expect(model.getSnapshot().refreshing).toBe(true)
    expect(invalidate).toHaveBeenCalledWith({ kind: "all", reason: "model-all" })

    await flushMicrotasks()

    expect(pull).toHaveBeenCalledTimes(2)
    expect(model.getRow(72)?.row.value).toBe("row-72-fresh")
    expect(model.getBackpressureDiagnostics().invalidatedRows).toBe(0)

    model.dispose()
  })

  it("keeps active viewport rows cached under row-cache pressure from out-of-window pushes", async () => {
    let pushListener: DataGridDataSourcePushListener<{ id: number; value: string }> | null = null
    const emitPush = (event: Parameters<DataGridDataSourcePushListener<{ id: number; value: string }>>[0]) => {
      if (pushListener) {
        pushListener(event)
      }
    }
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull(request) {
        const rows = Array.from({ length: request.range.end - request.range.start + 1 }, (_, offset) => {
          const index = request.range.start + offset
          return {
            index,
            row: { id: index, value: `row-${index}` },
          }
        })
        return {
          rows,
          total: 1_000,
        }
      },
      subscribe(listener) {
        pushListener = listener
        return () => {
          pushListener = null
        }
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 1_000,
      rowCacheLimit: 4,
    })

    model.setViewportRange({ start: 50, end: 52 })
    await flushMicrotasks()

    expect(model.getRow(50)?.row.value).toBe("row-50")
    expect(model.getRow(51)?.row.value).toBe("row-51")
    expect(model.getRow(52)?.row.value).toBe("row-52")

    emitPush({
      type: "upsert",
      rows: [
        { index: 0, row: { id: 0, value: "row-0" } },
        { index: 1, row: { id: 1, value: "row-1" } },
      ],
      total: 1_000,
    })

    expect(model.getRow(50)?.row.value).toBe("row-50")
    expect(model.getRow(51)?.row.value).toBe("row-51")
    expect(model.getRow(52)?.row.value).toBe("row-52")
    expect(model.getRow(1)?.row.value).toBe("row-1")

    const diagnostics = model.getBackpressureDiagnostics()
    expect(diagnostics.rowCacheEvicted).toBeGreaterThanOrEqual(1)

    model.dispose()
  })

  it("keeps row-cache bounded under long viewport churn", async () => {
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      async pull(request) {
        return {
          rows: Array.from({ length: request.range.end - request.range.start + 1 }, (_, offset) => {
            const index = request.range.start + offset
            return {
              index,
              row: { id: index, value: `row-${index}` },
            }
          }),
          total: 120_000,
        }
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 120_000,
      rowCacheLimit: 64,
    })

    for (let step = 0; step < 180; step += 1) {
      const start = step * 19
      model.setViewportRange({ start, end: start + 35 })
      await flushMicrotasks()
      const diagnostics = model.getBackpressureDiagnostics()
      expect(diagnostics.rowCacheSize).toBeLessThanOrEqual(diagnostics.rowCacheLimit)
    }

    const diagnostics = model.getBackpressureDiagnostics()
    expect(diagnostics.rowCacheLimit).toBe(64)
    expect(diagnostics.rowCacheSize).toBeLessThanOrEqual(64)
    expect(diagnostics.rowCacheEvicted).toBeGreaterThan(0)
    expect(diagnostics.inFlight).toBe(false)
    expect(diagnostics.hasPendingPull).toBe(false)

    model.dispose()
  })

  it("applies push updates and handles push invalidation with refetch", async () => {
    const invalidate = vi.fn()
    let pushListener: DataGridDataSourcePushListener<{ id: number; value: string }> | null = null
    const emitPush = (event: Parameters<DataGridDataSourcePushListener<{ id: number; value: string }>>[0]) => {
      if (pushListener) {
        pushListener(event)
      }
    }
    const pull = vi.fn(async (request: DataGridDataSourcePullRequest) => {
      const rows = Array.from({ length: request.range.end - request.range.start + 1 }, (_, offset) => {
        const index = request.range.start + offset
        return {
          index,
          row: { id: index, value: `row-${index}` },
        }
      })
      return {
        rows,
        total: 500,
      }
    })

    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull,
      subscribe(listener) {
        pushListener = listener
        return () => {
          pushListener = null
        }
      },
      invalidate,
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 500,
    })

    model.setViewportRange({ start: 0, end: 2 })
    await flushMicrotasks()
    expect(model.getRow(1)?.row.value).toBe("row-1")

    emitPush({
      type: "upsert",
      rows: [{ index: 1, row: { id: 1, value: "patched-1" } }],
      total: 500,
    })
    expect(model.getRow(1)?.row.value).toBe("patched-1")

    emitPush({
      type: "invalidate",
      invalidation: { kind: "all", reason: "stream-reset" },
    })
    expect(model.getRow(1)?.row.value).toBe("patched-1")
    expect(model.getSnapshot().refreshing).toBe(true)
    await flushMicrotasks()

    expect(pull.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(invalidate).toHaveBeenCalledWith({ kind: "all", reason: "stream-reset" })
    expect(model.getRow(1)?.row.value).toBe("row-1")
    expect(model.getBackpressureDiagnostics().pushApplied).toBe(2)

    model.dispose()
  })

  it("sends pivot+pagination context and reuses cursor across pulls", async () => {
    const calls: PullCall<{ id: number; value: number; region: string; year: number }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: number; region: string; year: number }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          calls.push({
            request,
            resolve,
            reject,
          })
          request.signal.addEventListener("abort", () => reject({ name: "AbortError" }))
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 1_000,
      initialPagination: { pageSize: 25, currentPage: 2 },
      initialPivotModel: {
        rows: ["region"],
        columns: ["year"],
        values: [{ field: "value", agg: "sum" }],
      },
    })

    model.setViewportRange({ start: 0, end: 10 })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.request.pivot?.pivotModel).toEqual({
      rows: ["region"],
      columns: ["year"],
      values: [{ field: "value", agg: "sum" }],
    })
    expect(calls[0]?.request.pagination.snapshot.pageSize).toBe(25)
    expect(calls[0]?.request.pagination.snapshot.currentPage).toBe(2)
    expect(calls[0]?.request.pagination.cursor).toBeNull()

    calls[0]?.resolve({
      rows: [{ index: 0, row: { id: 1, value: 10, region: "EMEA", year: 2024 } }],
      total: 1_000,
      cursor: "cursor:page-2",
      pivotColumns: [
        {
          id: "pivot|year=2024|v:sum:value",
          valueField: "value",
          agg: "sum",
          label: "year=2024 · sum(value)",
          columnPath: [{ field: "year", value: "2024" }],
        },
      ],
    })
    await flushMicrotasks()

    model.setViewportRange({ start: 5, end: 15 })
    expect(calls).toHaveLength(2)
    expect(calls[1]?.request.pagination.cursor).toBe("cursor:page-2")

    calls[1]?.resolve({
      rows: [{ index: 5, row: { id: 6, value: 20, region: "EMEA", year: 2024 } }],
      total: 1_000,
    })
    await flushMicrotasks()

    model.dispose()
  })

  it("keeps pivot column metadata when server returns partial upsert/pull payloads", async () => {
    const calls: PullCall<{ id: number; value: number; region: string; year: number }>[] = []
    const dataSource: DataGridDataSource<{ id: number; value: number; region: string; year: number }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          calls.push({ request, resolve, reject })
          request.signal.addEventListener("abort", () => reject({ name: "AbortError" }))
        })
      },
    }

    const model = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id,
      initialTotal: 100,
      initialPivotModel: {
        rows: ["region"],
        columns: ["year"],
        values: [{ field: "value", agg: "sum" }],
      },
    })

    model.setViewportRange({ start: 0, end: 10 })
    calls[0]?.resolve({
      rows: [{ index: 0, row: { id: 1, value: 42, region: "EMEA", year: 2024 } }],
      total: 100,
      pivotColumns: [
        {
          id: "pivot|year=2024|v:sum:value",
          valueField: "value",
          agg: "sum",
          label: "year=2024 · sum(value)",
          columnPath: [{ field: "year", value: "2024" }],
        },
      ],
    })
    await flushMicrotasks()

    expect(model.getSnapshot().pivotColumns?.length).toBe(1)

    model.setViewportRange({ start: 20, end: 30 })
    calls[1]?.resolve({
      rows: [{ index: 20, row: { id: 21, value: 11, region: "EMEA", year: 2024 } }],
      total: 100,
    })
    await flushMicrotasks()

    expect(model.getSnapshot().pivotColumns?.length).toBe(1)
    expect(model.getSnapshot().pivotColumns?.[0]?.label).toContain("year=2024")

    model.dispose()
  })

  it("keeps client/server pivot layout semantics aligned for same pivot model", async () => {
    const sourceRows = [
      { id: 1, region: "EMEA", year: 2024, value: 10 },
      { id: 2, region: "EMEA", year: 2025, value: 20 },
      { id: 3, region: "APAC", year: 2024, value: 15 },
      { id: 4, region: "APAC", year: 2025, value: 25 },
    ]
    const pivotModel = {
      rows: ["region"],
      columns: ["year"],
      values: [{ field: "value", agg: "sum" as const }],
      grandTotal: true,
      columnGrandTotal: true,
    }

    const client = createClientRowModel({
      rows: sourceRows,
      resolveRowId: row => row.id,
      initialPivotModel: pivotModel,
    })
    client.refresh("manual")
    const clientSnapshot = client.getSnapshot()
    const clientRows = client.getRowsInRange({
      start: 0,
      end: Math.max(0, client.getRowCount() - 1),
    })

    const dataSource: DataGridDataSource<Record<string, unknown>> = {
      async pull(request) {
        const serverBuilder = createClientRowModel({
          rows: sourceRows,
          resolveRowId: row => row.id,
          initialPivotModel: request.pivot?.pivotModel ?? pivotModel,
        })
        serverBuilder.refresh("manual")
        const snapshot = serverBuilder.getSnapshot()
        const rows = serverBuilder.getRowsInRange({
          start: 0,
          end: Math.max(0, serverBuilder.getRowCount() - 1),
        }).map((row, index) => ({
          index,
          rowId: row.rowId,
          kind: row.kind,
          groupMeta: row.groupMeta,
          state: row.state,
          row: row.data as Record<string, unknown>,
        }))
        serverBuilder.dispose()
        return {
          rows,
          total: rows.length,
          pivotColumns: snapshot.pivotColumns ?? [],
        }
      },
    }

    const server = createDataSourceBackedRowModel({
      dataSource,
      resolveRowId: row => row.id as number,
      initialTotal: 0,
      initialPivotModel: pivotModel,
    })
    server.setViewportRange({ start: 0, end: 200 })
    await flushMicrotasks()
    const serverSnapshot = server.getSnapshot()
    const serverRows = server.getRowsInRange({
      start: 0,
      end: Math.max(0, server.getRowCount() - 1),
    })

    expect(serverSnapshot.pivotColumns?.map(column => column.label)).toEqual(
      clientSnapshot.pivotColumns?.map(column => column.label),
    )
    expect(serverRows.map(row => String(row.rowId))).toEqual(clientRows.map(row => String(row.rowId)))
    expect(serverRows.map(row => row.kind)).toEqual(clientRows.map(row => row.kind))

    server.dispose()
    client.dispose()
  })

  it("builds deterministic server pivot row ids", () => {
    const idA = createDataGridServerPivotRowId({
      role: "group",
      rowDepth: 1,
      rowPath: [{ field: "region", value: "EMEA" }],
      marker: "node",
    })
    const idB = createDataGridServerPivotRowId({
      role: "group",
      rowDepth: 1,
      rowPath: [{ field: "region", value: "EMEA" }],
      marker: "node",
    })
    const idC = createDataGridServerPivotRowId({
      role: "group",
      rowDepth: 1,
      rowPath: [{ field: "region", value: "APAC" }],
      marker: "node",
    })
    expect(idA).toBe(idB)
    expect(idA).not.toBe(idC)
  })
})
