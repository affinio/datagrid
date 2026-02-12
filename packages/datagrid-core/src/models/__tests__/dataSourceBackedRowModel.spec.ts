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

  it("defers lower-priority invalidation pull while critical viewport pull is inflight", async () => {
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
})
