import { describe, expect, it } from "vitest"
import { mapServerChangeEvent } from "./changeFeedMapping"
import { normalizeDatasourceInvalidation } from "./invalidation"

describe("mapServerChangeEvent", () => {
  it("maps cell and row events with rows to upsert", () => {
    const result = mapServerChangeEvent(
      {
        type: "cell",
        rows: [
          { id: "r1", index: 1, value: 10 },
        ],
      },
      normalizeDatasourceInvalidation,
    )

    expect(result.kind).toBe("upsert")
    expect(result.appliedCount).toBe(1)
    expect(result.rows).toEqual([
      {
        index: 1,
        rowId: "r1",
        row: { id: "r1", index: 1, value: 10 },
      },
    ])
  })

  it("maps range events without rows to invalidate range", () => {
    const result = mapServerChangeEvent(
      {
        type: "range",
        invalidation: {
          kind: "range",
          range: { startRow: 2, endRow: 5 },
        },
      },
      normalizeDatasourceInvalidation,
    )

    expect(result.kind).toBe("invalidate")
    expect(result.appliedCount).toBe(1)
    expect(result.invalidation).toEqual({
      kind: "range",
      range: { start: 2, end: 5 },
    })
  })

  it("maps dataset events to full invalidate", () => {
    const result = mapServerChangeEvent(
      {
        type: "dataset",
        invalidation: {
          kind: "dataset",
        },
      },
      normalizeDatasourceInvalidation,
    )

    expect(result.kind).toBe("invalidate")
    expect(result.appliedCount).toBe(1)
    expect(result.invalidation).toEqual({
      kind: "all",
      reason: undefined,
    })
  })

  it("falls back to dataset invalidation when invalidation is missing", () => {
    const result = mapServerChangeEvent(
      {
        type: "range",
      },
      normalizeDatasourceInvalidation,
    )

    expect(result.kind).toBe("invalidate")
    expect(result.appliedCount).toBe(1)
    expect(result.invalidation).toEqual({
      kind: "all",
      reason: "change-feed",
    })
  })

  it("uses row count for appliedCount on upsert", () => {
    const result = mapServerChangeEvent(
      {
        type: "row",
        rows: [
          { id: "r1", index: 1, value: 10 },
          { id: "r2", index: 2, value: 11 },
        ],
      },
      normalizeDatasourceInvalidation,
    )

    expect(result.kind).toBe("upsert")
    expect(result.appliedCount).toBe(2)
  })
})
