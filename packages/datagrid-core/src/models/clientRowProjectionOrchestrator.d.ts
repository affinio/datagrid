import type { DataGridClientProjectionEngine, DataGridClientProjectionRecomputeOptions, DataGridClientProjectionStageHandlers } from "./clientRowProjectionEngine.js";
import type { DataGridClientProjectionStage } from "./projectionStages.js";
import type { DataGridPatchProjectionExecutionPlan } from "./rowPatchAnalyzer.js";
export interface DataGridClientRowProjectionOrchestrator<T> {
    recomputeFromStage: (stage: DataGridClientProjectionStage, options?: DataGridClientProjectionRecomputeOptions) => void;
    recomputeWithExecutionPlan: (plan: DataGridPatchProjectionExecutionPlan) => void;
    refresh: () => void;
    getStaleStages: () => readonly DataGridClientProjectionStage[];
}
export declare function createClientRowProjectionOrchestrator<T>(projectionEngine: DataGridClientProjectionEngine<T>, projectionStageHandlers: DataGridClientProjectionStageHandlers<T>): DataGridClientRowProjectionOrchestrator<T>;
//# sourceMappingURL=clientRowProjectionOrchestrator.d.ts.map