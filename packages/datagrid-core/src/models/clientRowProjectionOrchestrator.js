export function createClientRowProjectionOrchestrator(projectionEngine, projectionStageHandlers) {
    return {
        recomputeFromStage: (stage, options = {}) => {
            projectionEngine.recomputeFromStage(stage, projectionStageHandlers, options);
        },
        recomputeWithExecutionPlan: (plan) => {
            projectionEngine.requestRefreshPass();
            projectionEngine.requestStages(plan.requestedStages);
            projectionEngine.recompute(projectionStageHandlers, {
                blockedStages: plan.blockedStages,
            });
        },
        refresh: () => {
            projectionEngine.requestRefreshPass();
            projectionEngine.recompute(projectionStageHandlers);
        },
        getStaleStages: () => projectionEngine.getStaleStages(),
    };
}
