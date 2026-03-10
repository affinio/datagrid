import { describe, expect, it } from "vitest"
import { createClientRowRuntimeStateStore } from "../clientRowRuntimeStateStore"

describe("clientRowRuntimeStateStore", () => {
  it("tracks revision counters and projection cycle commits", () => {
    const store = createClientRowRuntimeStateStore<{ id: number }>()

    expect(store.state.revision).toBe(0)
    expect(store.state.rows).toEqual([])
    expect(store.state.filteredRowsProjection).toEqual([])
    expect(store.state.sortedRowsProjection).toEqual([])
    expect(store.state.groupedRowsProjection).toEqual([])
    expect(store.state.pivotedRowsProjection).toEqual([])
    expect(store.state.aggregatedRowsProjection).toEqual([])
    expect(store.state.paginatedRowsProjection).toEqual([])
    expect(store.state.rowRevision).toBe(0)
    expect(store.state.sortRevision).toBe(0)
    expect(store.state.filterRevision).toBe(0)
    expect(store.state.groupRevision).toBe(0)

    store.bumpRowRevision()
    store.bumpSortRevision()
    store.bumpFilterRevision()
    store.bumpGroupRevision()
    store.commitProjectionCycle(true)

    expect(store.state.revision).toBe(1)
    expect(store.state.rowRevision).toBe(1)
    expect(store.state.sortRevision).toBe(1)
    expect(store.state.filterRevision).toBe(1)
    expect(store.state.groupRevision).toBe(1)
    expect(store.state.projectionCycleVersion).toBe(1)
    expect(store.state.projectionRecomputeVersion).toBe(1)
    expect(store.state.lastRecomputeHadActual).toBe(true)
    expect(store.state.lastRecomputedStages).toEqual([])
    expect(store.state.lastBlockedStages).toEqual([])
  })

  it("builds projection diagnostics from stale-stage resolver", () => {
    const store = createClientRowRuntimeStateStore<{ id: number }>()
    store.setProjectionInvalidation(["sortChanged"])
    store.commitProjectionCycle(false)

    const diagnostics = store.getProjectionDiagnostics(() => ["sort"], 0, 0, 0)
    expect(diagnostics.version).toBe(1)
    expect(diagnostics.cycleVersion).toBe(1)
    expect(diagnostics.recomputeVersion).toBe(0)
    expect(diagnostics.staleStages).toEqual(["sort"])
    expect(diagnostics.lastInvalidationReasons).toEqual(["sortChanged"])
    expect(diagnostics.lastInvalidatedStages).toEqual(["sort", "group", "pivot", "aggregate", "paginate", "visible"])
    expect(diagnostics.lastRecomputeHadActual).toBe(false)
    expect(diagnostics.lastRecomputedStages).toEqual([])
    expect(diagnostics.lastBlockedStages).toEqual([])
    expect(diagnostics.pipeline?.rowCounts).toEqual({
      source: 0,
      afterCompute: 0,
      afterFilter: 0,
      afterSort: 0,
      afterGroup: 0,
      afterPivot: 0,
      afterAggregate: 0,
      afterPaginate: 0,
      visible: 0,
    })
    expect(diagnostics.memory).toEqual({
      rowIndexBytes: 0,
      sortBufferBytes: 0,
      groupBuckets: 0,
      pivotCells: 0,
    })
  })

  it("captures recompute tracing details in diagnostics", () => {
    const store = createClientRowRuntimeStateStore<{ id: number }>()
    store.setProjectionInvalidation(["filterChanged"])
    store.commitProjectionCycle({
      hadActualRecompute: true,
      recomputedStages: ["filter", "sort"],
      blockedStages: ["group", "pivot"],
      stageTimes: {
        filter: 0.3,
        sort: 1.8,
      },
    })
    store.state.filteredRowsProjection = [{ id: 1 } as never, { id: 2 } as never]
    store.state.sortedRowsProjection = [{ id: 1 } as never, { id: 2 } as never]
    store.state.groupedRowsProjection = [{ id: 1 } as never]
    store.state.pivotedRowsProjection = [{ id: 1 } as never]
    store.state.aggregatedRowsProjection = [{ id: 1 } as never]
    store.state.paginatedRowsProjection = [{ id: 1 } as never]
    store.state.rows = [{ id: 1 } as never]

    const diagnostics = store.getProjectionDiagnostics(() => [], 2, 2, 3)
    expect(diagnostics.lastRecomputeHadActual).toBe(true)
    expect(diagnostics.lastRecomputedStages).toEqual(["filter", "sort"])
    expect(diagnostics.lastBlockedStages).toEqual(["group", "pivot"])
    expect(diagnostics.performance?.stageTimes).toEqual({
      filter: 0.3,
      sort: 1.8,
    })
    expect(diagnostics.performance?.totalTime).toBe(2.1)
    expect(diagnostics.pipeline?.rowCounts).toEqual({
      source: 2,
      afterCompute: 2,
      afterFilter: 2,
      afterSort: 2,
      afterGroup: 1,
      afterPivot: 1,
      afterAggregate: 1,
      afterPaginate: 1,
      visible: 1,
    })
    expect(diagnostics.memory).toEqual({
      rowIndexBytes: 64,
      sortBufferBytes: 64,
      groupBuckets: 0,
      pivotCells: 3,
    })
  })

  it("maps rowsChanged invalidation to compute-first projection chain", () => {
    const store = createClientRowRuntimeStateStore<{ id: number }>()
    store.setProjectionInvalidation(["rowsChanged"])
    store.commitProjectionCycle(false)

    const diagnostics = store.getProjectionDiagnostics(() => ["compute"], 0, 0, 0)
    expect(diagnostics.lastInvalidationReasons).toEqual(["rowsChanged"])
    expect(diagnostics.lastInvalidatedStages).toEqual([
      "compute",
      "filter",
      "sort",
      "group",
      "pivot",
      "aggregate",
      "paginate",
      "visible",
    ])
  })

  it("maps computedChanged invalidation to compute-first projection chain", () => {
    const store = createClientRowRuntimeStateStore<{ id: number }>()
    store.setProjectionInvalidation(["computedChanged"])
    store.commitProjectionCycle(false)

    const diagnostics = store.getProjectionDiagnostics(() => ["compute"], 0, 0, 0)
    expect(diagnostics.lastInvalidationReasons).toEqual(["computedChanged"])
    expect(diagnostics.lastInvalidatedStages).toEqual([
      "compute",
      "filter",
      "sort",
      "group",
      "pivot",
      "aggregate",
      "paginate",
      "visible",
    ])
  })

  it("maps manualRefresh invalidation to compute-first projection chain", () => {
    const store = createClientRowRuntimeStateStore<{ id: number }>()
    store.setProjectionInvalidation(["manualRefresh"])
    store.commitProjectionCycle(false)

    const diagnostics = store.getProjectionDiagnostics(() => ["compute"], 0, 0, 0)
    expect(diagnostics.lastInvalidationReasons).toEqual(["manualRefresh"])
    expect(diagnostics.lastInvalidatedStages).toEqual([
      "compute",
      "filter",
      "sort",
      "group",
      "pivot",
      "aggregate",
      "paginate",
      "visible",
    ])
  })

  it("includes projection formula diagnostics when provided", () => {
    const store = createClientRowRuntimeStateStore<{ id: number }>()
    store.setProjectionFormulaDiagnostics({
      recomputedFields: ["total"],
      runtimeErrorCount: 2,
      runtimeErrors: [
        {
          code: "DIV_ZERO",
          message: "Division by zero.",
          formulaName: "ratio",
          rowId: "r1",
          sourceIndex: 0,
        },
      ],
      compileCache: {
        hits: 3,
        misses: 2,
        size: 2,
      },
    })

    const diagnostics = store.getProjectionDiagnostics(() => [], 0, 0, 0)
    expect(diagnostics.formula).toEqual({
      recomputedFields: ["total"],
      runtimeErrorCount: 2,
      runtimeErrors: [
        {
          code: "DIV_ZERO",
          message: "Division by zero.",
          formulaName: "ratio",
          rowId: "r1",
          sourceIndex: 0,
        },
      ],
      compileCache: {
        hits: 3,
        misses: 2,
        size: 2,
      },
    })
  })

  it("counts grouped buckets in projection memory diagnostics", () => {
    const store = createClientRowRuntimeStateStore<{ id: number }>()
    store.state.groupedRowsProjection = [
      { kind: "group" } as never,
      { kind: "leaf" } as never,
      { kind: "group" } as never,
    ]

    const diagnostics = store.getProjectionDiagnostics(() => [], 3, 3, 0)
    expect(diagnostics.memory?.groupBuckets).toBe(2)
  })
})
