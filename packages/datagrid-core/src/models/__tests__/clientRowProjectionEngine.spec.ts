import { describe, expect, it, vi } from "vitest"
import { createClientRowProjectionEngine } from "../clientRowProjectionEngine"

describe("clientRowProjectionEngine aggregate stage graph", () => {
  it("expands group request to aggregate->paginate->visible chain", () => {
    const engine = createClientRowProjectionEngine<unknown>()
    engine.requestStages(["group"])
    expect(engine.getStaleStages()).toEqual([
      "group",
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
      resolveFilterPredicate: () => (() => true),
      runFilterStage: () => ({ filteredRowIds: new Set(), recomputed: true }),
      runSortStage: () => true,
      runGroupStage: () => true,
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
})
