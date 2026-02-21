import { type ProjectionRecomputeMeta, type ProjectionRecomputeOptions, type ProjectionRequestOptions } from "@affino/projection-engine";
import type { DataGridRowId, DataGridRowNode } from "./rowModel.js";
import { type DataGridClientProjectionStage } from "./projectionStages.js";
export type { DataGridClientProjectionStage } from "./projectionStages.js";
export interface DataGridClientProjectionFilterStageResult {
    filteredRowIds: Set<DataGridRowId>;
    recomputed: boolean;
}
export interface DataGridClientProjectionStageContext<T> {
    sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>;
    shouldRecompute: boolean;
}
export interface DataGridClientProjectionFilterStageContext<T> extends DataGridClientProjectionStageContext<T> {
    filterPredicate?: (rowNode: DataGridRowNode<T>) => boolean;
}
export interface DataGridClientProjectionGroupStageContext<T> extends DataGridClientProjectionStageContext<T> {
    rowMatchesFilter: (row: DataGridRowNode<T>) => boolean;
}
export interface DataGridClientProjectionStageHandlers<T> {
    buildSourceById: () => ReadonlyMap<DataGridRowId, DataGridRowNode<T>>;
    getCurrentFilteredRowIds: () => ReadonlySet<DataGridRowId>;
    resolveFilterPredicate: () => (rowNode: DataGridRowNode<T>) => boolean;
    runFilterStage: (context: DataGridClientProjectionFilterStageContext<T>) => DataGridClientProjectionFilterStageResult;
    runSortStage: (context: DataGridClientProjectionStageContext<T>) => boolean;
    runGroupStage: (context: DataGridClientProjectionGroupStageContext<T>) => boolean;
    runAggregateStage: (context: DataGridClientProjectionStageContext<T>) => boolean;
    runPaginateStage: (context: DataGridClientProjectionStageContext<T>) => boolean;
    runVisibleStage: (context: DataGridClientProjectionStageContext<T>) => boolean;
    finalizeProjectionRecompute: (meta: DataGridClientProjectionFinalizeMeta) => void;
}
export type DataGridClientProjectionRecomputeOptions = ProjectionRecomputeOptions<DataGridClientProjectionStage>;
export type DataGridClientProjectionFinalizeMeta = ProjectionRecomputeMeta<DataGridClientProjectionStage>;
export type DataGridClientProjectionRequestOptions = ProjectionRequestOptions;
export interface DataGridClientProjectionEngine<T> {
    requestStages: (stages: readonly DataGridClientProjectionStage[], options?: DataGridClientProjectionRequestOptions) => void;
    requestRefreshPass: () => void;
    hasDirtyStages: () => boolean;
    recompute: (handlers: DataGridClientProjectionStageHandlers<T>, options?: DataGridClientProjectionRecomputeOptions) => void;
    recomputeFromStage: (stage: DataGridClientProjectionStage, handlers: DataGridClientProjectionStageHandlers<T>, options?: DataGridClientProjectionRecomputeOptions) => void;
    getStaleStages: () => readonly DataGridClientProjectionStage[];
}
export declare function createClientRowProjectionEngine<T>(): DataGridClientProjectionEngine<T>;
export declare function expandClientProjectionStages(stages: readonly DataGridClientProjectionStage[]): ReadonlySet<DataGridClientProjectionStage>;
//# sourceMappingURL=clientRowProjectionEngine.d.ts.map