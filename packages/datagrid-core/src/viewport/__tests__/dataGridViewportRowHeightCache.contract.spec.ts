import { describe, expect, it } from "vitest"
import { createDataGridViewportRowHeightCache } from "../dataGridViewportRowHeightCache"

describe("dataGridViewportRowHeightCache contract", () => {
  it("keeps bounded cache and evicts oldest entries deterministically", () => {
    const cache = createDataGridViewportRowHeightCache({ limit: 3 })
    cache.ingest([
      { index: 0, height: 30 },
      { index: 1, height: 32 },
      { index: 2, height: 34 },
    ])
    expect(cache.getSnapshot().size).toBe(3)
    expect(cache.resolveEstimatedHeight(40)).toBeCloseTo((30 + 32 + 34) / 3, 5)

    cache.ingest([{ index: 3, height: 36 }])
    const snapshot = cache.getSnapshot()
    expect(snapshot.size).toBe(3)
    expect(cache.resolveEstimatedHeight(40)).toBeCloseTo((32 + 34 + 36) / 3, 5)
  })

  it("supports deterministic range invalidation", () => {
    const cache = createDataGridViewportRowHeightCache({ limit: 8 })
    cache.ingest([
      { index: 0, height: 28 },
      { index: 1, height: 30 },
      { index: 2, height: 32 },
      { index: 3, height: 34 },
      { index: 4, height: 36 },
    ])
    cache.deleteRange({ start: 1, end: 3 })
    const snapshot = cache.getSnapshot()
    expect(snapshot.size).toBe(2)
    expect(snapshot.min).toBe(28)
    expect(snapshot.max).toBe(36)
    expect(cache.resolveEstimatedHeight(30)).toBeCloseTo((28 + 36) / 2, 5)
  })

  it("falls back to normalized base height when cache is empty", () => {
    const cache = createDataGridViewportRowHeightCache({ limit: 4 })
    expect(cache.resolveEstimatedHeight(0)).toBe(32)
    expect(cache.resolveEstimatedHeight(22)).toBe(22)
    cache.ingest([{ index: 1, height: 30 }])
    cache.clear()
    expect(cache.resolveEstimatedHeight(26)).toBe(26)
  })
})
