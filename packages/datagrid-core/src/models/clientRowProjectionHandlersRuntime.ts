import type {
  DataGridAggregationModel,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridPaginationSnapshot,
  DataGridPivotColumn,
  DataGridPivotSpec,
  DataGridRowId,
  DataGridRowNode,
  DataGridSortState,
  DataGridTreeDataDiagnostics,
  DataGridTreeDataResolvedSpec,
  DataGridViewportRange,
} from "./rowModel.js"
import type {
  DataGridClientProjectionFinalizeMeta,
  DataGridClientProjectionStageHandlers,
} from "./clientRowProjectionEngine.js"
import type { DataGridProjectionPolicy } from "./projectionPolicy.js"
import type { DataGridClientRowRuntimeState } from "./clientRowRuntimeStateStore.js"
import type { GroupByIncrementalAggregationState } from "./incrementalAggregationRuntime.js"
import type {
  TreeParentProjectionCacheState,
  TreePathProjectionCacheState,
} from "./treeProjectionRuntime.js"
import type { DataGridPivotIncrementalPatchRow, DataGridPivotRuntime } from "./pivotRuntime.js"
import {
  runFilterProjectionStage,
  runPaginateProjectionStage,
  runSortProjectionStage,
  runVisibleProjectionStage,
  type SortValueCacheEntry,
} from "./clientRowProjectionBasicStages.js"
import { runGroupProjectionStage } from "./clientRowProjectionGroupStage.js"
import { runPivotProjectionStage } from "./clientRowProjectionPivotStage.js"
import { runAggregateProjectionStage } from "./clientRowProjectionAggregateStage.js"

export interface ClientRowProjectionHandlersDiagnosticsState {
  revisions: {
    row: number
    sort: number
    filter: number
    group: number
  }
  sortValueHits: number
  sortValueMisses: number
  groupValueHits: number
  groupValueMisses: number
}

export interface ClientRowProjectionHandlersRuntimeContext<T> {
  runtimeState: DataGridClientRowRuntimeState<T>
  commitProjectionCycle: (hadActualRecompute: boolean) => void

  getSourceRows: () => readonly DataGridRowNode<T>[]
  buildSourceById: () => ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  readRowField: (row: DataGridRowNode<T>, key: string, field?: string) => unknown
  normalizeText: (value: unknown) => string

  resolveFilterPredicate: (
    options?: { ignoreColumnFilterKey?: string },
  ) => (rowNode: DataGridRowNode<T>) => boolean

  getTreeData: () => DataGridTreeDataResolvedSpec<T> | null
  getFilterModel: () => DataGridFilterSnapshot | null
  getSortModel: () => readonly DataGridSortState[]
  getGroupBy: () => DataGridGroupBySpec | null
  getPivotModel: () => DataGridPivotSpec | null
  getAggregationModel: () => DataGridAggregationModel<T> | null

  getProjectionPolicy: () => DataGridProjectionPolicy
  getRowVersionById: () => ReadonlyMap<DataGridRowId, number>
  getTreeCacheRevision: () => number

  getPaginationInput: () => DataGridPaginationInput
  setPaginationInput: (paginationInput: DataGridPaginationInput) => void
  getPagination: () => DataGridPaginationSnapshot
  setPagination: (pagination: DataGridPaginationSnapshot) => void

  getViewportRange: () => DataGridViewportRange
  setViewportRange: (range: DataGridViewportRange) => void
  normalizeViewportRange: (range: DataGridViewportRange, rowCount: number) => DataGridViewportRange

  getSortValueCacheKey: () => string
  setSortValueCacheKey: (key: string) => void
  sortValueCache: Map<DataGridRowId, SortValueCacheEntry>

  getGroupValueCacheKey: () => string
  setGroupValueCacheKey: (key: string) => void
  groupValueCache: Map<string, string>

  getGroupedProjectionGroupIndexByRowId: () => ReadonlyMap<DataGridRowId, number>
  setGroupedProjectionGroupIndexByRowId: (index: Map<DataGridRowId, number>) => void

