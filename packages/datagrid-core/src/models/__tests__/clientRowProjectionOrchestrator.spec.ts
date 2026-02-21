import { describe, expect, it, vi } from "vitest"
import { createClientRowProjectionOrchestrator } from "../clientRowProjectionOrchestrator"
import type {
  DataGridClientProjectionEngine,
  DataGridClientProjectionStageHandlers,
} from "../clientRowProjectionEngine"

describe("clientRowProjectionOrchestrator", () => {
  it("recomputeWithExecutionPlan performs refresh-pass request and blocked recompute", () => {
    const requestRefreshPass = vi.fn()
    const requestStages = vi.fn()
    const recompute = vi.fn()
    const recomputeFromStage = vi.fn()
    const getStaleStages = vi.fn(() => ["sort"] as const)
    const hasDirtyStages = vi.fn(() => true)
    const engine: DataGridClientProjectionEngine<unknown> = {
      requestStages,
      requestRefreshPass,
      hasDirtyStages,
      recompute,
      recomputeFromStage,
      getStaleStages,
    }
    const handlers = {} as DataGridClientProjectionStageHandlers<unknown>
    const orchestrator = createClientRowProjectionOrchestrator(engine, handlers)

    orchestrator.recomputeWithExecutionPlan({
      requestedStages: ["filter", "sort"],
      blockedStages: ["sort", "group", "paginate", "visible"],
    })

    expect(requestRefreshPass).toHaveBeenCalledTimes(1)
    expect(requestStages).toHaveBeenCalledWith(["filter", "sort"])
    expect(recompute).toHaveBeenCalledWith(handlers, {
      blockedStages: ["sort", "group", "paginate", "visible"],
    })
  })

  it("proxies recomputeFromStage, refresh, and stale lookup", () => {
    const requestRefreshPass = vi.fn()
    const requestStages = vi.fn()
    const recompute = vi.fn()
    const recomputeFromStage = vi.fn()
    const getStaleStages = vi.fn(() => ["group"] as const)
    const hasDirtyStages = vi.fn(() => false)
    const engine: DataGridClientProjectionEngine<unknown> = {
      requestStages,
      requestRefreshPass,
      hasDirtyStages,
      recompute,
      recomputeFromStage,
      getStaleStages,
    }
    const handlers = {} as DataGridClientProjectionStageHandlers<unknown>
    const orchestrator = createClientRowProjectionOrchestrator(engine, handlers)

    orchestrator.recomputeFromStage("group")
    expect(recomputeFromStage).toHaveBeenCalledWith("group", handlers, {})

    orchestrator.refresh()
    expect(requestRefreshPass).toHaveBeenCalledTimes(1)
    expect(recompute).toHaveBeenCalledWith(handlers)

    expect(orchestrator.getStaleStages()).toEqual(["group"])
  })
})
