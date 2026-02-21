import type { DataGridAdvancedFilterExpression, DataGridAggregationModel, DataGridFilterSnapshot, DataGridGroupBySpec, DataGridRowId, DataGridSortState, DataGridTreeDataResolvedSpec } from "./rowModel.js";
import type { DataGridDependencyGraph } from "./dependencyGraph.js";
import { type DataGridClientProjectionStage } from "./projectionStages.js";
export declare function resolveAdvancedExpression(filterModel: DataGridFilterSnapshot | null): DataGridAdvancedFilterExpression | null;
export declare function collectFilterModelFields(filterModel: DataGridFilterSnapshot | null): Set<string>;
export declare function collectSortModelFields(sortModel: readonly DataGridSortState[]): Set<string>;
export declare function collectGroupByFields(groupBy: DataGridGroupBySpec | null): Set<string>;
export declare function collectAggregationModelFields<T>(aggregationModel: DataGridAggregationModel<T> | null): Set<string>;
export declare function collectTreeDataDependencyFields<T>(treeData: DataGridTreeDataResolvedSpec<T> | null): Set<string>;
export declare function collectChangedFieldsFromPatches<T>(updatesById: ReadonlyMap<DataGridRowId, Partial<T>>): Set<string>;
export declare function doFieldPathsIntersect(changedFields: ReadonlySet<string>, dependencyFields: ReadonlySet<string>): boolean;
export interface DataGridPatchStageImpact {
    filterActive: boolean;
    sortActive: boolean;
    groupActive: boolean;
    aggregationActive: boolean;
    affectsFilter: boolean;
    affectsSort: boolean;
    affectsGroup: boolean;
    affectsAggregation: boolean;
}
export interface DataGridPatchCacheEvictionPlan {
    clearSortValueCache: boolean;
    evictSortValueRowIds: readonly DataGridRowId[];
    invalidateTreeProjectionCaches: boolean;
    patchTreeProjectionCacheRowsByIdentity: boolean;
}
export interface DataGridPatchChangeSet {
    changedFields: ReadonlySet<string>;
    affectedFields: ReadonlySet<string>;
    changedRowIds: readonly DataGridRowId[];
    stageImpact: DataGridPatchStageImpact;
    cacheEvictionPlan: DataGridPatchCacheEvictionPlan;
}
export interface AnalyzeRowPatchChangeSetInput<T> {
    updatesById: ReadonlyMap<DataGridRowId, Partial<T>>;
    dependencyGraph: Pick<DataGridDependencyGraph, "getAffectedFields" | "affectsAny">;
    filterActive: boolean;
    sortActive: boolean;
    groupActive: boolean;
    aggregationActive: boolean;
    filterFields: ReadonlySet<string>;
    sortFields: ReadonlySet<string>;
    groupFields: ReadonlySet<string>;
    aggregationFields: ReadonlySet<string>;
    treeDataDependencyFields: ReadonlySet<string>;
    hasTreeData: boolean;
}
export declare function analyzeRowPatchChangeSet<T>(input: AnalyzeRowPatchChangeSetInput<T>): DataGridPatchChangeSet;
export interface BuildPatchProjectionExecutionPlanInput {
    changeSet: DataGridPatchChangeSet;
    recomputePolicy: DataGridPatchRecomputePolicy;
    staleStages: ReadonlySet<DataGridClientProjectionStage>;
    allStages: readonly DataGridClientProjectionStage[];
    expandStages: (stages: readonly DataGridClientProjectionStage[]) => ReadonlySet<DataGridClientProjectionStage>;
    stageRules?: readonly DataGridPatchStageRule[];
}
export interface DataGridPatchProjectionExecutionPlan {
    requestedStages: readonly DataGridClientProjectionStage[];
    blockedStages: readonly DataGridClientProjectionStage[];
}
export interface DataGridPatchRecomputePolicy {
    filter: boolean;
    sort: boolean;
    group: boolean;
}
export interface DataGridPatchStageRule {
    id: DataGridClientProjectionStage;
    invalidate: (changeSet: DataGridPatchChangeSet) => boolean;
    allowRecompute: (policy: DataGridPatchRecomputePolicy) => boolean;
}
export declare function createDefaultPatchStageRules(): readonly DataGridPatchStageRule[];
export declare const DATAGRID_DEFAULT_PATCH_STAGE_RULES: readonly DataGridPatchStageRule[];
export declare function buildPatchProjectionExecutionPlan(input: BuildPatchProjectionExecutionPlanInput): DataGridPatchProjectionExecutionPlan;
//# sourceMappingURL=rowPatchAnalyzer.d.ts.map