// Projection orchestration layer. This file decides which projection stages
// should run and in what order, while stage logic itself lives elsewhere.
import type {
  DataGridClientProjectionEngine,
  DataGridClientProjectionRecomputeOptions,
  DataGridClientProjectionStageHandlers,
} from "./clientRowProjectionEngine.js"
import type { DataGridClientProjectionStage } from "./projectionStages.js"
import type { DataGridPatchProjectionExecutionPlan } from "../mutation/rowPatchAnalyzer.js"

export interface DataGridClientProjectionStagePlan {
  requestedStages: readonly DataGridClientProjectionStage[]
  blockedStages?: readonly DataGridClientProjectionStage[]
}

export interface DataGridClientRowProjectionOrchestrator<T> {
  readonly __genericMarker__?: T | undefined
  recomputeFromStage: (
    stage: DataGridClientProjectionStage,
    options?: DataGridClientProjectionRecomputeOptions,
  ) => void
  recomputeWithStagePlan: (
    plan: DataGridClientProjectionStagePlan,
  ) => void
  recomputeWithExecutionPlan: (
    plan: DataGridPatchProjectionExecutionPlan,
  ) => void
  refresh: () => void
  getStaleStages: () => readonly DataGridClientProjectionStage[]
}

export function createClientRowProjectionOrchestrator<T>(
  projectionEngine: DataGridClientProjectionEngine<T>,
  projectionStageHandlers: DataGridClientProjectionStageHandlers<T>,
): DataGridClientRowProjectionOrchestrator<T> {
  const recomputeWithStagePlan = (plan: DataGridClientProjectionStagePlan): void => {
    projectionEngine.requestRefreshPass()
    projectionEngine.requestStages(plan.requestedStages)
    projectionEngine.recompute(projectionStageHandlers, {
      blockedStages: plan.blockedStages ?? [],
    })
  }

  return {
    recomputeFromStage: (
      stage: DataGridClientProjectionStage,
      options: DataGridClientProjectionRecomputeOptions = {},
    ): void => {
      projectionEngine.recomputeFromStage(stage, projectionStageHandlers, options)
    },
    recomputeWithStagePlan,
    recomputeWithExecutionPlan: (plan: DataGridPatchProjectionExecutionPlan): void => {
      recomputeWithStagePlan(plan)
    },
    refresh: (): void => {
      projectionEngine.requestRefreshPass()
      projectionEngine.recompute(projectionStageHandlers)
    },
    getStaleStages: (): readonly DataGridClientProjectionStage[] => projectionEngine.getStaleStages(),
  }
}