  getTreePathProjectionCacheState: () => TreePathProjectionCacheState<T> | null
  setTreePathProjectionCacheState: (state: TreePathProjectionCacheState<T> | null) => void
  getTreeParentProjectionCacheState: () => TreeParentProjectionCacheState<T> | null
  setTreeParentProjectionCacheState: (state: TreeParentProjectionCacheState<T> | null) => void
  getLastTreeProjectionCacheKey: () => string | null
  setLastTreeProjectionCacheKey: (key: string | null) => void
  getLastTreeExpansionSnapshot: () => DataGridGroupExpansionSnapshot | null
  setLastTreeExpansionSnapshot: (snapshot: DataGridGroupExpansionSnapshot | null) => void
  getTreeDataDiagnostics: () => DataGridTreeDataDiagnostics | null
  setTreeDataDiagnostics: (diagnostics: DataGridTreeDataDiagnostics | null) => void

  getPivotColumns: () => readonly DataGridPivotColumn[]
  setPivotColumns: (columns: DataGridPivotColumn[]) => void
  getPendingPivotValuePatch: () => readonly DataGridPivotIncrementalPatchRow<T>[] | null
  setPendingPivotValuePatch: (rows: readonly DataGridPivotIncrementalPatchRow<T>[] | null) => void

  getCurrentExpansionSnapshot: () => DataGridGroupExpansionSnapshot
  getExpansionToggledKeys: () => ReadonlySet<string>

  derivedCacheDiagnostics: ClientRowProjectionHandlersDiagnosticsState
  treeProjectionRuntime: ReturnType<typeof import("./treeProjectionRuntime.js").createTreeProjectionRuntime<T>>
  pivotRuntime: DataGridPivotRuntime<T>
  aggregationEngine: ReturnType<typeof import("./aggregationEngine.js").createDataGridAggregationEngine<T>>
  groupByIncrementalAggregationState: GroupByIncrementalAggregationState
  resetGroupByIncrementalAggregationState: () => void
}

export interface ClientRowProjectionHandlersRuntime<T> {
  projectionStageHandlers: DataGridClientProjectionStageHandlers<T>
}

