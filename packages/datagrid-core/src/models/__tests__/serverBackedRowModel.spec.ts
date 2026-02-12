import { describe, expect, it, vi } from "vitest"
import { createServerBackedRowModel } from "../index"
import type { ServerRowModel } from "../../serverRowModel/serverRowModel"

function createSource(count: number) {
  const rows = Array.from({ length: count }, (_, index) => ({ id: index }))
  const fetchBlock = vi.fn(async () => {})
  const reset = vi.fn()

  const source: ServerRowModel<{ id: number }> = {
    rows: { value: rows },
    loading: { value: false },
    error: { value: null },
    blocks: { value: new Map() },
    total: { value: count },
    loadedRanges: { value: [] },
    progress: { value: 1 },
    blockErrors: { value: new Map() },
    diagnostics: {
      value: {
        cacheBlocks: 0,
        cachedRows: count,
        pendingBlocks: 0,
        pendingRequests: 0,
        abortedRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        effectivePreloadThreshold: 0.6,
      },
    },
    getRowAt(index) {
      return rows[index]
    },
    getRowCount() {
      return count
    },
    refreshBlock: vi.fn(async () => {}),
    fetchBlock,
    reset,
    abortAll: vi.fn(),
    dispose: vi.fn(),
  }

  return { source, fetchBlock, reset }
}

