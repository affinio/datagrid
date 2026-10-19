import { describe, expect, it } from "vitest"
import { measureDataSourceViewportLoading } from "../server/dataSourceCoveragePolicy"

describe("measureDataSourceViewportLoading", () => {
  it("measures visible cache coverage after source index mapping", () => {
    const cachedIndexes = new Set([101, 103])
    expect(measureDataSourceViewportLoading(
      { start: 0, end: 3 },
      10,
      index => index + 100,
      index => cachedIndexes.has(index),
    )).toEqual({
      viewportRowCount: 4,
      viewportLoadedRowCount: 2,
      viewportLoadingRowCount: 2,
      viewportLoadingRowRatio: 0.5,
    })
  })

  it("returns empty diagnostics for an empty visible model", () => {
    expect(measureDataSourceViewportLoading(
      { start: 0, end: 0 },
      0,
      index => index,
      () => false,
    )).toEqual({
      viewportRowCount: 0,
      viewportLoadedRowCount: 0,
      viewportLoadingRowCount: 0,
      viewportLoadingRowRatio: 0,
    })
  })
})
