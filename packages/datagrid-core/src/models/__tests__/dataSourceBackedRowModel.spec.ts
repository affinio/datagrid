import { describe, expect, it, vi } from "vitest"
import { createDataSourceBackedRowModel } from "../index"
import type {
  DataGridDataSource,
  DataGridDataSourcePullRequest,
  DataGridDataSourcePullResult,
  DataGridDataSourcePushListener,
} from "../dataSourceProtocol"

interface PullCall {
  request: DataGridDataSourcePullRequest
  resolve: (result: DataGridDataSourcePullResult<{ id: number; value: string }>) => void
  reject: (reason?: unknown) => void
}

function flushMicrotasks(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve())
}

describe("createDataSourceBackedRowModel", () => {
  it("enforces abort-first backpressure under viewport overload", async () => {
    const calls: PullCall[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          const call: PullCall = {
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

  it("keeps only last pull active under sustained viewport churn", async () => {
    const calls: PullCall[] = []
    const dataSource: DataGridDataSource<{ id: number; value: string }> = {
      pull(request) {
        return new Promise((resolve, reject) => {
          const call: PullCall = {
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

  it("applies push updates and handles push invalidation with refetch", async () => {
    const invalidate = vi.fn()
    let pushListener: DataGridDataSourcePushListener<{ id: number; value: string }> | null = null
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

    pushListener?.({
      type: "upsert",
      rows: [{ index: 1, row: { id: 1, value: "patched-1" } }],
      total: 500,
    })
    expect(model.getRow(1)?.row.value).toBe("patched-1")

    pushListener?.({
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
})
