import { describe, expect, it, vi } from "vitest"
import { createClientRowComputeRuntime } from "../compute/clientRowComputeRuntime"
import type { DataGridClientRowProjectionOrchestrator } from "../projection/clientRowProjectionOrchestrator"
import type { DataGridPatchProjectionExecutionPlan } from "../mutation/rowPatchAnalyzer"
import type { DataGridProjectionStage } from "../rowModel"

function createOrchestratorMock(): DataGridClientRowProjectionOrchestrator<unknown> {
  const staleStages: readonly DataGridProjectionStage[] = ["filter"]

  return {
    recomputeFromStage: vi.fn(),
    recomputeWithStagePlan: vi.fn(),
    recomputeWithExecutionPlan: vi.fn(),
    refresh: vi.fn(),
    getStaleStages: vi.fn(() => staleStages),
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

  it("keeps small execution-plan patches local in worker mode", () => {
    const orchestrator = createOrchestratorMock()
    const dispatch = vi.fn(() => ({ handled: true }))
    const runtime = createClientRowComputeRuntime({
      mode: "worker",
      transport: { dispatch },
      orchestrator,
      workerPatchDispatchThreshold: 32,
    })
    const executionPlan: DataGridPatchProjectionExecutionPlan = {
      requestedStages: ["filter"],
      blockedStages: [],
    }

    runtime.recomputeWithExecutionPlan(executionPlan, { patchChangedRowCount: 8 })

    expect(dispatch).not.toHaveBeenCalled()
    expect(orchestrator.recomputeWithExecutionPlan).toHaveBeenCalledTimes(1)
    expect(runtime.getDiagnostics()).toEqual({
      configuredMode: "worker",
      effectiveMode: "worker",
      transportKind: "custom",
      dispatchCount: 0,
      fallbackCount: 0,
    })
  })

  it("dispatches large execution-plan patches to worker transport", () => {
    const orchestrator = createOrchestratorMock()
    const dispatch = vi.fn(() => ({ handled: true }))
    const runtime = createClientRowComputeRuntime({
      mode: "worker",
      transport: { dispatch },
      orchestrator,
      workerPatchDispatchThreshold: 32,
    })
    const executionPlan: DataGridPatchProjectionExecutionPlan = {
      requestedStages: ["group"],
      blockedStages: [],
    }

    runtime.recomputeWithExecutionPlan(executionPlan, { patchChangedRowCount: 256 })

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(orchestrator.recomputeWithExecutionPlan).toHaveBeenCalledTimes(0)
    expect(runtime.getDiagnostics()).toEqual({
      configuredMode: "worker",
      effectiveMode: "worker",
      transportKind: "custom",
      dispatchCount: 1,
      fallbackCount: 0,
    })
  })
})
