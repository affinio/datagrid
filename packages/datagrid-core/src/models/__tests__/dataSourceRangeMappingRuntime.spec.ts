import { describe, expect, it } from "vitest"
import { createDataSourceRangeMappingRuntime } from "../server/dataSourceRangeMappingRuntime"

describe("createDataSourceRangeMappingRuntime", () => {
  it("maps visible ranges and loaded intervals to their source-page offsets", () => {
    const runtime = createDataSourceRangeMappingRuntime({
      getRowCount: () => 55,
      getPaginationInput: () => ({ pageSize: 20, currentPage: 1 }),
      getLoadedIntervals: () => [{ start: 22, end: 25 }],
    })

    expect(runtime.getVisibleRowCount()).toBe(20)
    expect(runtime.toSourceIndex(2)).toBe(22)
    expect(runtime.toSourceRange({ start: 2, end: 8 })).toEqual({ start: 22, end: 28 })
    expect(runtime.toVisibleLoadedIntervals({ start: 2, end: 8 }, { start: 22, end: 28 }))
      .toEqual([{ start: 2, end: 5 }])
  })

  it("keeps unpaginated ranges bounded and reports empty pages", () => {
    const unpaginated = createDataSourceRangeMappingRuntime({
      getRowCount: () => 3,
      getPaginationInput: () => ({ pageSize: 0, currentPage: 0 }),
      getLoadedIntervals: () => [],
    })
    expect(unpaginated.toSourceRange({ start: 0, end: 20 })).toEqual({ start: 0, end: 2 })

    const empty = createDataSourceRangeMappingRuntime({
      getRowCount: () => 0,
      getPaginationInput: () => ({ pageSize: 10, currentPage: 0 }),
      getLoadedIntervals: () => [],
    })
    expect(empty.getVisibleRowCount()).toBe(0)
    expect(empty.toSourceRange({ start: 5, end: 8 })).toEqual({ start: 0, end: 0 })
  })
})
