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
import type {
  DataGridClientProjectionStage,
} from "../projection/clientRowProjectionEngine.js"
import type {
  DataGridPatchChangeSet,
  DataGridPatchProjectionExecutionPlan,
} from "../mutation/rowPatchAnalyzer.js"
import type { DataGridClientComputeExecutionPlanRequestOptions } from "../compute/clientRowComputeRuntime.js"
import type { DataGridPivotIncrementalPatchRow } from "../pivot/pivotRuntime.js"
import {
  applyClientRowPatchUpdates,
  buildClientRowPatchUpdatesById,
  runClientRowPatchProjection,
  type ApplyClientRowPatchUpdatesResult,
  type DataGridClientRowPatchLike,
} from "./clientRowPatchRuntime.js"
import { bumpRowVersions, mergeRowPatch } from "../clientRowRuntimeUtils.js"

export interface DataGridClientRowPatchCoordinatorOptions {
  recomputeSort?: boolean
  recomputeFilter?: boolean
  recomputeGroup?: boolean
  emit?: boolean
}

export interface DataGridClientRowPatchCoordinatorRuntimeContext<T> {
  ensureActive: () => void
  emit: () => void
  isMutationBatchActive?: () => boolean
  deferMutationBatchCommit?: (commit: (discard: boolean) => void) => boolean

  setPendingPivotValuePatch: (patch: readonly DataGridPivotIncrementalPatchRow<T>[] | null) => void

  isDataGridRowId: (value: unknown) => value is DataGridRowId
  applyRowDataPatch: (current: T, patch: Partial<T>) => T

  getSourceRows: () => readonly DataGridRowNode<T>[]
  getSourceRowIndexById: () => ReadonlyMap<DataGridRowId, number>
  setSourceRows: (rows: readonly DataGridRowNode<T>[]) => void
  getRowVersionById: () => Map<DataGridRowId, number>
  restoreRowVersionIndex?: (index: Map<DataGridRowId, number>) => void
  refreshProjection?: () => void

  bumpRowRevision: () => void
  setProjectionInvalidation: (reasons: readonly DataGridProjectionInvalidationReason[]) => void
  applyComputedFieldsToPatchResult?: (
    patchResult: ApplyClientRowPatchUpdatesResult<T>,
  ) => ApplyClientRowPatchUpdatesResult<T>
  tryApplyFlatProjectionPatch?: (
    changedRowIds: readonly DataGridRowId[],
    nextRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
    changedUpdatesById: ReadonlyMap<DataGridRowId, Partial<T>>,
    options?: DataGridClientRowPatchCoordinatorOptions,
  ) => boolean
  getStaleStages: () => readonly DataGridClientProjectionStage[]
  recomputeWithExecutionPlan: (
    executionPlan: DataGridPatchProjectionExecutionPlan,
    options?: DataGridClientComputeExecutionPlanRequestOptions,
  ) => void

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
  interface DeferredPatchProjection {
    policyKey: string
    sourceRows: DataGridRowNode<T>[]
    rowBaselineByIndex: Map<number, DataGridRowNode<T>>
    rowVersionBaseline: Map<DataGridRowId, number | undefined>
    changedRowIds: Set<DataGridRowId>
    requestedStages: Set<DataGridClientProjectionStage>
    blockedStages: Set<DataGridClientProjectionStage>
    shouldEmit: boolean
  }

  let deferredPatchProjection: DeferredPatchProjection | null = null