export function createClientRowProjectionHandlersRuntime<T>(
  context: ClientRowProjectionHandlersRuntimeContext<T>,
): ClientRowProjectionHandlersRuntime<T> {
  const runFilterStage: DataGridClientProjectionStageHandlers<T>["runFilterStage"] = stageContext => {
    const result = runFilterProjectionStage({
      sourceRows: context.getSourceRows(),
      previousFilteredRowsProjection: context.runtimeState.filteredRowsProjection,
      sourceById: stageContext.sourceById,
      shouldRecompute: stageContext.shouldRecompute,
      filterPredicate: stageContext.filterPredicate,
      resolveFilterPredicate: () => context.resolveFilterPredicate(),
    })
    context.runtimeState.filteredRowsProjection = result.filteredRowsProjection
    return {
      filteredRowIds: result.filteredRowIds,
      recomputed: result.recomputed,
    }
  }

  const runSortStage: DataGridClientProjectionStageHandlers<T>["runSortStage"] = stageContext => {
    const counters = {
      hits: context.derivedCacheDiagnostics.sortValueHits,
      misses: context.derivedCacheDiagnostics.sortValueMisses,
    }
    const result = runSortProjectionStage({
      treeData: context.getTreeData(),
      filterModel: context.getFilterModel(),
      sourceRows: context.getSourceRows(),
      filteredRowsProjection: context.runtimeState.filteredRowsProjection,
      previousSortedRowsProjection: context.runtimeState.sortedRowsProjection,
      shouldRecompute: stageContext.shouldRecompute,
      sortModel: context.getSortModel(),
      projectionPolicy: context.getProjectionPolicy(),
      sortValueCache: context.sortValueCache,
      sortValueCacheKey: context.getSortValueCacheKey(),
      rowVersionById: context.getRowVersionById(),
      counters,
      readRowField: context.readRowField,
    })
    context.runtimeState.sortedRowsProjection = result.sortedRowsProjection
    context.setSortValueCacheKey(result.sortValueCacheKey)
    context.derivedCacheDiagnostics.sortValueHits = counters.hits
    context.derivedCacheDiagnostics.sortValueMisses = counters.misses
    return result.recomputed
  }

  const runGroupStage: DataGridClientProjectionStageHandlers<T>["runGroupStage"] = stageContext => {
    const result = runGroupProjectionStage({
      shouldRecompute: stageContext.shouldRecompute,
      sourceById: stageContext.sourceById,
      rowMatchesFilter: stageContext.rowMatchesFilter,
      treeData: context.getTreeData(),
      pivotModelEnabled: Boolean(context.getPivotModel()),
      groupBy: context.getGroupBy(),
      filterModel: context.getFilterModel(),
      sourceRows: context.getSourceRows(),
      sortedRowsProjection: context.runtimeState.sortedRowsProjection,
      filteredRowsProjection: context.runtimeState.filteredRowsProjection,
      previousGroupedRowsProjection: context.runtimeState.groupedRowsProjection,
      expansionSnapshot: context.getCurrentExpansionSnapshot(),
      expansionToggledKeys: context.getExpansionToggledKeys(),
      treeCacheRevision: context.getTreeCacheRevision(),
      rowRevision: context.runtimeState.rowRevision,
      groupRevision: context.runtimeState.groupRevision,
      filterRevision: context.runtimeState.filterRevision,
      sortRevision: context.runtimeState.sortRevision,
      projectionPolicy: context.getProjectionPolicy(),
      groupValueCache: context.groupValueCache,
      groupValueCacheKey: context.getGroupValueCacheKey(),
      groupValueCounters: {
        hits: context.derivedCacheDiagnostics.groupValueHits,
        misses: context.derivedCacheDiagnostics.groupValueMisses,
      },
      treeProjectionRuntime: context.treeProjectionRuntime,
      treePathProjectionCacheState: context.getTreePathProjectionCacheState(),
      treeParentProjectionCacheState: context.getTreeParentProjectionCacheState(),
      lastTreeProjectionCacheKey: context.getLastTreeProjectionCacheKey(),
      lastTreeExpansionSnapshot: context.getLastTreeExpansionSnapshot(),
      groupedProjectionGroupIndexByRowId: context.getGroupedProjectionGroupIndexByRowId(),
      aggregationModel: context.getAggregationModel(),
      aggregationEngine: context.aggregationEngine,
      treeDataDiagnostics: context.getTreeDataDiagnostics(),
    })
    context.runtimeState.groupedRowsProjection = result.groupedRowsProjection
    context.setGroupValueCacheKey(result.groupValueCacheKey)
    context.derivedCacheDiagnostics.groupValueHits = result.groupValueCounters.hits
    context.derivedCacheDiagnostics.groupValueMisses = result.groupValueCounters.misses
    context.setGroupedProjectionGroupIndexByRowId(result.groupedProjectionGroupIndexByRowId)
    context.setTreePathProjectionCacheState(result.treePathProjectionCacheState)
    context.setTreeParentProjectionCacheState(result.treeParentProjectionCacheState)
    context.setLastTreeProjectionCacheKey(result.lastTreeProjectionCacheKey)
    context.setLastTreeExpansionSnapshot(result.lastTreeExpansionSnapshot)
    context.setTreeDataDiagnostics(result.treeDataDiagnostics)
    return result.recomputed
  }

  const runPivotStage: DataGridClientProjectionStageHandlers<T>["runPivotStage"] = stageContext => {
    const result = runPivotProjectionStage({
      pivotModel: context.getPivotModel(),
      shouldRecompute: stageContext.shouldRecompute,
      previousPivotedRowsProjection: context.runtimeState.pivotedRowsProjection,
      previousPivotColumns: context.getPivotColumns(),
      groupedRowsProjection: context.runtimeState.groupedRowsProjection,
      pendingValuePatchRows: context.getPendingPivotValuePatch(),
      pivotRuntime: context.pivotRuntime,
      normalizeFieldValue: context.normalizeText,
      expansionSnapshot: context.getCurrentExpansionSnapshot(),
    })
    context.runtimeState.pivotedRowsProjection = result.pivotedRowsProjection
    context.setPivotColumns(result.pivotColumns)
    return result.recomputed
  }

  const runAggregateStage: DataGridClientProjectionStageHandlers<T>["runAggregateStage"] = stageContext => {
    const result = runAggregateProjectionStage({
      shouldRecompute: stageContext.shouldRecompute,
      sourceById: stageContext.sourceById,
      previousAggregatedRowsProjection: context.runtimeState.aggregatedRowsProjection,
      groupedRowsProjection: context.runtimeState.groupedRowsProjection,
      pivotedRowsProjection: context.runtimeState.pivotedRowsProjection,
      sortedRowsProjection: context.runtimeState.sortedRowsProjection,
      sourceRows: context.getSourceRows(),
      sortModel: context.getSortModel(),
      groupBy: context.getGroupBy(),
      pivotModelEnabled: Boolean(context.getPivotModel()),
      treeData: context.getTreeData(),
      aggregationModel: context.getAggregationModel(),
      aggregationEngine: context.aggregationEngine,
      groupByIncrementalAggregationState: context.groupByIncrementalAggregationState,
      resetGroupByIncrementalAggregationState: context.resetGroupByIncrementalAggregationState,
      readRowField: context.readRowField,
      normalizeText: context.normalizeText,
    })
    context.runtimeState.aggregatedRowsProjection = result.aggregatedRowsProjection
    return result.recomputed
  }

  const runPaginateStage: DataGridClientProjectionStageHandlers<T>["runPaginateStage"] = stageContext => {
    const result = runPaginateProjectionStage({
      aggregatedRowsProjection: context.runtimeState.aggregatedRowsProjection,
      previousPaginatedRowsProjection: context.runtimeState.paginatedRowsProjection,
      sourceById: stageContext.sourceById,
      shouldRecompute: stageContext.shouldRecompute,
      paginationInput: context.getPaginationInput(),
      currentPagination: context.getPagination(),
    })
    context.runtimeState.paginatedRowsProjection = result.paginatedRowsProjection
    context.setPagination(result.pagination)
    return result.recomputed
  }

  const runVisibleStage: DataGridClientProjectionStageHandlers<T>["runVisibleStage"] = stageContext => {
    const result = runVisibleProjectionStage({
      paginatedRowsProjection: context.runtimeState.paginatedRowsProjection,
      previousRows: context.runtimeState.rows,
      sourceById: stageContext.sourceById,
      shouldRecompute: stageContext.shouldRecompute,
      pivotEnabled: Boolean(context.getPivotModel()),
    })
    context.runtimeState.rows = result.rows
    return result.recomputed
  }

  const finalizeProjectionRecompute = (meta: DataGridClientProjectionFinalizeMeta): void => {
    const pagination = context.getPagination()
    context.setPaginationInput({
      pageSize: pagination.pageSize,
      currentPage: pagination.currentPage,
    })
    context.setViewportRange(
      context.normalizeViewportRange(context.getViewportRange(), context.runtimeState.rows.length),
    )
    context.derivedCacheDiagnostics.revisions = {
      row: context.runtimeState.rowRevision,
      sort: context.runtimeState.sortRevision,
      filter: context.runtimeState.filterRevision,
      group: context.runtimeState.groupRevision,
    }
    context.setPendingPivotValuePatch(null)
    context.commitProjectionCycle(meta.hadActualRecompute)
  }

  return {
    projectionStageHandlers: {
      buildSourceById: context.buildSourceById,
      getCurrentFilteredRowIds: () => {
        const rowIds = new Set<DataGridRowId>()
        for (const row of context.runtimeState.filteredRowsProjection) {
          rowIds.add(row.rowId)
        }
        return rowIds
      },
      resolveFilterPredicate: () => context.resolveFilterPredicate(),
      runFilterStage,
      runSortStage,
      runGroupStage,
      runPivotStage,
      runAggregateStage,
      runPaginateStage,
      runVisibleStage,
      finalizeProjectionRecompute,
    },
  }
}
