import { describe, expect, it } from "vitest"
import { createDataGridRangeCache } from "../server/rangeCache"

describe("createDataGridRangeCache", () => {
  it("marks all chunks covered by a load token as loading", () => {
    const cache = createDataGridRangeCache<string>({
      chunkSize: 5,
      maxChunks: 4,
    })

    const token = cache.beginLoad({ start: 3, end: 8 })

    expect(token.chunkIndexes).toEqual([0, 1])
    expect(cache.readIndex(3).state).toBe("loading")
    expect(cache.readIndex(8).state).toBe("loading")
    expect(cache.getDiagnostics()).toMatchObject({
      chunks: 2,
      loadingChunks: 2,
    })
  })

  it("ignores stale completions after a generation reset", () => {
    const cache = createDataGridRangeCache<string>({
      chunkSize: 4,
      maxChunks: 4,
    })

    const token = cache.beginLoad({ start: 0, end: 3 })
    cache.reset()

    expect(cache.completeLoad(token, [{ index: 1, row: "stale" }])).toBe(false)
    expect(cache.readIndex(1)).toEqual({ index: 1, state: "missing" })
  })

  it("returns loaded rows and placeholder metadata for partial ranges", () => {
    const cache = createDataGridRangeCache<string>({
      chunkSize: 4,
      maxChunks: 4,
    })

    const token = cache.beginLoad({ start: 0, end: 3 })
    expect(cache.completeLoad(token, [{ index: 2, row: "row-2" }])).toBe(true)

    expect(cache.readRange({ start: 1, end: 3 })).toEqual([
      { index: 1, state: "missing" },
      { index: 2, state: "loaded", row: "row-2" },
      { index: 3, state: "missing" },
    ])
  })

  it("returns loaded intervals from sparse cached rows without walking missing indexes", () => {
    const cache = createDataGridRangeCache<string>({
      chunkSize: 4,
      maxChunks: 4,
    })

    cache.setRow(1, "row-1")
    cache.setRow(2, "row-2")
    cache.setRow(5, "row-5")
    cache.setRow(8, "row-8")
    cache.setRow(9, "row-9")

    expect(cache.getLoadedIntervals({ start: 0, end: 9 })).toEqual([
      { start: 1, end: 2 },
      { start: 5, end: 5 },
      { start: 8, end: 9 },
    ])
    expect(cache.getLoadedIntervals({ start: 2, end: 8 })).toEqual([
      { start: 2, end: 2 },
      { start: 5, end: 5 },
      { start: 8, end: 8 },
    ])
  })

  it("keeps error state local to failed chunks", () => {
    const cache = createDataGridRangeCache<string>({
      chunkSize: 4,
      maxChunks: 4,
    })
    const failure = new Error("load failed")

    const token = cache.beginLoad({ start: 4, end: 7 })
    expect(cache.failLoad(token, failure)).toBe(true)

    expect(cache.readIndex(5)).toEqual({ index: 5, state: "error", error: failure })
    expect(cache.readIndex(1)).toEqual({ index: 1, state: "missing" })
  })

  it("ignores stale failures after a generation reset", () => {
    const cache = createDataGridRangeCache<string>({
      chunkSize: 4,
      maxChunks: 4,
    })

    const stale = cache.beginLoad({ start: 0, end: 3 })
    cache.reset()
    const current = cache.beginLoad({ start: 0, end: 3 })

    expect(cache.failLoad(stale, new Error("stale failed"))).toBe(false)
    expect(cache.readIndex(1).state).toBe("loading")
    expect(cache.completeLoad(current, [{ index: 1, row: "row-1" }])).toBe(true)
    expect(cache.readIndex(1)).toEqual({ index: 1, state: "loaded", row: "row-1" })
  })

  it("retries error chunks through loading into loaded state", () => {
    const cache = createDataGridRangeCache<string>({
      chunkSize: 4,
      maxChunks: 4,
    })

    const failed = cache.beginLoad({ start: 0, end: 3 })
    expect(cache.failLoad(failed, new Error("load failed"))).toBe(true)
    expect(cache.readIndex(1).state).toBe("error")

    const retry = cache.beginLoad({ start: 0, end: 3 })
    expect(cache.readIndex(1).state).toBe("loading")
    expect(cache.completeLoad(retry, [{ index: 1, row: "row-1" }])).toBe(true)
    expect(cache.readIndex(1)).toEqual({ index: 1, state: "loaded", row: "row-1" })
  })

  it("evicts least recently used non-loading chunks", () => {
    const cache = createDataGridRangeCache<string>({
      chunkSize: 2,
      maxChunks: 2,
    })

    cache.setRow(0, "row-0")
    cache.setRow(2, "row-2")
    expect(cache.getRow(0)).toBe("row-0")
    cache.setRow(4, "row-4")

    expect(cache.getRow(0)).toBe("row-0")
    expect(cache.getRow(2)).toBeUndefined()
    expect(cache.getRow(4)).toBe("row-4")
    expect(cache.getDiagnostics().chunks).toBe(2)
  })
})
