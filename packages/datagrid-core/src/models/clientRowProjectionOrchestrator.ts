import type {
  DataGridClientProjectionEngine,
  DataGridClientProjectionRecomputeOptions,
  DataGridClientProjectionStageHandlers,
} from "./clientRowProjectionEngine.js"
import type { DataGridClientProjectionStage } from "./projectionStages.js"
import type { DataGridPatchProjectionExecutionPlan } from "./rowPatchAnalyzer.js"

export interface DataGridClientRowProjectionOrchestrator<T> {
  recomputeFromStage: (
    stage: DataGridClientProjectionStage,
    options?: DataGridClientProjectionRecomputeOptions,
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
  return {
    recomputeFromStage: (
      stage: DataGridClientProjectionStage,
      options: DataGridClientProjectionRecomputeOptions = {},
    ): void => {
      projectionEngine.recomputeFromStage(stage, projectionStageHandlers, options)
    },
    recomputeWithExecutionPlan: (plan: DataGridPatchProjectionExecutionPlan): void => {
      projectionEngine.requestRefreshPass()
      projectionEngine.requestStages(plan.requestedStages)
      projectionEngine.recompute(projectionStageHandlers, {
        blockedStages: plan.blockedStages,
      })
    },
    refresh: (): void => {
      projectionEngine.requestRefreshPass()
      projectionEngine.recompute(projectionStageHandlers)
    },
    getStaleStages: (): readonly DataGridClientProjectionStage[] => projectionEngine.getStaleStages(),
  }
}
