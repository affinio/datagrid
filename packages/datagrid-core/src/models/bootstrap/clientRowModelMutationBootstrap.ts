import type { DataGridPivotSpec } from "@affino/datagrid-pivot"
import {
  createClientRowMutationHostRuntime,
  type ClientRowMutationHostRuntime,
} from "../host/clientRowMutationHostRuntime.js"
import {
  createClientRowPatchHostRuntime,
  type ClientRowPatchHostRuntime,
} from "../host/clientRowPatchHostRuntime.js"
import type { ClientRowComputeHostRuntime } from "../host/clientRowComputeHostRuntime.js"
import type { DataGridClientRowProjectionIntegrationHostRuntime } from "../host/clientRowProjectionIntegrationHostRuntime.js"
import type {
  DataGridAggregationModel,
  DataGridFilterSnapshot,
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaRowRecomputeDiagnostics,
  DataGridGroupBySpec,
  DataGridPaginationInput,
  DataGridPaginationSnapshot,
  DataGridProjectionFormulaDiagnostics,
  DataGridProjectionStage,
  DataGridRowId,
  DataGridRowNode,
  DataGridSortState,
  DataGridTreeDataResolvedSpec,
  DataGridViewportRange,
} from "../rowModel.js"
import type { DataGridPatchChangeSet } from "../mutation/rowPatchAnalyzer.js"
import type {
  ApplyComputedFieldsToSourceRowsOptions,
  ApplyComputedFieldsToSourceRowsResult,
} from "../compute/clientRowComputedExecutionRuntime.js"
import type { DataGridProjectionPolicy } from "../projection/projectionPolicy.js"
import type { DataGridClientRowRuntimeState, DataGridClientRowRuntimeStateStore } from "../state/clientRowRuntimeStateStore.js"
import type { ClientRowRowVersionRuntime } from "../state/clientRowRowVersionRuntime.js"
import type { ClientRowDerivedCacheRuntime } from "../projection/clientRowDerivedCacheRuntime.js"
import type { DataGridClientRowExpansionHostRuntime } from "../host/clientRowExpansionHostRuntime.js"
import type { DataGridClientRowFlatIdentityProjectionRefreshRuntime } from "../projection/clientRowFlatIdentityProjectionRefreshRuntime.js"
import type { DataGridClientRowSourceNormalizationRuntime } from "../state/clientRowSourceNormalizationRuntime.js"
import type { ClientRowComputedSnapshotRuntime } from "../materialization/clientRowComputedSnapshotRuntime.js"
import type { DataGridClientRowTreePivotIntegrationRuntime } from "../projection/clientRowTreePivotIntegrationRuntime.js"
import { pruneSortCacheRows, reindexSourceRows } from "../clientRowRuntimeUtils.js"

export interface ClientRowModelMutationBootstrapResult<T> {
  mutationHostRuntime: ClientRowMutationHostRuntime<T>
  patchHostRuntime: ClientRowPatchHostRuntime<T>
}