describe("createServerBackedRowModel", () => {
  it("adapts server model snapshot and warms viewport", async () => {
    const { source, fetchBlock } = createSource(50)
    const model = createServerBackedRowModel({ source })
    model.setViewportRange({ start: 2, end: 10 })
    await Promise.resolve()
    await Promise.resolve()
    expect(fetchBlock).toHaveBeenCalledWith(0)
    expect(model.getSnapshot().viewportRange).toEqual({ start: 2, end: 10 })
    expect(model.getSnapshot().warming).toBe(false)
    const node = model.getRow(2)
    expect(node?.data.id).toBe(2)
    expect(node?.row.id).toBe(2)
    expect(node?.rowKey).toBe(2)
    expect(node?.sourceIndex).toBe(2)
    expect(node?.displayIndex).toBe(2)
    expect(node?.state.pinned).toBe("none")
    expect(model.getSnapshot().groupBy).toBeNull()
    expect(model.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [],
    })
    model.dispose()
  })

  it("warms full viewport span using configured block step", async () => {
    const { source, fetchBlock } = createSource(2_000)
    const model = createServerBackedRowModel({
      source,
      warmupBlockStep: 200,
    })

    model.setViewportRange({ start: 0, end: 620 })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(fetchBlock.mock.calls.map(call => call[0])).toEqual([0, 200, 400, 600])
    model.dispose()
  })

  it("tracks group expansion toggles in snapshot", () => {
    const { source } = createSource(10)
    const model = createServerBackedRowModel({
      source,
      initialGroupBy: { fields: ["id"], expandedByDefault: false },
    })

    model.toggleGroup("id=1")
    expect(model.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: ["id=1"],
    })

    model.toggleGroup("id=1")
    expect(model.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [],
    })

    model.dispose()
  })

  it("supports explicit expansion APIs and snapshot roundtrip", () => {
    const { source } = createSource(10)
    const model = createServerBackedRowModel({
      source,
      initialGroupBy: { fields: ["id"], expandedByDefault: false },
    })

    model.expandGroup("id=1")
    expect(model.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: ["id=1"],
    })

    model.collapseGroup("id=1")
    expect(model.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [],
    })

    model.expandAllGroups()
    expect(model.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: true,
      toggledGroupKeys: [],
    })

    model.setGroupExpansion({
      expandedByDefault: false,
      toggledGroupKeys: ["id=2", "id=3"],
    })
    expect(model.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: ["id=2", "id=3"],
    })

    model.collapseAllGroups()
    expect(model.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [],
    })

    model.dispose()
  })

  it("does not re-fetch for unchanged viewport range", async () => {
    const { source, fetchBlock } = createSource(20)
    const model = createServerBackedRowModel({ source })
    model.setViewportRange({ start: 1, end: 4 })
    await Promise.resolve()
    const callCount = fetchBlock.mock.calls.length
    model.setViewportRange({ start: 1, end: 4 })
    await Promise.resolve()
    expect(fetchBlock.mock.calls.length).toBe(callCount)
    model.dispose()
  })

  it("deduplicates viewport warmup when refresh overlaps inflight range fetch", async () => {
    const { source, fetchBlock } = createSource(40)
    const pendingResolves: Array<() => void> = []
    fetchBlock.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          pendingResolves.push(resolve)
        }),
    )
    const model = createServerBackedRowModel({ source })

    model.setViewportRange({ start: 5, end: 9 })
    const refreshPromise = model.refresh("viewport-change")
    await Promise.resolve()

    // Overlapping refresh should reuse inflight warmup, not trigger a duplicate fetch start.
    expect(fetchBlock).toHaveBeenCalledTimes(1)
    expect(fetchBlock.mock.calls[0]).toEqual([0])

    pendingResolves.shift()?.()
    await Promise.resolve()

    expect(fetchBlock).toHaveBeenCalledTimes(1)
    await refreshPromise
    model.dispose()
  })

  it("cancels stale warmup range when a newer viewport range supersedes it", async () => {
    const { source, fetchBlock } = createSource(4_000)
    const pendingResolves = new Map<number, () => void>()
    fetchBlock.mockImplementation((startIndex: number) => {
      return new Promise<void>(resolve => {
        pendingResolves.set(startIndex, resolve)
      })
    })

    const model = createServerBackedRowModel({
      source,
      warmupBlockStep: 200,
    })

    model.setViewportRange({ start: 0, end: 650 })
    await Promise.resolve()
    expect(fetchBlock.mock.calls.map(call => call[0])).toEqual([0])

    model.setViewportRange({ start: 1_200, end: 1_700 })
    await Promise.resolve()
    expect(fetchBlock.mock.calls.map(call => call[0])).toEqual([0, 1200])

    pendingResolves.get(0)?.()
    await Promise.resolve()
    expect(fetchBlock.mock.calls.map(call => call[0])).toEqual([0, 1200])

    pendingResolves.get(1200)?.()
    await Promise.resolve()
    expect(fetchBlock.mock.calls.map(call => call[0])).toEqual([0, 1200, 1400])

    pendingResolves.get(1400)?.()
    await Promise.resolve()
    expect(fetchBlock.mock.calls.map(call => call[0])).toEqual([0, 1200, 1400, 1600])

    pendingResolves.get(1600)?.()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(model.getSnapshot().warming).toBe(false)
    model.dispose()
  })

  it("calls source.reset on refresh(reset)", async () => {
    const { source, reset } = createSource(15)
    const model = createServerBackedRowModel({ source })
    await model.refresh("reset")
    expect(reset).toHaveBeenCalledTimes(1)
    model.dispose()
  })

  it("throws when server row identity is missing and resolver is not provided", () => {
    const rows = [{ value: "a" }]
    const source: ServerRowModel<{ value: string }> = {
      rows: { value: rows },
      loading: { value: false },
      error: { value: null },
      blocks: { value: new Map() },
      total: { value: rows.length },
      loadedRanges: { value: [] },
      progress: { value: 1 },
      blockErrors: { value: new Map() },
      diagnostics: {
        value: {
          cacheBlocks: 0,
          cachedRows: rows.length,
          pendingBlocks: 0,
          pendingRequests: 0,
          abortedRequests: 0,
          cacheHits: 0,
          cacheMisses: 0,
          effectivePreloadThreshold: 0.6,
        },
      },
      getRowAt(index) {
        return rows[index]
      },
      getRowCount() {
        return rows.length
      },
      refreshBlock: vi.fn(async () => {}),
      fetchBlock: vi.fn(async () => {}),
      reset: vi.fn(),
      abortAll: vi.fn(),
      dispose: vi.fn(),
    }

    const model = createServerBackedRowModel({ source })
    expect(() => model.getRow(0)).toThrowError(/Missing row identity/)
    model.dispose()
  })

  it("uses explicit resolver for server row identity", () => {
    const rows = [{ uuid: "r-1", value: "a" }]
    const source: ServerRowModel<{ uuid: string; value: string }> = {
      rows: { value: rows },
      loading: { value: false },
      error: { value: null },
      blocks: { value: new Map() },
      total: { value: rows.length },
      loadedRanges: { value: [] },
      progress: { value: 1 },
      blockErrors: { value: new Map() },
      diagnostics: {
        value: {
          cacheBlocks: 0,
          cachedRows: rows.length,
          pendingBlocks: 0,
          pendingRequests: 0,
          abortedRequests: 0,
          cacheHits: 0,
          cacheMisses: 0,
          effectivePreloadThreshold: 0.6,
        },
      },
      getRowAt(index) {
        return rows[index]
      },
      getRowCount() {
        return rows.length
      },
      refreshBlock: vi.fn(async () => {}),
      fetchBlock: vi.fn(async () => {}),
      reset: vi.fn(),
      abortAll: vi.fn(),
      dispose: vi.fn(),
    }

    const model = createServerBackedRowModel({
      source,
      resolveRowId: row => row.uuid,
    })
    expect(model.getRow(0)?.rowKey).toBe("r-1")
    model.dispose()
  })

  it("bounds row cache with LRU eviction policy", () => {
    const rows = Array.from({ length: 8 }, (_, index) => ({ id: index }))
    const getRowAt = vi.fn((index: number) => rows[index])

    const source: ServerRowModel<{ id: number }> = {
      rows: { value: rows },
      loading: { value: false },
      error: { value: null },
      blocks: { value: new Map() },
      total: { value: rows.length },
      loadedRanges: { value: [] },
      progress: { value: 1 },
      blockErrors: { value: new Map() },
      diagnostics: {
        value: {
          cacheBlocks: 0,
          cachedRows: rows.length,
          pendingBlocks: 0,
          pendingRequests: 0,
          abortedRequests: 0,
          cacheHits: 0,
          cacheMisses: 0,
          effectivePreloadThreshold: 0.6,
        },
      },
      getRowAt,
      getRowCount() {
        return rows.length
      },
      refreshBlock: vi.fn(async () => {}),
      fetchBlock: vi.fn(async () => {}),
      reset: vi.fn(),
      abortAll: vi.fn(),
      dispose: vi.fn(),
    }

    const model = createServerBackedRowModel({
      source,
      rowCacheLimit: 2,
    })

    expect(model.getRow(0)?.rowKey).toBe(0)
    expect(model.getRow(1)?.rowKey).toBe(1)
    expect(model.getRow(2)?.rowKey).toBe(2)
    expect(getRowAt).toHaveBeenCalledTimes(3)

    // Still cached due recent access window (cache contains 1,2).
    expect(model.getRow(1)?.rowKey).toBe(1)
    expect(getRowAt).toHaveBeenCalledTimes(3)

    // Row 0 should be evicted and re-read from source.
    expect(model.getRow(0)?.rowKey).toBe(0)
    expect(getRowAt).toHaveBeenCalledTimes(4)

    model.dispose()
  })

  it("reuses row node objects across viewport refresh when identity stays stable", async () => {
    const { source } = createSource(24)
    const model = createServerBackedRowModel({ source })

    model.setViewportRange({ start: 4, end: 9 })
    await Promise.resolve()
    await model.refresh("viewport-change")

    const first = model.getRow(5)
    expect(first?.rowKey).toBe(5)

    await model.refresh("viewport-change")
    const second = model.getRow(5)

    expect(second).toBe(first)
    expect(second?.displayIndex).toBe(5)

    model.dispose()
  })

  it("updates cached row node payload in-place when source row instance changes", async () => {
    const rows = [{ id: 0, value: "initial" }]
    const source: ServerRowModel<{ id: number; value: string }> = {
      rows: { value: rows },
      loading: { value: false },
      error: { value: null },
      blocks: { value: new Map() },
      total: { value: rows.length },
      loadedRanges: { value: [] },
      progress: { value: 1 },
      blockErrors: { value: new Map() },
      diagnostics: {
        value: {
          cacheBlocks: 0,
          cachedRows: rows.length,
          pendingBlocks: 0,
          pendingRequests: 0,
          abortedRequests: 0,
          cacheHits: 0,
          cacheMisses: 0,
          effectivePreloadThreshold: 0.6,
        },
      },
      getRowAt(index) {
        return rows[index]
      },
      getRowCount() {
        return rows.length
      },
      refreshBlock: vi.fn(async () => {}),
      fetchBlock: vi.fn(async () => {}),
      reset: vi.fn(),
      abortAll: vi.fn(),
      dispose: vi.fn(),
    }

    const model = createServerBackedRowModel({ source })
    const first = model.getRow(0)
    expect(first?.row.value).toBe("initial")

    rows[0] = { id: 0, value: "updated" }
    await model.refresh("viewport-change")

    const second = model.getRow(0)
    expect(second).toBe(first)
    expect(second?.row.value).toBe("updated")
    expect(second?.data.value).toBe("updated")

    model.dispose()
  })

  it("does not cache missing rows (undefined) between reads", () => {
    const rows: Array<{ id: number; value: string } | undefined> = [
      { id: 0, value: "ready" },
      undefined,
      { id: 2, value: "ready-2" },
    ]
    const getRowAt = vi.fn((index: number) => rows[index])
    const source: ServerRowModel<{ id: number; value: string } | undefined> = {
      rows: { value: rows },
      loading: { value: false },
      error: { value: null },
      blocks: { value: new Map() },
      total: { value: rows.length },
      loadedRanges: { value: [] },
      progress: { value: 1 },
      blockErrors: { value: new Map() },
      diagnostics: {
        value: {
          cacheBlocks: 0,
          cachedRows: 2,
          pendingBlocks: 0,
          pendingRequests: 0,
          abortedRequests: 0,
          cacheHits: 0,
          cacheMisses: 0,
          effectivePreloadThreshold: 0.6,
        },
      },
      getRowAt,
      getRowCount() {
        return rows.length
      },
      refreshBlock: vi.fn(async () => {}),
      fetchBlock: vi.fn(async () => {}),
      reset: vi.fn(),
      abortAll: vi.fn(),
      dispose: vi.fn(),
    }

    const model = createServerBackedRowModel({
      source: source as ServerRowModel<{ id: number; value: string }>,
    })

    expect(model.getRow(1)).toBeUndefined()
    expect(model.getRow(1)).toBeUndefined()
    expect(getRowAt).toHaveBeenCalledTimes(2)
    model.dispose()
  })

  it("syncs from optional source.subscribe updates", () => {
    const { source } = createSource(12)
    let onUpdate: (() => void) | null = null
    const sourceWithSubscribe = source as ServerRowModel<{ id: number }> & {
      subscribe: (listener: () => void) => () => void
    }
    sourceWithSubscribe.subscribe = (listener: () => void) => {
      onUpdate = listener
      return () => {
        onUpdate = null
      }
    }

    const model = createServerBackedRowModel({
      source: sourceWithSubscribe,
    })

    const before = model.getSnapshot().revision ?? 0
    onUpdate?.()
    const after = model.getSnapshot().revision ?? 0
    expect(after).toBeGreaterThan(before)
    model.dispose()
  })
})
