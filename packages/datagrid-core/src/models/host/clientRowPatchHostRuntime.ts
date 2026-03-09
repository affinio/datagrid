import { hasActiveFilterModel } from "../projection/clientRowProjectionPrimitives.js"
import type {
  DataGridAggregationModel,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridProjectionInvalidationReason,
  DataGridPivotSpec,
  DataGridRowId,
  DataGridRowNode,
  DataGridSortState,
  DataGridTreeDataResolvedSpec,
} from "../rowModel.js"
import type { DataGridProjectionPolicy } from "../projection/projectionPolicy.js"
import type { DataGridClientProjectionStage } from "../projection/clientRowProjectionEngine.js"
import type { DataGridPivotIncrementalPatchRow } from "../pivot/pivotRuntime.js"
import type { DataGridClientComputeExecutionPlanRequestOptions } from "../compute/clientRowComputeRuntime.js"
import type {
  DataGridPatchChangeSet,
  DataGridPatchProjectionExecutionPlan,
} from "../mutation/rowPatchAnalyzer.js"
import type {
  DataGridClientRowPatchCoordinatorOptions,
  DataGridClientRowPatchCoordinatorRuntime,
} from "../mutation/clientRowPatchCoordinatorRuntime.js"
import { createClientRowPatchCoordinatorRuntime } from "../mutation/clientRowPatchCoordinatorRuntime.js"
import type { ClientRowPatchComputedMergeRuntimeContext } from "../mutation/clientRowPatchComputedMergeRuntime.js"
import { createClientRowPatchComputedMergeRuntime } from "../mutation/clientRowPatchComputedMergeRuntime.js"
import type { DataGridClientRowPatchLike } from "../mutation/clientRowPatchRuntime.js"

export interface CreateClientRowPatchHostRuntimeOptions<T>
  extends ClientRowPatchComputedMergeRuntimeContext<T> {
  ensureActive: () => void
  emit: () => void
  setPendingPivotValuePatch: (patch: readonly DataGridPivotIncrementalPatchRow<T>[] | null) => void
  isDataGridRowId: (value: unknown) => value is DataGridRowId
  applyRowDataPatch: (current: T, patch: Partial<T>) => T
  getSourceRows: () => readonly DataGridRowNode<T>[]
  setSourceRows: (rows: readonly DataGridRowNode<T>[]) => void
  getRowVersionById: () => Map<DataGridRowId, number>
  bumpRowRevision: () => void
  setProjectionInvalidation: (reasons: readonly DataGridProjectionInvalidationReason[]) => void
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
  recomputeWithExecutionPlan: (
    executionPlan: DataGridPatchProjectionExecutionPlan,
    requestOptions?: DataGridClientComputeExecutionPlanRequestOptions,
  ) => void
  getStaleStages: () => readonly DataGridClientProjectionStage[]
  getRuntimeState: () => {
    rows: DataGridRowNode<T>[]
    filteredRowsProjection: DataGridRowNode<T>[]
    sortedRowsProjection: DataGridRowNode<T>[]
    groupedRowsProjection: DataGridRowNode<T>[]
    pivotedRowsProjection: DataGridRowNode<T>[]
    aggregatedRowsProjection: DataGridRowNode<T>[]
    paginatedRowsProjection: DataGridRowNode<T>[]
    rowRevision: number
    sortRevision: number
    filterRevision: number
    groupRevision: number
  }
  getPagination: () => { enabled: boolean }
  commitProjectionCycle: (hadActualRecompute: boolean) => void
  updateDerivedCacheRevisions: (revisions: {
    row: number
    sort: number
    filter: number
    group: number
  }) => void
  hasComputedFields: () => boolean
}

export interface ClientRowPatchHostRuntime<T> {
  patchRows(
    updates: readonly DataGridClientRowPatchLike<T>[],
    options?: DataGridClientRowPatchCoordinatorOptions,
  ): void
}

