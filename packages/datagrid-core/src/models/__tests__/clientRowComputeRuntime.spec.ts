import { describe, expect, it, vi } from "vitest"
import { createClientRowComputeRuntime } from "../clientRowComputeRuntime"
import type { DataGridClientRowProjectionOrchestrator } from "../clientRowProjectionOrchestrator"
import type { DataGridPatchProjectionExecutionPlan } from "../rowPatchAnalyzer"

function createOrchestratorMock(): DataGridClientRowProjectionOrchestrator<unknown> {
  return {
    recomputeFromStage: vi.fn(),
    recomputeWithStagePlan: vi.fn(),
    recomputeWithExecutionPlan: vi.fn(),
    refresh: vi.fn(),
    getStaleStages: vi.fn(() => ["filter"]),
  }
}

describe("createClientRowComputeRuntime", () => {
  it("delegates directly in sync mode", () => {
    const orchestrator = createOrchestratorMock()
    const runtime = createClientRowComputeRuntime({
      mode: "sync",
      orchestrator,
    })

    const executionPlan: DataGridPatchProjectionExecutionPlan = {
      requestedStages: ["filter", "sort"],
      blockedStages: [],
    }

    runtime.recomputeFromStage("filter")
    runtime.recomputeWithExecutionPlan(executionPlan)
    runtime.recomputeWithStagePlan({
      requestedStages: ["sort"],
      blockedStages: ["sort"],
    })
    runtime.refresh()

    expect(orchestrator.recomputeFromStage).toHaveBeenCalledTimes(1)
    expect(orchestrator.recomputeWithStagePlan).toHaveBeenCalledTimes(1)
    expect(orchestrator.recomputeWithExecutionPlan).toHaveBeenCalledTimes(1)
    expect(orchestrator.refresh).toHaveBeenCalledTimes(1)
    expect(runtime.getStaleStages()).toEqual(["filter"])
    expect(runtime.getDiagnostics()).toEqual({
      configuredMode: "sync",
      effectiveMode: "sync",
      transportKind: "none",
      dispatchCount: 0,
      fallbackCount: 0,
    })
  })

  it("uses loopback transport in worker mode when custom transport is missing", () => {
    const orchestrator = createOrchestratorMock()
    const runtime = createClientRowComputeRuntime({
      mode: "worker",
      orchestrator,
    })

    runtime.recomputeFromStage("group")
    runtime.recomputeWithStagePlan({
      requestedStages: ["group"],
      blockedStages: [],
    })
    runtime.refresh()

    expect(orchestrator.recomputeFromStage).toHaveBeenCalledTimes(1)
    expect(orchestrator.recomputeWithStagePlan).toHaveBeenCalledTimes(1)
    expect(orchestrator.refresh).toHaveBeenCalledTimes(1)
    expect(runtime.getDiagnostics()).toEqual({
      configuredMode: "worker",
      effectiveMode: "worker",
      transportKind: "loopback",
      dispatchCount: 3,
      fallbackCount: 0,
    })
  })

  it("falls back to synchronous orchestrator call when custom transport does not handle request", () => {
    const orchestrator = createOrchestratorMock()
    const dispatch = vi.fn(() => ({ handled: false }))
    const runtime = createClientRowComputeRuntime({
      mode: "worker",
      transport: {
        dispatch,
      },
      orchestrator,
    })

    runtime.recomputeFromStage("pivot")
    runtime.recomputeWithStagePlan({
      requestedStages: ["pivot"],
      blockedStages: [],
    })

    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(orchestrator.recomputeFromStage).toHaveBeenCalledTimes(1)
    expect(orchestrator.recomputeWithStagePlan).toHaveBeenCalledTimes(1)
    expect(runtime.getDiagnostics()).toEqual({
      configuredMode: "worker",
      effectiveMode: "worker",
      transportKind: "custom",
      dispatchCount: 2,
      fallbackCount: 2,
    })
  })
})