  const flushDeferredPatchProjection = (discard: boolean): void => {
    const pending = deferredPatchProjection
    deferredPatchProjection = null
    if (!pending || discard) return

    if (pending.requestedStages.size > 0 || pending.blockedStages.size > 0) {
      const requested = new Set(pending.requestedStages)
      const blocked = new Set([...pending.blockedStages].filter(stage => !requested.has(stage)))
      const allStages = context.getAllStages()
      try {
        context.recomputeWithExecutionPlan({
          requestedStages: allStages.filter(stage => requested.has(stage)),
          blockedStages: allStages.filter(stage => blocked.has(stage)),
        }, { patchChangedRowCount: pending.changedRowIds.size })
      } catch (error) {
        for (const [index, row] of pending.rowBaselineByIndex) {
          pending.sourceRows[index] = row
        }
        context.setSourceRows(pending.sourceRows)
        const rowVersionIndex = context.getRowVersionById()
        for (const [rowId, version] of pending.rowVersionBaseline) {
          if (version === undefined) rowVersionIndex.delete(rowId)
          else rowVersionIndex.set(rowId, version)
        }
        context.clearSortValueCache()
        context.invalidateTreeProjectionCaches()
        context.setPendingPivotValuePatch(null)
        try {
          context.refreshProjection?.()
        } catch (rollbackError) {
          throw Object.assign(new Error("[DataGridRows] batched patch failed and projection recovery was incomplete."), {
            errors: [error, rollbackError],
          })
        }
        throw error
      }
    }
    if (pending.shouldEmit) context.emit()
  }

  const ensureDeferredPatchProjection = (
    sourceRows: DataGridRowNode<T>[],
    policyKey: string,
  ): DeferredPatchProjection => {
    if (!deferredPatchProjection) {
      deferredPatchProjection = {
        policyKey,
        sourceRows,
        rowBaselineByIndex: new Map(),
        rowVersionBaseline: new Map(),
        changedRowIds: new Set(),
        requestedStages: new Set(),
        blockedStages: new Set(),
        shouldEmit: false,
      }
    }
    return deferredPatchProjection
  }

