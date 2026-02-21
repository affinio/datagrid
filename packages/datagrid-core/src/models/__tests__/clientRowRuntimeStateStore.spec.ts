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
  })

  it("builds projection diagnostics from stale-stage resolver", () => {
    const store = createClientRowRuntimeStateStore<{ id: number }>()
    store.commitProjectionCycle(false)

    const diagnostics = store.getProjectionDiagnostics(() => ["sort"])
    expect(diagnostics.version).toBe(1)
    expect(diagnostics.cycleVersion).toBe(1)
    expect(diagnostics.recomputeVersion).toBe(0)
    expect(diagnostics.staleStages).toEqual(["sort"])
  })
})
