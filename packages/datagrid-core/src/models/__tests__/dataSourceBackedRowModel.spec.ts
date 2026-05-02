import { describe, expect, it, vi } from "vitest"
import {
  createClientRowModel,
  createDataGridServerPivotRowId,
  createDataSourceBackedRowModel,
} from "../index"
import type {
  DataGridDataSource,
  DataGridDataSourceColumnHistogramRequest,
  DataGridDataSourcePullRequest,
  DataGridDataSourcePullResult,
  DataGridDataSourcePushListener,
} from "../server/dataSourceProtocol"

interface PullCall<TRow> {
  request: DataGridDataSourcePullRequest
  resolve: (result: DataGridDataSourcePullResult<TRow>) => void
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

function readLoadingState(model: { getSnapshot(): unknown }) {
  return model.getSnapshot() as {
    initialLoading: boolean
    refreshing: boolean
    loading: boolean
  }
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

    const histogram = await model.getColumnHistogram?.("status", {
      ignoreSelfFilter: true,
      orderBy: "valueAsc",
      search: " active ",
    })

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
    expect(readLoadingState(model)).toMatchObject({
      initialLoading: true,
      refreshing: false,
      loading: true,
    })

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
    expect(readLoadingState(model)).toMatchObject({
      initialLoading: false,
      refreshing: true,
      loading: true,
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
    expect(readLoadingState(model)).toMatchObject({
      initialLoading: false,
      refreshing: true,
      loading: true,
    })

    calls[1]?.resolve({
      rows: [
        { index: 0, row: { id: 1, value: "sorted-1" }, rowId: 1 },
        { index: 1, row: { id: 2, value: "sorted-2" }, rowId: 2 },
      ],
      total: 2,
    })
    await flushMicrotasks()
    await flushMicrotasks()

    expect(readLoadingState(model)).toMatchObject({
      initialLoading: false,
      refreshing: false,
      loading: false,
    })

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
    expect((model.getSnapshot() as { initialLoading: boolean; refreshing: boolean }).initialLoading).toBe(true)
    expect((model.getSnapshot() as { initialLoading: boolean; refreshing: boolean }).refreshing).toBe(false)
    calls[0]?.resolve({
      rows: [
        { index: 0, row: { id: 1, value: "old-1" }, rowId: 1 },
        { index: 1, row: { id: 2, value: "old-2" }, rowId: 2 },
      ],
      total: 2,
    })
    await flushMicrotasks()

    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual(["old-1", "old-2"])
    expect((model.getSnapshot() as { initialLoading: boolean; refreshing: boolean }).initialLoading).toBe(false)
    expect((model.getSnapshot() as { initialLoading: boolean; refreshing: boolean }).refreshing).toBe(false)

    const sortModel = [{ key: "value", direction: "asc" as const }]
    model.setSortModel(sortModel)

    expect(calls).toHaveLength(2)
    expect(calls[1]?.request.sortModel).toEqual(sortModel)
    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual(["old-1", "old-2"])
    expect((model.getSnapshot() as { initialLoading: boolean; refreshing: boolean }).initialLoading).toBe(false)
    expect((model.getSnapshot() as { initialLoading: boolean; refreshing: boolean }).refreshing).toBe(true)

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
    expect((model.getSnapshot() as { initialLoading: boolean; refreshing: boolean }).refreshing).toBe(false)

    model.dispose()
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
    }
    model.setFilterModel(filterModel)

    expect(calls).toHaveLength(2)
    expect(calls[1]?.request.filterModel).toMatchObject(filterModel)
    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual(["old-1", "old-2"])
    expect((model.getSnapshot() as { initialLoading: boolean; refreshing: boolean }).initialLoading).toBe(false)
    expect((model.getSnapshot() as { initialLoading: boolean; refreshing: boolean }).refreshing).toBe(true)

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
    expect((model.getSnapshot() as { initialLoading: boolean; refreshing: boolean }).refreshing).toBe(false)

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

    const sortModel = [{ key: "value", direction: "asc" as const }]
    const filterModel = {
      columnFilters: {
        status: { kind: "valueSet", tokens: ["string:active"] },
      },
      advancedFilters: {},
    }
    model.setSortAndFilterModel?.({
      sortModel,
      filterModel,
    })

    expect(calls).toHaveLength(2)
    expect(calls[1]?.request.sortModel).toEqual(sortModel)
    expect(calls[1]?.request.filterModel).toMatchObject(filterModel)
    expect(model.getRowsInRange({ start: 0, end: 1 })?.map(row => row.row.value)).toEqual(["old-1", "old-2"])
    expect((model.getSnapshot() as { initialLoading: boolean; refreshing: boolean }).initialLoading).toBe(false)
    expect((model.getSnapshot() as { initialLoading: boolean; refreshing: boolean }).refreshing).toBe(true)

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
    expect((model.getSnapshot() as { initialLoading: boolean; refreshing: boolean }).refreshing).toBe(false)

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

  it("exposes patchRows when the data source implements commitEdits and refreshes after commit", async () => {
    const rows = [
      { id: 1, value: "row-1" },
      { id: 2, value: "row-2" },
    ]
    const commitEdits = vi.fn(async ({ edits }: { edits: readonly Array<{ rowId: number; data: { value?: string } }> }) => {
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

    expect(typeof model.patchRows).toBe("function")

    model.setViewportRange({ start: 0, end: 0 })
    await flushMicrotasks()

    model.patchRows?.([
      { rowId: 1, data: { value: "updated" } },
    ])

    await flushMicrotasks()
    await flushMicrotasks()

    expect(commitEdits).toHaveBeenCalledWith({
      edits: [
        { rowId: 1, data: { value: "updated" } },
      ],
    })
    expect(model.getRow(0)?.row.value).toBe("updated")

    model.dispose()
  })

  it("waits for the refresh pull to complete before resolving patchRows", async () => {
    const rows = [
      { id: 1, value: "row-1" },
    ]
    let resolveRefresh: ((result: DataGridDataSourcePullResult<{ id: number; value: string }>) => void) | null = null
    const commitEdits = vi.fn(async ({ edits }: { edits: readonly Array<{ rowId: number; data: { value?: string } }> }) => {
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
    })

    model.setViewportRange({ start: 0, end: 0 })
    await flushMicrotasks()

    const patchPromise = Promise.resolve(model.patchRows?.([
      { rowId: 1, data: { value: "updated" } },
    ]))
    let resolved = false
    patchPromise.then(() => {
      resolved = true
    })

    await flushMicrotasks()
    expect(resolved).toBe(false)
    expect(resolveRefresh).not.toBeNull()

    resolveRefresh?.({
      rows: [
        { index: 0, row: rows[0]!, rowId: 1 },
      ],
      total: rows.length,
    })
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

    model.patchRows?.([
      { rowId: 1, data: { value: "updated" } },
    ])

    await flushMicrotasks()
    await flushMicrotasks()

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

    model.patchRows?.([
      { rowId: 1, data: { value: "updated" } },
    ])

    await flushMicrotasks()
    await flushMicrotasks()

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

  it("enforces abort-first backpressure under viewport overload", async () => {
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

    expect(calls).toHaveLength(3)
    expect(calls[0]?.request.signal.aborted).toBe(true)
    expect(calls[1]?.request.signal.aborted).toBe(true)
    expect(calls[2]?.request.signal.aborted).toBe(false)
    expect(calls[2]?.request.groupBy).toBeNull()
    expect(calls[2]?.request.groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [],
    })
    expect(calls[2]?.request.treeData).toBeNull()

    calls[2]?.resolve({
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
    expect(diagnostics.pullRequested).toBe(3)
    expect(diagnostics.pullAborted).toBeGreaterThanOrEqual(2)
    expect(diagnostics.pullCompleted).toBe(1)

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

    pushListener?.({
      type: "upsert",
      rows: [{ index: 5, row: { id: 5, value: "patched-5" } }],
      total: 100_000,
    })
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
    expect(diagnostics.pullDeferred).toBe(0)

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

    model.toggleGroup("value=row-10")
    expect(calls[calls.length - 1]?.request.reason).toBe("group-change")
    expect(calls[calls.length - 1]?.request.groupExpansion).toEqual({
      expandedByDefault: true,
      toggledGroupKeys: ["value=row-10"],
    })
    expect(calls[calls.length - 1]?.request.treeData).toEqual({
      operation: "toggle-group",
      scope: "branch",
      groupKeys: ["value=row-10"],
    })

    model.collapseGroup("value=row-10")
    expect(calls[calls.length - 1]?.request.groupExpansion).toEqual({
      expandedByDefault: true,
      toggledGroupKeys: [],
    })
    expect(calls[calls.length - 1]?.request.treeData).toEqual({
      operation: "collapse-group",
      scope: "branch",
      groupKeys: ["value=row-10"],
    })

    model.expandGroup("value=row-10")
    expect(calls[calls.length - 1]?.request.groupExpansion).toEqual({
      expandedByDefault: true,
      toggledGroupKeys: ["value=row-10"],
    })
    expect(calls[calls.length - 1]?.request.treeData).toEqual({
      operation: "expand-group",
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

  it("keeps only last pull active under sustained viewport churn", async () => {
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

    expect(calls).toHaveLength(150)
    expect(calls.slice(0, -1).every(call => call.request.signal.aborted)).toBe(true)
    expect(calls[calls.length - 1]?.request.signal.aborted).toBe(false)

    const finalStart = (150 - 1) * 25
    calls[calls.length - 1]?.resolve({
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
    expect(model.getBackpressureDiagnostics().pullAborted).toBeGreaterThanOrEqual(149)

    model.dispose()
  })

  it("supports partial invalidation without clearing unaffected cache", async () => {
    const invalidate = vi.fn()
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
          total: 1000,
        }
      },
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

    model.invalidateRange({ start: 12, end: 13 })
    expect(model.getRow(12)).toBeUndefined()
    expect(model.getRow(11)?.row.value).toBe("row-11")
    expect(invalidate).toHaveBeenCalledWith({
      kind: "range",
      range: { start: 12, end: 13 },
      reason: "model-range",
    })

    await flushMicrotasks()
    expect(model.getRow(12)?.row.value).toBe("row-12")
    expect(model.getBackpressureDiagnostics().invalidatedRows).toBeGreaterThanOrEqual(2)

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

  it("keeps active viewport rows cached under row-cache pressure from out-of-window pushes", async () => {
    let pushListener: DataGridDataSourcePushListener<{ id: number; value: string }> | null = null
    const emitPush = (event: Parameters<DataGridDataSourcePushListener<{ id: number; value: string }>>[0]) => {
      ;(pushListener as DataGridDataSourcePushListener<{ id: number; value: string }> | null)?.(event)
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
      ;(pushListener as DataGridDataSourcePushListener<{ id: number; value: string }> | null)?.(event)
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
    expect(model.getRow(1)).toBeUndefined()
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