export function createClientRowPatchHostRuntime<T>(
  options: CreateClientRowPatchHostRuntimeOptions<T>,
): ClientRowPatchHostRuntime<T> {
  const patchComputedMergeRuntime = createClientRowPatchComputedMergeRuntime<T>(options)

  const tryApplyFlatProjectionPatch = (
    changedRowIds: readonly DataGridRowId[],
    nextRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  ): boolean => {
    if (
      hasActiveFilterModel(options.getFilterModel())
      || options.getSortModel().length > 0
      || options.getTreeData() !== null
      || options.getGroupBy() !== null
      || options.getPivotModel() !== null
      || Boolean(options.getAggregationModel() && options.getAggregationModel()!.columns.length > 0)
      || options.getPagination().enabled
      || options.getStaleStages().length > 0
    ) {
      return false
    }

    const runtimeState = options.getRuntimeState()
    const sourceCount = options.getSourceRows().length
    if (
      runtimeState.filteredRowsProjection.length !== sourceCount
      || runtimeState.sortedRowsProjection.length !== sourceCount
      || runtimeState.groupedRowsProjection.length !== sourceCount
      || runtimeState.pivotedRowsProjection.length !== sourceCount
      || runtimeState.aggregatedRowsProjection.length !== sourceCount
      || runtimeState.paginatedRowsProjection.length !== sourceCount
      || runtimeState.rows.length !== sourceCount
    ) {
      return false
    }

    if (options.hasComputedFields()) {
      const nextFlatRows = options.getBaseSourceRows() as DataGridRowNode<T>[]
      runtimeState.filteredRowsProjection = nextFlatRows
      runtimeState.sortedRowsProjection = nextFlatRows
      runtimeState.groupedRowsProjection = nextFlatRows
      runtimeState.pivotedRowsProjection = nextFlatRows
      runtimeState.aggregatedRowsProjection = nextFlatRows
      runtimeState.paginatedRowsProjection = nextFlatRows
      runtimeState.rows = nextFlatRows
    } else {
      const projectionRowsToPatch: DataGridRowNode<T>[][] = []
      const registerProjectionRows = (rows: readonly DataGridRowNode<T>[]) => {
        const mutableRows = rows as DataGridRowNode<T>[]
        if (!projectionRowsToPatch.includes(mutableRows)) {
          projectionRowsToPatch.push(mutableRows)
        }
      }
      registerProjectionRows(runtimeState.filteredRowsProjection)
      registerProjectionRows(runtimeState.sortedRowsProjection)
      registerProjectionRows(runtimeState.groupedRowsProjection)
      registerProjectionRows(runtimeState.pivotedRowsProjection)
      registerProjectionRows(runtimeState.aggregatedRowsProjection)
      registerProjectionRows(runtimeState.paginatedRowsProjection)
      registerProjectionRows(runtimeState.rows)

      for (const rowId of changedRowIds) {
        const position = options.getSourceRowIndexById().get(rowId) ?? -1
        if (position < 0 || position >= sourceCount) {
          continue
        }
        const nextRow = nextRowsById.get(rowId)
        if (!nextRow) {
          continue
        }
        for (const projectionRows of projectionRowsToPatch) {
          const currentRow = projectionRows[position]
          if (!currentRow || (currentRow.data === nextRow.data && currentRow.row === nextRow.row)) {
            continue
          }
          projectionRows[position] = {
            ...currentRow,
            data: nextRow.data,
            row: nextRow.row,
          }
        }
      }
    }

    options.updateDerivedCacheRevisions({
      row: runtimeState.rowRevision,
      sort: runtimeState.sortRevision,
      filter: runtimeState.filterRevision,
      group: runtimeState.groupRevision,
    })
    options.commitProjectionCycle(false)
    return true
  }

  const patchCoordinatorRuntime: DataGridClientRowPatchCoordinatorRuntime<T> =
    createClientRowPatchCoordinatorRuntime<T>({
      ensureActive: options.ensureActive,
      emit: options.emit,
      setPendingPivotValuePatch: options.setPendingPivotValuePatch,
      isDataGridRowId: options.isDataGridRowId,
      applyRowDataPatch: options.applyRowDataPatch,
      getSourceRows: options.getBaseSourceRows,
      getSourceRowIndexById: options.getSourceRowIndexById,
      setSourceRows: options.setSourceRows,
      getRowVersionById: options.getRowVersionById,
      bumpRowRevision: options.bumpRowRevision,
      setProjectionInvalidation: options.setProjectionInvalidation,
      applyComputedFieldsToPatchResult: patchComputedMergeRuntime.applyComputedFieldsToPatchResult,
      tryApplyFlatProjectionPatch,
      getStaleStages: options.getStaleStages,
      recomputeWithExecutionPlan: options.recomputeWithExecutionPlan,
      getFilterModel: options.getFilterModel,
      getSortModel: options.getSortModel,
      getTreeData: options.getTreeData,
      getGroupBy: options.getGroupBy,
      getPivotModel: options.getPivotModel,
      getAggregationModel: options.getAggregationModel,
      getProjectionPolicy: options.getProjectionPolicy,
      getAllStages: options.getAllStages,
      expandStages: options.expandStages,
      applyIncrementalAggregationPatch: options.applyIncrementalAggregationPatch,
      clearSortValueCache: options.clearSortValueCache,
      evictSortValueCacheRows: options.evictSortValueCacheRows,
      invalidateTreeProjectionCaches: options.invalidateTreeProjectionCaches,
      patchTreeProjectionCacheRowsByIdentity: options.patchTreeProjectionCacheRowsByIdentity,
    })

  return {
    patchRows(updates, runtimeOptions) {
      patchCoordinatorRuntime.patchRows(updates, runtimeOptions)
    },
  }
}