  const deferPatchProjection = (
    pending: DeferredPatchProjection,
    plan: DataGridPatchProjectionExecutionPlan,
  ): void => {
    for (const stage of plan.requestedStages) pending.requestedStages.add(stage)
    for (const stage of plan.blockedStages) pending.blockedStages.add(stage)
    context.deferMutationBatchCommit?.(flushDeferredPatchProjection)
  }

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
      const isBatchingMutations = context.isMutationBatchActive?.() === true
      const recomputePolicyKey = `${options.recomputeFilter === true}:${options.recomputeSort === true}:${options.recomputeGroup === true}`
      if (isBatchingMutations && deferredPatchProjection
        && deferredPatchProjection.policyKey !== recomputePolicyKey) {
        flushDeferredPatchProjection(false)
      }
      const sourceRowsBefore = context.getSourceRows() as DataGridRowNode<T>[]
      const sourceRowsBeforeByIndex = new Map<number, DataGridRowNode<T>>()
      for (const rowId of updatesById.keys()) {
        const index = context.getSourceRowIndexById().get(rowId)
        const row = typeof index === "number" ? sourceRowsBefore[index] : undefined
        if (typeof index === "number" && row) {
          sourceRowsBeforeByIndex.set(index, row)
        }
      }
      const rowVersionIndex = context.getRowVersionById()
      let rowVersionsBefore: Map<DataGridRowId, number | undefined> | null = null
      let projectionCommitted = false
      try {
      let patchResult = applyClientRowPatchUpdates<T>({
        sourceRows: context.getSourceRows(),
        sourceRowIndexById: context.getSourceRowIndexById(),
        updatesById,
        applyRowDataPatch: context.applyRowDataPatch,
        mutateSourceRowsInPlace: true,
      })
      patchResult = context.applyComputedFieldsToPatchResult
        ? context.applyComputedFieldsToPatchResult(patchResult)
        : patchResult
      context.setSourceRows(patchResult.nextSourceRows)
      if (!patchResult.changed) {
        return
      }
      const invalidationReasons: DataGridProjectionInvalidationReason[] = ["rowsPatched"]
      if (patchResult.computedChanged) {
        invalidationReasons.push("computedChanged")
      }
      if (options.recomputeFilter === true) {
        invalidationReasons.push("filterChanged")
      }
      if (options.recomputeSort === true) {
        invalidationReasons.push("sortChanged")
      }
      if (options.recomputeGroup === true) {
        invalidationReasons.push("groupChanged")
      }
      context.setProjectionInvalidation(invalidationReasons)
      const pendingBatchProjection = isBatchingMutations
        ? ensureDeferredPatchProjection(sourceRowsBefore, recomputePolicyKey)
        : null
      rowVersionsBefore = new Map()
      for (const rowId of patchResult.changedRowIds) {
        const previousVersion = rowVersionIndex.get(rowId)
        rowVersionsBefore.set(rowId, previousVersion)
        if (pendingBatchProjection) {
          const index = context.getSourceRowIndexById().get(rowId)
          if (typeof index === "number") {
            const previousRow = sourceRowsBeforeByIndex.get(index) ?? sourceRowsBefore[index]
            if (previousRow && !pendingBatchProjection.rowBaselineByIndex.has(index)) {
              pendingBatchProjection.rowBaselineByIndex.set(index, previousRow)
            }
          }
          if (!pendingBatchProjection.rowVersionBaseline.has(rowId)) {
            pendingBatchProjection.rowVersionBaseline.set(rowId, previousVersion)
          }
          pendingBatchProjection.changedRowIds.add(rowId)
        }
      }
      bumpRowVersions(context.getRowVersionById(), patchResult.changedRowIds)
      context.bumpRowRevision()
      if (context.tryApplyFlatProjectionPatch?.(
        patchResult.changedRowIds,
        patchResult.nextRowsById,
        patchResult.changedUpdatesById,
        options,
      )) {
        projectionCommitted = true
        if (pendingBatchProjection) {
          pendingBatchProjection.shouldEmit ||= options.emit !== false
          context.deferMutationBatchCommit?.(flushDeferredPatchProjection)
        } else if (options.emit !== false) {
          context.emit()
        }
        return
      }
      const staleStagesBeforeRequest = new Set<DataGridClientProjectionStage>(context.getStaleStages())
      // Never carry a completed pivot delta into a later projection cycle.
      // The invalidated pivot stage rebuilds from the current source rows.
      context.setPendingPivotValuePatch(null)
      runClientRowPatchProjection<T>({
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
        recomputeWithExecutionPlan: (executionPlan, requestOptions) => {
          if (pendingBatchProjection) {
            deferPatchProjection(pendingBatchProjection, executionPlan)
            return
          }
          context.recomputeWithExecutionPlan(executionPlan, requestOptions)
        },
      })
      projectionCommitted = true
      if (pendingBatchProjection) {
        pendingBatchProjection.shouldEmit ||= options.emit !== false
        context.deferMutationBatchCommit?.(flushDeferredPatchProjection)
      } else if (options.emit !== false) {
        context.emit()
      }
      } catch (error) {
        // Recompute callbacks run after base rows and row-version metadata may
        // have been staged. Restore those inputs so a later refresh starts
        // from the last coherent projection; event errors after a successful
        // recompute are intentionally outside this rollback block below.
        if (!projectionCommitted) {
          for (const [index, row] of sourceRowsBeforeByIndex) {
            sourceRowsBefore[index] = row
          }
          context.setSourceRows(sourceRowsBefore)
          if (rowVersionsBefore) {
            for (const [rowId, version] of rowVersionsBefore) {
              if (version === undefined) rowVersionIndex.delete(rowId)
              else rowVersionIndex.set(rowId, version)
            }
          }
          context.clearSortValueCache()
          context.invalidateTreeProjectionCaches()
          context.setPendingPivotValuePatch(null)
          try {
            context.refreshProjection?.()
          } catch (rollbackError) {
            throw Object.assign(new Error("[DataGridRows] patch failed and projection recovery was incomplete."), {
              errors: [error, rollbackError],
            })
          }
        }
        throw error
      }
    },
  }
}
