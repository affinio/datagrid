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

    const diagnostics = store.getProjectionDiagnostics(() => ["sort"])
    expect(diagnostics.version).toBe(1)
    expect(diagnostics.cycleVersion).toBe(1)
    expect(diagnostics.recomputeVersion).toBe(0)
    expect(diagnostics.staleStages).toEqual(["sort"])
    expect(diagnostics.lastInvalidationReasons).toEqual(["sortChanged"])
    expect(diagnostics.lastInvalidatedStages).toEqual(["sort", "group", "pivot", "aggregate", "paginate", "visible"])
    expect(diagnostics.lastRecomputeHadActual).toBe(false)
    expect(diagnostics.lastRecomputedStages).toEqual([])
    expect(diagnostics.lastBlockedStages).toEqual([])
  })

  it("captures recompute tracing details in diagnostics", () => {
    const store = createClientRowRuntimeStateStore<{ id: number }>()
    store.setProjectionInvalidation(["filterChanged"])
    store.commitProjectionCycle({
      hadActualRecompute: true,
      recomputedStages: ["filter", "sort"],
      blockedStages: ["group", "pivot"],
    })

    const diagnostics = store.getProjectionDiagnostics(() => [])
    expect(diagnostics.lastRecomputeHadActual).toBe(true)
    expect(diagnostics.lastRecomputedStages).toEqual(["filter", "sort"])
    expect(diagnostics.lastBlockedStages).toEqual(["group", "pivot"])
  })

  it("maps rowsChanged invalidation to compute-first projection chain", () => {
    const store = createClientRowRuntimeStateStore<{ id: number }>()
    store.setProjectionInvalidation(["rowsChanged"])
    store.commitProjectionCycle(false)

    const diagnostics = store.getProjectionDiagnostics(() => ["compute"])
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

    const diagnostics = store.getProjectionDiagnostics(() => ["compute"])
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

    const diagnostics = store.getProjectionDiagnostics(() => ["compute"])
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

    const diagnostics = store.getProjectionDiagnostics(() => [])
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
})
