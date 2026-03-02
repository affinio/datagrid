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
import type { DataGridClientProjectionStage } from "./clientRowProjectionEngine.js"
import type { DataGridPivotIncrementalPatchRow } from "./pivotRuntime.js"
import {
  analyzeRowPatchChangeSet,
  buildPatchProjectionExecutionPlan,
  collectAggregationModelFields,
  collectFilterModelFields,
  collectGroupByFields,
  collectPivotAxisFields,
  collectPivotModelFields,
  collectPivotValueFields,
  collectSortModelFields,
  collectTreeDataDependencyFields,
  type DataGridPatchChangeSet,
  type DataGridPatchProjectionExecutionPlan,
} from "./rowPatchAnalyzer.js"
import { hasActiveFilterModel } from "./clientRowProjectionPrimitives.js"

export interface DataGridClientRowPatchLike<T = unknown> {
  rowId: DataGridRowId
  data: Partial<T>
}

export interface DataGridClientRowPatchRecomputePolicy {
  filter: boolean
  sort: boolean
  group: boolean
}

export interface BuildClientRowPatchUpdatesByIdInput<T> {
  updates: readonly DataGridClientRowPatchLike<T>[]
  isDataGridRowId: (value: unknown) => value is DataGridRowId
  mergeRowPatch: (existing: Partial<T>, nextPatch: Partial<T>) => Partial<T>
}

export function buildClientRowPatchUpdatesById<T>(
  input: BuildClientRowPatchUpdatesByIdInput<T>,
): Map<DataGridRowId, Partial<T>> {
  const updatesById = new Map<DataGridRowId, Partial<T>>()
  for (const update of input.updates) {
    if (!update || !input.isDataGridRowId(update.rowId) || typeof update.data === "undefined" || update.data === null) {
      continue
    }
    const existing = updatesById.get(update.rowId)
    if (existing) {
      updatesById.set(update.rowId, input.mergeRowPatch(existing, update.data))
      continue
    }
    updatesById.set(update.rowId, update.data)
  }
  return updatesById
}

export interface ApplyClientRowPatchUpdatesInput<T> {
  sourceRows: readonly DataGridRowNode<T>[]
  updatesById: ReadonlyMap<DataGridRowId, Partial<T>>
  applyRowDataPatch: (current: T, patch: Partial<T>) => T
}

export interface ApplyClientRowPatchUpdatesResult<T> {
  nextSourceRows: readonly DataGridRowNode<T>[]
  changed: boolean
  changedRowIds: readonly DataGridRowId[]
  changedUpdatesById: ReadonlyMap<DataGridRowId, Partial<T>>
  previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  nextRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
}

export function applyClientRowPatchUpdates<T>(
  input: ApplyClientRowPatchUpdatesInput<T>,
): ApplyClientRowPatchUpdatesResult<T> {
  let changed = false
  const changedRowIds: DataGridRowId[] = []
  const changedUpdatesById = new Map<DataGridRowId, Partial<T>>()
  const previousRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()
  const nextRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()

  const nextSourceRows = input.sourceRows.map((row) => {
    const patch = input.updatesById.get(row.rowId)
    if (!patch) {
      return row
    }
    const nextData = input.applyRowDataPatch(row.data, patch)
    if (nextData === row.data) {
      return row
    }
    changed = true
    changedRowIds.push(row.rowId)
    changedUpdatesById.set(row.rowId, patch)
    previousRowsById.set(row.rowId, row)
    const nextRow = {
      ...row,
      data: nextData,
      row: nextData,
    }
    nextRowsById.set(row.rowId, nextRow)
    return nextRow
  })

  return {
    nextSourceRows,
    changed,
    changedRowIds,
    changedUpdatesById,
    previousRowsById,
    nextRowsById,
  }
}

export interface RunClientRowPatchProjectionInput<T> {
  changedRowIds: readonly DataGridRowId[]
  changedUpdatesById: ReadonlyMap<DataGridRowId, Partial<T>>
  previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  nextRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  filterModel: DataGridFilterSnapshot | null
  sortModel: readonly DataGridSortState[]
  treeData: DataGridTreeDataResolvedSpec<T> | null
  groupBy: DataGridGroupBySpec | null
  pivotModel: DataGridPivotSpec | null
  aggregationModel: DataGridAggregationModel<T> | null
  projectionPolicy: DataGridProjectionPolicy
  recomputePolicy: DataGridClientRowPatchRecomputePolicy
  staleStagesBeforeRequest: ReadonlySet<DataGridClientProjectionStage>
  allStages: readonly DataGridClientProjectionStage[]
  expandStages: (stages: readonly DataGridClientProjectionStage[]) => ReadonlySet<DataGridClientProjectionStage>
  applyIncrementalAggregationPatch: (
    changeSet: DataGridPatchChangeSet,
    previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  ) => boolean
  clearSortValueCache: () => void
  evictSortValueCacheRows: (rowIds: readonly DataGridRowId[]) => void
  invalidateTreeProjectionCaches: () => void
  patchTreeProjectionCacheRowsByIdentity: (changedRowIds: readonly DataGridRowId[]) => void
  recomputeWithExecutionPlan: (plan: DataGridPatchProjectionExecutionPlan) => void
}

