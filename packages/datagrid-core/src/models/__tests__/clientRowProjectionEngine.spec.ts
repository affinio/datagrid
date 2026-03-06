import { describe, expect, it, vi } from "vitest"
import { createClientRowProjectionEngine } from "../clientRowProjectionEngine"
import type { DataGridRowNode } from "../rowModel"

describe("clientRowProjectionEngine aggregate stage graph", () => {
  it("expands compute request to full projection chain", () => {
    const engine = createClientRowProjectionEngine<unknown>()
    engine.requestStages(["compute"])
    expect(engine.getStaleStages()).toEqual([
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

  it("expands group request to pivot->aggregate->paginate->visible chain", () => {
    const engine = createClientRowProjectionEngine<unknown>()
    engine.requestStages(["group"])
    expect(engine.getStaleStages()).toEqual([
      "group",
      "pivot",
      "aggregate",
      "paginate",
      "visible",
    ])
  })

  it("runs aggregate stage with shouldRecompute=false when recompute is blocked", () => {
    const engine = createClientRowProjectionEngine<unknown>()
    const runAggregateStage = vi.fn(() => true)

    engine.recomputeFromStage("group", {
      buildSourceById: () => new Map(),
      getCurrentFilteredRowIds: () => new Set(),
      runComputeStage: () => ({ recomputed: true, refreshSourceById: false }),
      resolveFilterPredicate: () => (() => true),
      runFilterStage: () => ({ filteredRowIds: new Set(), recomputed: true }),
      runSortStage: () => true,
      runGroupStage: () => true,
      runPivotStage: () => true,
      runAggregateStage,
      runPaginateStage: () => true,
      runVisibleStage: () => true,
      finalizeProjectionRecompute: () => {},
    }, {
      blockedStages: ["aggregate"],
    })

    expect(runAggregateStage).toHaveBeenCalledTimes(1)
    expect(runAggregateStage).toHaveBeenCalledWith(
      expect.objectContaining({
        shouldRecompute: false,
      }),
    )
    expect(engine.getStaleStages()).toContain("aggregate")
  })

  it("refreshes sourceById for downstream stages when compute requests it", () => {
    const engine = createClientRowProjectionEngine<unknown>()
    const initialSourceById = new Map([[1, { rowId: 1 }]]) as unknown as ReadonlyMap<number, DataGridRowNode<unknown>>
    const refreshedSourceById = new Map([[1, { rowId: 1, version: 2 }]]) as unknown as ReadonlyMap<number, DataGridRowNode<unknown>>
    const buildSourceById = vi.fn()
      .mockReturnValueOnce(initialSourceById)
      .mockReturnValueOnce(refreshedSourceById)
    const runComputeStage = vi.fn(() => ({
      recomputed: true,
      refreshSourceById: true,
    }))
    const runFilterStage = vi.fn(() => ({
      filteredRowIds: new Set<number>(),
      recomputed: true,
    }))

    engine.recomputeFromStage("compute", {
      buildSourceById,
      getCurrentFilteredRowIds: () => new Set(),
      runComputeStage,
      resolveFilterPredicate: () => (() => true),
      runFilterStage,
      runSortStage: () => true,
      runGroupStage: () => true,
      runPivotStage: () => true,
      runAggregateStage: () => true,
      runPaginateStage: () => true,
      runVisibleStage: () => true,
      finalizeProjectionRecompute: () => {},
    })

    expect(runComputeStage).toHaveBeenCalledWith({
      sourceById: initialSourceById,
      shouldRecompute: true,
    })
    expect(runFilterStage).toHaveBeenCalledWith({
      sourceById: refreshedSourceById,
      filterPredicate: expect.any(Function),
      shouldRecompute: true,
    })
    expect(buildSourceById).toHaveBeenCalledTimes(2)
  })
})