export interface CreateClientRowModelMutationBootstrapOptions<T> {
  ensureActive: () => void
  emit: () => void
  isDataGridRowId: (value: unknown) => value is DataGridRowId
  treeData: DataGridTreeDataResolvedSpec<T> | null
  projectionPolicy: DataGridProjectionPolicy
  runtimeState: DataGridClientRowRuntimeState<T>
  runtimeStateStore: DataGridClientRowRuntimeStateStore<T>
  getBaseSourceRows: () => DataGridRowNode<T>[]
  setBaseSourceRows: (rows: DataGridRowNode<T>[]) => void
  getSourceRowIndexById: () => ReadonlyMap<DataGridRowId, number>
  getSortModel: () => readonly DataGridSortState[]
  setSortModel: (value: readonly DataGridSortState[]) => void
  cloneSortModel: (input: readonly DataGridSortState[]) => readonly DataGridSortState[]
  getFilterModel: () => DataGridFilterSnapshot | null
  setFilterModel: (value: DataGridFilterSnapshot | null) => void
  cloneFilterModel: (input: DataGridFilterSnapshot | null) => DataGridFilterSnapshot | null
  getGroupBy: () => DataGridGroupBySpec | null
  setGroupBy: (value: DataGridGroupBySpec | null) => void
  getPivotModel: () => DataGridPivotSpec | null
  setPivotModel: (value: DataGridPivotSpec | null) => void
  resetPivotColumns: () => void
  getAggregationModel: () => DataGridAggregationModel<T> | null
  setAggregationModel: (value: DataGridAggregationModel<T> | null) => void
  getPaginationInput: () => DataGridPaginationInput
  setPaginationInput: (value: DataGridPaginationInput) => void
  getPagination: () => DataGridPaginationSnapshot
  setPagination: (value: DataGridPaginationSnapshot) => void
  getViewportRange: () => DataGridViewportRange
  setViewportRange: (value: DataGridViewportRange) => void
  normalizeViewportRange: (range: DataGridViewportRange, rowCount: number) => DataGridViewportRange
  rowVersionRuntime: ClientRowRowVersionRuntime<T>
  derivedCacheRuntime: ClientRowDerivedCacheRuntime<T>
  expansionHostRuntime: DataGridClientRowExpansionHostRuntime
  projectionIntegrationHostRuntime: DataGridClientRowProjectionIntegrationHostRuntime<T>
  treePivotIntegrationRuntime: DataGridClientRowTreePivotIntegrationRuntime<T>
  flatIdentityProjectionRefreshRuntime: DataGridClientRowFlatIdentityProjectionRefreshRuntime
  computeHostRuntime: ClientRowComputeHostRuntime<T>
  sourceNormalizationRuntime: DataGridClientRowSourceNormalizationRuntime<T>
  computedSnapshotRuntime: ClientRowComputedSnapshotRuntime<T>
  applyRowDataPatch: (value: T, patch: Partial<T>) => T
  isRecord: (value: unknown) => value is Record<string, unknown>
  mergeRowPatch: (left: Partial<T>, right: Partial<T>) => Partial<T>
  materializeBaseRowAtIndex: (rowIndex: number) => DataGridRowNode<T> | null
  refreshMaterializedSourceRows: (changedRowIds?: readonly DataGridRowId[]) => void
  invalidateSourceColumnValuesByRowIds: (rowIds: readonly DataGridRowId[]) => void
  applyComputedFieldsToSourceRows: (options?: ApplyComputedFieldsToSourceRowsOptions) => ApplyComputedFieldsToSourceRowsResult<T>
  commitFormulaDiagnostics: (diagnostics: DataGridProjectionFormulaDiagnostics | null) => void
  commitFormulaComputeStageDiagnostics: (diagnostics: DataGridFormulaComputeStageDiagnostics | null) => void
  commitFormulaRowRecomputeDiagnostics: (diagnostics: DataGridFormulaRowRecomputeDiagnostics | null | { rows: [] }) => void
  getAllStages: () => readonly DataGridProjectionStage[]
  expandStages: (stages: readonly DataGridProjectionStage[]) => ReadonlySet<DataGridProjectionStage>
  applyIncrementalAggregationPatch: (
    changeSet: DataGridPatchChangeSet,
    previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  ) => boolean
  hasComputedFields: () => boolean
}