export interface RunClientRowPatchProjectionResult<T> {
  pendingPivotValuePatch: readonly DataGridPivotIncrementalPatchRow<T>[] | null
}

export function runClientRowPatchProjection<T>(
  input: RunClientRowPatchProjectionInput<T>,
): RunClientRowPatchProjectionResult<T> {
  const filterActive = hasActiveFilterModel(input.filterModel)
  const sortActive = input.sortModel.length > 0
  const groupActive = Boolean(input.treeData) || Boolean(input.groupBy) || Boolean(input.pivotModel)
  const aggregationActive = Boolean(input.aggregationModel && input.aggregationModel.columns.length > 0)

  const filterFields = filterActive ? collectFilterModelFields(input.filterModel) : new Set<string>()
  const sortFields = sortActive ? collectSortModelFields(input.sortModel) : new Set<string>()
  const groupFields = groupActive && !input.treeData
    ? (input.pivotModel ? collectPivotModelFields(input.pivotModel) : collectGroupByFields(input.groupBy))
    : new Set<string>()
  const aggregationFields = aggregationActive ? collectAggregationModelFields(input.aggregationModel) : new Set<string>()
  const treeDataDependencyFields = input.treeData ? collectTreeDataDependencyFields(input.treeData) : new Set<string>()

  const changeSet = analyzeRowPatchChangeSet({
    updatesById: input.changedUpdatesById,
    dependencyGraph: input.projectionPolicy.dependencyGraph,
    filterActive,
    sortActive,
    groupActive,
    aggregationActive,
    filterFields,
    sortFields,
    groupFields,
    aggregationFields,
    treeDataDependencyFields,
    hasTreeData: Boolean(input.treeData),
  })

  if (changeSet.cacheEvictionPlan.clearSortValueCache) {
    input.clearSortValueCache()
  } else if (changeSet.cacheEvictionPlan.evictSortValueRowIds.length > 0) {
    input.evictSortValueCacheRows(changeSet.cacheEvictionPlan.evictSortValueRowIds)
  }

  if (changeSet.cacheEvictionPlan.invalidateTreeProjectionCaches) {
    input.invalidateTreeProjectionCaches()
  } else if (changeSet.cacheEvictionPlan.patchTreeProjectionCacheRowsByIdentity) {
    input.patchTreeProjectionCacheRowsByIdentity(input.changedRowIds)
  }

  const appliedIncrementalAggregation = !input.recomputePolicy.group
    && input.applyIncrementalAggregationPatch(changeSet, input.previousRowsById)
  const effectiveChangeSet = appliedIncrementalAggregation
    ? {
        ...changeSet,
        stageImpact: {
          ...changeSet.stageImpact,
          affectsAggregation: false,
        },
      }
    : changeSet

  let pendingPivotValuePatch: readonly DataGridPivotIncrementalPatchRow<T>[] | null = null
  if (input.pivotModel && input.recomputePolicy.group) {
    const pivotAxisFields = collectPivotAxisFields(input.pivotModel)
    const pivotValueFields = collectPivotValueFields(input.pivotModel)
    const affectsPivotAxis = pivotAxisFields.size > 0
      && input.projectionPolicy.dependencyGraph.affectsAny(effectiveChangeSet.affectedFields, pivotAxisFields)
    const affectsPivotValues = pivotValueFields.size === 0
      ? false
      : input.projectionPolicy.dependencyGraph.affectsAny(effectiveChangeSet.affectedFields, pivotValueFields)
    const canApplyPivotValuePatch =
      affectsPivotValues &&
      !affectsPivotAxis &&
      !effectiveChangeSet.stageImpact.affectsFilter &&
      !effectiveChangeSet.stageImpact.affectsSort &&
      !input.staleStagesBeforeRequest.has("group") &&
      !input.staleStagesBeforeRequest.has("pivot")
    if (canApplyPivotValuePatch) {
      const changedRows: DataGridPivotIncrementalPatchRow<T>[] = []
      for (const changedRowId of input.changedRowIds) {
        const previousRow = input.previousRowsById.get(changedRowId)
        const nextRow = input.nextRowsById.get(changedRowId)
        if (!previousRow || !nextRow || previousRow.kind !== "leaf" || nextRow.kind !== "leaf") {
          continue
        }
        changedRows.push({
          previousRow,
          nextRow,
        })
      }
      if (changedRows.length > 0) {
        pendingPivotValuePatch = changedRows
      }
    }
  }

  const projectionExecutionPlan = buildPatchProjectionExecutionPlan({
    changeSet: effectiveChangeSet,
    recomputePolicy: input.recomputePolicy,
    staleStages: input.staleStagesBeforeRequest,
    allStages: input.allStages,
    expandStages: input.expandStages,
  })
  input.recomputeWithExecutionPlan(projectionExecutionPlan)

  return {
    pendingPivotValuePatch,
  }
}
