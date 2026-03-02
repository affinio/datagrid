import type {
  DataGridAggregationModel,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridPivotSpec,
  DataGridRowId,
  DataGridRowNode,
  DataGridSortState,
  DataGridTreeDataResolvedSpec,
} from "./rowModel.js"
import type { DataGridProjectionPolicy } from "./projectionPolicy.js"
import type {
  DataGridClientProjectionStage,
} from "./clientRowProjectionEngine.js"
import type {
  DataGridPatchChangeSet,
  DataGridPatchProjectionExecutionPlan,
} from "./rowPatchAnalyzer.js"
import type { DataGridPivotIncrementalPatchRow } from "./pivotRuntime.js"
import {
  applyClientRowPatchUpdates,
  buildClientRowPatchUpdatesById,
  runClientRowPatchProjection,
  type DataGridClientRowPatchLike,
} from "./clientRowPatchRuntime.js"
import { bumpRowVersions, mergeRowPatch } from "./clientRowRuntimeUtils.js"

export interface DataGridClientRowPatchCoordinatorOptions {
  recomputeSort?: boolean
  recomputeFilter?: boolean
  recomputeGroup?: boolean
  emit?: boolean
}

export interface DataGridClientRowPatchCoordinatorRuntimeContext<T> {
  ensureActive: () => void
  emit: () => void

  setPendingPivotValuePatch: (patch: readonly DataGridPivotIncrementalPatchRow<T>[] | null) => void

  isDataGridRowId: (value: unknown) => value is DataGridRowId
  applyRowDataPatch: (current: T, patch: Partial<T>) => T

  getSourceRows: () => readonly DataGridRowNode<T>[]
  setSourceRows: (rows: readonly DataGridRowNode<T>[]) => void
  getRowVersionById: () => Map<DataGridRowId, number>

  bumpRowRevision: () => void
  getStaleStages: () => readonly DataGridClientProjectionStage[]
  recomputeWithExecutionPlan: (executionPlan: DataGridPatchProjectionExecutionPlan) => void

  getFilterModel: () => DataGridFilterSnapshot | null
  getSortModel: () => readonly DataGridSortState[]
  getTreeData: () => DataGridTreeDataResolvedSpec<T> | null
  getGroupBy: () => DataGridGroupBySpec | null
  getPivotModel: () => DataGridPivotSpec | null
  getAggregationModel: () => DataGridAggregationModel<T> | null
  getProjectionPolicy: () => DataGridProjectionPolicy
  getAllStages: () => readonly DataGridClientProjectionStage[]
  expandStages: (stages: readonly DataGridClientProjectionStage[]) => ReadonlySet<DataGridClientProjectionStage>

  applyIncrementalAggregationPatch: (
    changeSet: DataGridPatchChangeSet,
    previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  ) => boolean
  clearSortValueCache: () => void
  evictSortValueCacheRows: (rowIds: readonly DataGridRowId[]) => void
  invalidateTreeProjectionCaches: () => void
  patchTreeProjectionCacheRowsByIdentity: (changedRowIds: readonly DataGridRowId[]) => void
}

export interface DataGridClientRowPatchCoordinatorRuntime<T> {
  patchRows: (
    updates: readonly DataGridClientRowPatchLike<T>[],
    options?: DataGridClientRowPatchCoordinatorOptions,
  ) => void
}

export function createClientRowPatchCoordinatorRuntime<T>(
  context: DataGridClientRowPatchCoordinatorRuntimeContext<T>,
): DataGridClientRowPatchCoordinatorRuntime<T> {
  return {
    patchRows(
      updates: readonly DataGridClientRowPatchLike<T>[],
      options: DataGridClientRowPatchCoordinatorOptions = {},
    ): void {
      context.ensureActive()
      context.setPendingPivotValuePatch(null)
      if (!Array.isArray(updates) || updates.length === 0) {
        return
      }
      const updatesById = buildClientRowPatchUpdatesById<T>({
        updates,
        isDataGridRowId: context.isDataGridRowId,
        mergeRowPatch,
      })
      if (updatesById.size === 0) {
        return
      }
      const patchResult = applyClientRowPatchUpdates<T>({
        sourceRows: context.getSourceRows(),
        updatesById,
        applyRowDataPatch: context.applyRowDataPatch,
      })
      context.setSourceRows(patchResult.nextSourceRows)
      if (!patchResult.changed || patchResult.changedUpdatesById.size === 0) {
        return
      }
      bumpRowVersions(context.getRowVersionById(), patchResult.changedRowIds)
      context.bumpRowRevision()
      const staleStagesBeforeRequest = new Set<DataGridClientProjectionStage>(context.getStaleStages())
      const patchProjection = runClientRowPatchProjection<T>({
        changedRowIds: patchResult.changedRowIds,
        changedUpdatesById: patchResult.changedUpdatesById,
        previousRowsById: patchResult.previousRowsById,
        nextRowsById: patchResult.nextRowsById,
        filterModel: context.getFilterModel(),
        sortModel: context.getSortModel(),
        treeData: context.getTreeData(),
        groupBy: context.getGroupBy(),
        pivotModel: context.getPivotModel(),
        aggregationModel: context.getAggregationModel(),
        projectionPolicy: context.getProjectionPolicy(),
        recomputePolicy: {
          filter: options.recomputeFilter === true,
          sort: options.recomputeSort === true,
          group: options.recomputeGroup === true,
        },
        staleStagesBeforeRequest,
        allStages: context.getAllStages(),
        expandStages: context.expandStages,
        applyIncrementalAggregationPatch: context.applyIncrementalAggregationPatch,
        clearSortValueCache: context.clearSortValueCache,
        evictSortValueCacheRows: context.evictSortValueCacheRows,
        invalidateTreeProjectionCaches: context.invalidateTreeProjectionCaches,
        patchTreeProjectionCacheRowsByIdentity: context.patchTreeProjectionCacheRowsByIdentity,
        recomputeWithExecutionPlan: context.recomputeWithExecutionPlan,
      })
      context.setPendingPivotValuePatch(patchProjection.pendingPivotValuePatch)
      if (options.emit !== false) {
        context.emit()
      }
    },
  }
}