export function createClientRowModelMutationBootstrap<T>(
  options: CreateClientRowModelMutationBootstrapOptions<T>,
): ClientRowModelMutationBootstrapResult<T> {
  const mutationHostRuntime = createClientRowMutationHostRuntime<T>({
    stateMutationsContext: {
      ensureActive: options.ensureActive,
      emit: options.emit,
      recomputeFromStage: (stage) => {
        if (stage === "compute" && options.flatIdentityProjectionRefreshRuntime.tryApply()) {
          return
        }
        options.computeHostRuntime.recomputeFromStage(stage)
      },
      setProjectionInvalidation: (reasons) => {
        options.runtimeStateStore.setProjectionInvalidation(reasons)
      },
      bumpSortRevision: () => {
        options.runtimeStateStore.bumpSortRevision()
      },
      bumpFilterRevision: () => {
        options.runtimeStateStore.bumpFilterRevision()
      },
      bumpGroupRevision: () => {
        options.runtimeStateStore.bumpGroupRevision()
      },
      getRuntimeRowCount: () => options.runtimeState.rows.length,
      getViewportRange: options.getViewportRange,
      setViewportRange: options.setViewportRange,
      getPaginationInput: options.getPaginationInput,
      setPaginationInput: options.setPaginationInput,
      getSortModel: options.getSortModel,
      setSortModel: options.setSortModel,
      cloneSortModel: options.cloneSortModel,
      getFilterModel: options.getFilterModel,
      setFilterModel: options.setFilterModel,
      cloneFilterModel: options.cloneFilterModel,
      isTreeDataEnabled: () => Boolean(options.treeData),
      getGroupBy: options.getGroupBy,
      setGroupBy: options.setGroupBy,
      setExpansionExpandedByDefault: (value) => {
        options.expansionHostRuntime.setExpansionExpandedByDefault(value)
      },
      clearToggledGroupKeys: () => {
        options.expansionHostRuntime.clearToggledGroupKeys()
      },
      getPivotModel: options.getPivotModel,
      setPivotModel: options.setPivotModel,
      resetPivotColumns: options.resetPivotColumns,
      setPivotExpansionExpandedByDefault: (value) => {
        options.treePivotIntegrationRuntime.setPivotExpansionExpandedByDefault(value)
      },
      clearToggledPivotGroupKeys: () => {
        options.treePivotIntegrationRuntime.clearToggledPivotGroupKeys()
      },
      getAggregationModel: options.getAggregationModel,
      setAggregationModel: options.setAggregationModel,
      invalidateTreeProjectionCaches: () => {
        options.projectionIntegrationHostRuntime.invalidateTreeProjectionCaches()
      },
      applyGroupExpansion: (nextExpansion) => options.expansionHostRuntime.applyGroupExpansion(nextExpansion),
      getExpansionSpec: () => options.expansionHostRuntime.getExpansionSpec(),
      getActiveExpansionStateStore: () => options.expansionHostRuntime.getActiveExpansionStateStore(),
    },
    rowsMutationsContext: {
      ensureActive: options.ensureActive,
      emit: options.emit,
      recomputeFromProjectionEntryStage: () => {
        if (options.flatIdentityProjectionRefreshRuntime.tryApply()) {
          return
        }
        options.computeHostRuntime.recomputeFromStage("compute")
      },
      applyComputedFields: () => {
        const computedResult = options.applyComputedFieldsToSourceRows()
        options.commitFormulaDiagnostics(computedResult.formulaDiagnostics)
        options.commitFormulaComputeStageDiagnostics(computedResult.computeStageDiagnostics)
        options.commitFormulaRowRecomputeDiagnostics(computedResult.rowRecomputeDiagnostics)
        if (!computedResult.changed) {
          return
        }
        options.rowVersionRuntime.bump(computedResult.changedRowIds)
      },
      setProjectionInvalidation: (reasons) => {
        options.runtimeStateStore.setProjectionInvalidation(reasons)
      },
      bumpRowRevision: () => {
        options.runtimeStateStore.bumpRowRevision()
      },
      resetGroupByIncrementalAggregationState: () => {
        options.projectionIntegrationHostRuntime.resetGroupByIncrementalAggregationState()
      },
      invalidateTreeProjectionCaches: () => {
        options.projectionIntegrationHostRuntime.invalidateTreeProjectionCaches()
      },
      getSourceRows: options.getBaseSourceRows,
      setSourceRows: (rows) => {
        options.setBaseSourceRows(rows)
        options.computedSnapshotRuntime.pruneRows(options.getBaseSourceRows())
        options.refreshMaterializedSourceRows()
      },
      normalizeSourceRows: (nextRows) => options.sourceNormalizationRuntime.normalizeSourceRows(nextRows),
      reindexSourceRows,
      getRowVersionById: () => options.rowVersionRuntime.getIndex(),
      setRowVersionById: (index) => {
        options.rowVersionRuntime.setIndex(index)
      },
      rebuildRowVersionIndex: (_previous, rows) => options.rowVersionRuntime.rebuild(rows),
      pruneSortCacheRows: (rows) => {
        pruneSortCacheRows(options.derivedCacheRuntime.getSortValueCache(), rows)
      },
    },
  })

  const patchHostRuntime = createClientRowPatchHostRuntime<T>({
    ensureActive: options.ensureActive,
    emit: options.emit,
    setPendingPivotValuePatch: (patch) => {
      options.treePivotIntegrationRuntime.setPendingPivotValuePatch(patch)
    },
    isDataGridRowId: options.isDataGridRowId,
    applyRowDataPatch: options.applyRowDataPatch,
    getSourceRows: options.getBaseSourceRows,
    invalidateSourceColumnValuesByRowIds: options.invalidateSourceColumnValuesByRowIds,
    isRecord: options.isRecord,
    applyComputedFieldsToSourceRows: options.applyComputedFieldsToSourceRows,
    commitFormulaDiagnostics: options.commitFormulaDiagnostics,
    commitFormulaComputeStageDiagnostics: options.commitFormulaComputeStageDiagnostics,
    commitFormulaRowRecomputeDiagnostics: options.commitFormulaRowRecomputeDiagnostics,
    mergeRowPatch: options.mergeRowPatch,
    getBaseSourceRows: options.getBaseSourceRows,
    getMaterializedSourceRowAtIndex: options.materializeBaseRowAtIndex,
    getSourceRowIndexById: options.getSourceRowIndexById,
    preparePatchedBaseRows: (rows, changedRowIds) => {
      options.setBaseSourceRows(rows as DataGridRowNode<T>[])
      options.refreshMaterializedSourceRows(changedRowIds)
    },
    setSourceRows: (rows) => {
      if (rows === options.getBaseSourceRows()) {
        return
      }
      options.setBaseSourceRows(rows as DataGridRowNode<T>[])
      options.computedSnapshotRuntime.pruneRows(options.getBaseSourceRows())
      options.refreshMaterializedSourceRows()
    },
    getRowVersionById: () => options.rowVersionRuntime.getIndex(),
    bumpRowRevision: () => {
      options.runtimeStateStore.bumpRowRevision()
    },
    setProjectionInvalidation: (reasons) => {
      options.runtimeStateStore.setProjectionInvalidation(reasons)
    },
    getFilterModel: options.getFilterModel,
    getSortModel: options.getSortModel,
    getTreeData: () => options.treeData,
    getGroupBy: options.getGroupBy,
    getPivotModel: options.getPivotModel,
    getAggregationModel: options.getAggregationModel,
    getProjectionPolicy: () => options.projectionPolicy,
    getAllStages: options.getAllStages,
    expandStages: options.expandStages,
    applyIncrementalAggregationPatch: options.applyIncrementalAggregationPatch,
    clearSortValueCache: () => {
      options.derivedCacheRuntime.clearSortValueCache()
    },
    evictSortValueCacheRows: (rowIds) => {
      options.derivedCacheRuntime.evictSortValueCacheRows(rowIds)
    },
    invalidateTreeProjectionCaches: () => {
      options.projectionIntegrationHostRuntime.invalidateTreeProjectionCaches()
    },
    patchTreeProjectionCacheRowsByIdentity: (changedRowIds) => {
      options.projectionIntegrationHostRuntime.patchTreeProjectionCacheRowsByIdentity(changedRowIds)
    },
    recomputeWithExecutionPlan: (executionPlan, requestOptions) => {
      options.computeHostRuntime.recomputeWithExecutionPlan(executionPlan, requestOptions)
    },
    getStaleStages: () => options.computeHostRuntime.getStaleStages(),
    getRuntimeState: () => options.runtimeState,
    getPagination: options.getPagination,
    commitProjectionCycle: (hadActualRecompute) => {
      options.runtimeStateStore.commitProjectionCycle(hadActualRecompute)
    },
    updateDerivedCacheRevisions: (revisions) => {
      options.derivedCacheRuntime.updateRevisions(revisions)
    },
    hasComputedFields: options.hasComputedFields,
  })

  return {
    mutationHostRuntime,
    patchHostRuntime,
  }
}
