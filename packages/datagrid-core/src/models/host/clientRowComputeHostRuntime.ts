// Compute host wiring. This runtime owns compute-mode switching and delegates
// projection-triggered recompute into the concrete compute runtime.
import {
  createClientRowComputeRuntime,
  type CreateClientRowComputeRuntimeOptions,
  type DataGridClientComputeDiagnostics,
  type DataGridClientComputeMode,
  type DataGridClientComputeExecutionPlanRequestOptions,
} from "../compute/clientRowComputeRuntime.js"
import type { DataGridClientProjectionRecomputeOptions } from "../projection/clientRowProjectionEngine.js"
import type { DataGridClientProjectionStage } from "../projection/projectionStages.js"
import type { DataGridPatchProjectionExecutionPlan } from "../mutation/rowPatchAnalyzer.js"

export interface CreateClientRowComputeHostRuntimeOptions<T>
  extends CreateClientRowComputeRuntimeOptions<T> {}

export interface ClientRowComputeHostRuntime<T> {
  readonly __genericMarker__?: T | undefined
  recomputeFromStage(
    stage: DataGridClientProjectionStage,
    options?: DataGridClientProjectionRecomputeOptions,
  ): void
  recomputeWithExecutionPlan(
    plan: DataGridPatchProjectionExecutionPlan,
    options?: DataGridClientComputeExecutionPlanRequestOptions,
  ): void
  refresh(): void
  getStaleStages(): readonly DataGridClientProjectionStage[]
  getDiagnostics(): DataGridClientComputeDiagnostics
  getMode(): DataGridClientComputeMode
  switchMode(nextMode: DataGridClientComputeMode): boolean
  dispose(): void
}

export function createClientRowComputeHostRuntime<T>(
  options: CreateClientRowComputeHostRuntimeOptions<T>,
): ClientRowComputeHostRuntime<T> {
  let computeMode: DataGridClientComputeMode = options.mode ?? "sync"
  let computeRuntime = createClientRowComputeRuntime<T>({
    ...options,
    mode: computeMode,
  })

  return {
    recomputeFromStage(stage, requestOptions = {}) {
      computeRuntime.recomputeFromStage(stage, requestOptions)
    },
    recomputeWithExecutionPlan(plan, requestOptions) {
      computeRuntime.recomputeWithExecutionPlan(plan, requestOptions)
    },
    refresh() {
      computeRuntime.refresh()
    },
    getStaleStages() {
      return computeRuntime.getStaleStages()
    },
    getDiagnostics() {
      return computeRuntime.getDiagnostics()
    },
    getMode() {
      return computeMode
    },
    switchMode(nextMode) {
      const normalizedMode: DataGridClientComputeMode = nextMode === "worker" ? "worker" : "sync"
      if (normalizedMode === computeMode) {
        return false
      }
      const previousRuntime = computeRuntime
      computeMode = normalizedMode
      computeRuntime = createClientRowComputeRuntime<T>({
        ...options,
        mode: computeMode,
      })
      previousRuntime.dispose()
      return true
    },
    dispose() {
      computeRuntime.dispose()
    },
  }
}
