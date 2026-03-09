import { patchGroupRowsAggregatesByGroupKey } from "../clientRowModelHelpers.js"
import { applyIncrementalAggregationPatch as applyIncrementalAggregationPatchRuntime } from "../aggregation/incrementalAggregationRuntime.js"
import type { DataGridPatchChangeSet } from "../mutation/rowPatchAnalyzer.js"
import type { DataGridAggregationEngine } from "../aggregation/aggregationEngine.js"
import type {
  DataGridGroupBySpec,
  DataGridPivotSpec,
  DataGridRowId,
  DataGridRowNode,
  DataGridTreeDataResolvedSpec,
} from "../rowModel.js"
import type { ClientRowProjectionTransientStateRuntime } from "../state/clientRowProjectionTransientStateRuntime.js"
import type { DataGridClientRowTreePivotIntegrationRuntime } from "../projection/clientRowTreePivotIntegrationRuntime.js"

export interface CreateClientRowProjectionIntegrationHostRuntimeOptions<T> {
  runtimeState: {
    groupedRowsProjection: DataGridRowNode<T>[]
    aggregatedRowsProjection: DataGridRowNode<T>[]
    paginatedRowsProjection: DataGridRowNode<T>[]
    rows: DataGridRowNode<T>[]
  }
  treeData: DataGridTreeDataResolvedSpec<T> | null
  getBaseSourceRows(): readonly DataGridRowNode<T>[]
  getSourceRowIndexById(): ReadonlyMap<DataGridRowId, number>
  getGroupBy(): DataGridGroupBySpec | null
  getPivotModel(): DataGridPivotSpec | null
  getAggregationModel(): ReturnType<DataGridAggregationEngine<T>["getModel"]>
  aggregationEngine: DataGridAggregationEngine<T>
  projectionTransientStateRuntime: ClientRowProjectionTransientStateRuntime
  treePivotIntegrationRuntime: DataGridClientRowTreePivotIntegrationRuntime<T>
}

export interface DataGridClientRowProjectionIntegrationHostRuntime<T> {
  resetGroupByIncrementalAggregationState(): void
  invalidateTreeProjectionCaches(): void
  patchTreeProjectionCacheRowsByIdentity(changedRowIds?: readonly DataGridRowId[]): void
  applyIncrementalAggregationPatch(
    changeSet: DataGridPatchChangeSet,
    previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  ): boolean
}

export function createClientRowProjectionIntegrationHostRuntime<T>(
  options: CreateClientRowProjectionIntegrationHostRuntimeOptions<T>,
): DataGridClientRowProjectionIntegrationHostRuntime<T> {
  const patchRuntimeGroupAggregates = (
    resolveAggregates: (groupKey: string) => Record<string, unknown> | undefined,
  ): void => {
    options.runtimeState.groupedRowsProjection = patchGroupRowsAggregatesByGroupKey(
      options.runtimeState.groupedRowsProjection,
      resolveAggregates,
    )
    options.runtimeState.aggregatedRowsProjection = patchGroupRowsAggregatesByGroupKey(
      options.runtimeState.aggregatedRowsProjection,
      resolveAggregates,
    )
    options.runtimeState.paginatedRowsProjection = patchGroupRowsAggregatesByGroupKey(
      options.runtimeState.paginatedRowsProjection,
      resolveAggregates,
    )
    options.runtimeState.rows = patchGroupRowsAggregatesByGroupKey(
      options.runtimeState.rows,
      resolveAggregates,
    )
  }

  const applyIncrementalAggregationPatch = (
    changeSet: DataGridPatchChangeSet,
    previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  ): boolean => {
    options.aggregationEngine.setModel(options.getAggregationModel())
    return applyIncrementalAggregationPatchRuntime({
      changedRowIds: changeSet.changedRowIds,
      previousRowsById,
      resolveNextRowById: (rowId) => {
        const rowIndex = options.getSourceRowIndexById().get(rowId)
        if (
          typeof rowIndex !== "number"
          || rowIndex < 0
          || rowIndex >= options.getBaseSourceRows().length
        ) {
          return undefined
        }
        return options.getBaseSourceRows()[rowIndex]
      },
      stageImpact: {
        affectsAggregation: changeSet.stageImpact.affectsAggregation,
        affectsFilter: changeSet.stageImpact.affectsFilter,
        affectsSort: changeSet.stageImpact.affectsSort,
        affectsGroup: changeSet.stageImpact.affectsGroup,
      },
      hasPivotModel: Boolean(options.getPivotModel()),
      hasAggregationModel: Boolean(
        options.getAggregationModel()
        && options.getAggregationModel()!.columns.length > 0,
      ),
      hasTreeData: Boolean(options.treeData),
      hasGroupBy: Boolean(options.getGroupBy()),
      groupByState: options.projectionTransientStateRuntime.getGroupByIncrementalAggregationState(),
      treePathCacheState: options.treePivotIntegrationRuntime.getTreePathProjectionCacheState(),
      treeParentCacheState: options.treePivotIntegrationRuntime.getTreeParentProjectionCacheState(),
      isIncrementalAggregationSupported: () => options.aggregationEngine.isIncrementalAggregationSupported(),
      createLeafContribution: row => options.aggregationEngine.createLeafContribution(row),
      applyContributionDelta: (groupState, previous, next) => {
        options.aggregationEngine.applyContributionDelta(groupState, previous, next)
      },
      finalizeGroupState: groupState => options.aggregationEngine.finalizeGroupState(groupState),
      patchRuntimeGroupAggregates,
    })
  }

  return {
    resetGroupByIncrementalAggregationState: () => {
      options.projectionTransientStateRuntime.resetGroupByIncrementalAggregationState()
    },
    invalidateTreeProjectionCaches: () => {
      options.treePivotIntegrationRuntime.invalidateTreeProjectionCaches()
    },
    patchTreeProjectionCacheRowsByIdentity: (changedRowIds: readonly DataGridRowId[] = []) => {
      options.treePivotIntegrationRuntime.patchTreeProjectionCacheRowsByIdentity(changedRowIds)
    },
    applyIncrementalAggregationPatch,
  }
}
