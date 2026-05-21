import {
  cloneProjectionFormulaDiagnostics,
  type DataGridCalculationSnapshot,
  type DataGridCalculationSnapshotRestoreOptions,
} from "./clientRowCalculationSnapshotRuntime.js"
import type {
  DataGridAggregationModel,
  DataGridFilterSnapshot,
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaRowRecomputeDiagnostics,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridPivotColumn,
  DataGridProjectionFormulaDiagnostics,
  DataGridProjectionInvalidationReason,
  DataGridSortState,
  DataGridViewportRange,
} from "../rowModel.js"
import type { DataGridPivotSpec } from "@affino/datagrid-pivot"

export interface CreateClientRowCalculationSnapshotRestoreRuntimeOptions<T> {
  syncComputedSnapshotFields: () => void
  replaceComputedSnapshot: (snapshot: DataGridCalculationSnapshot<T>["computedSnapshot"]) => void
  refreshMaterializedSourceRows: () => void
  cloneSortModel: (input: readonly DataGridSortState[]) => readonly DataGridSortState[]
  setSortModel: (model: readonly DataGridSortState[]) => void
  cloneFilterModel: (input: DataGridFilterSnapshot | null) => DataGridFilterSnapshot | null
  setFilterModel: (model: DataGridFilterSnapshot | null) => void
  isTreeDataEnabled: () => boolean
  cloneGroupBySpec: (groupBy: DataGridGroupBySpec | null) => DataGridGroupBySpec | null
  setGroupBy: (groupBy: DataGridGroupBySpec | null) => void
  restoreExpansionSnapshot: (snapshot: DataGridGroupExpansionSnapshot) => void
  clonePivotSpec: (pivotModel: DataGridPivotSpec | null) => DataGridPivotSpec | null
  setPivotModel: (pivotModel: DataGridPivotSpec | null) => void
  normalizePivotColumns: (columns: readonly DataGridPivotColumn[]) => DataGridPivotColumn[]
  setPivotColumns: (columns: DataGridPivotColumn[]) => void
  resetPivotExpansionState: () => void
  cloneAggregationModel: (
    model: DataGridAggregationModel<T> | null,
  ) => DataGridAggregationModel<T> | null
  setAggregationModel: (model: DataGridAggregationModel<T> | null) => void
  normalizePaginationInput: (input: DataGridPaginationInput | null) => DataGridPaginationInput
  setPaginationInput: (input: DataGridPaginationInput) => void
  normalizeViewportRange: (range: DataGridViewportRange, rowCount: number) => DataGridViewportRange
  getOutputRowCount: () => number
  setViewportRange: (range: DataGridViewportRange) => void
  createEmptyFormulaDiagnostics: () => DataGridProjectionFormulaDiagnostics
  commitFormulaDiagnostics: (diagnostics: DataGridProjectionFormulaDiagnostics) => void
  createEmptyFormulaComputeStageDiagnostics: () => DataGridFormulaComputeStageDiagnostics
  commitFormulaComputeStageDiagnostics: (diagnostics: DataGridFormulaComputeStageDiagnostics) => void
  commitFormulaRowRecomputeDiagnostics: (diagnostics: DataGridFormulaRowRecomputeDiagnostics) => void
  resetDerivedCaches: () => void
  clearPendingPivotValuePatch: () => void
  resetGroupByIncrementalAggregationState: () => void
  invalidateTreeProjectionCaches: () => void
  setProjectionInvalidation: (reasons: readonly DataGridProjectionInvalidationReason[]) => void
  tryApplyFlatIdentityProjectionRefresh: () => boolean
  refreshComputeHost: () => void
  emit: () => void
}

export interface ClientRowCalculationSnapshotRestoreRuntime<T> {
  restoreCalculationSnapshot(
    snapshot: DataGridCalculationSnapshot<T>,
    options?: DataGridCalculationSnapshotRestoreOptions,
  ): boolean
}

export function createClientRowCalculationSnapshotRestoreRuntime<T>(
  options: CreateClientRowCalculationSnapshotRestoreRuntimeOptions<T>,
): ClientRowCalculationSnapshotRestoreRuntime<T> {
  const restoreCalculationSnapshot = (
    snapshot: DataGridCalculationSnapshot<T>,
    restoreOptions: DataGridCalculationSnapshotRestoreOptions = {},
  ): boolean => {
    options.syncComputedSnapshotFields()
    options.replaceComputedSnapshot(snapshot.computedSnapshot)
    options.refreshMaterializedSourceRows()

    const restoredModelSnapshot = snapshot.modelSnapshot
    options.setSortModel(options.cloneSortModel(restoredModelSnapshot.sortModel))
    options.setFilterModel(options.cloneFilterModel(restoredModelSnapshot.filterModel))
    if (!options.isTreeDataEnabled()) {
      options.setGroupBy(options.cloneGroupBySpec(restoredModelSnapshot.groupBy))
      options.restoreExpansionSnapshot(restoredModelSnapshot.groupExpansion)
    }
    options.setPivotModel(options.clonePivotSpec(restoredModelSnapshot.pivotModel ?? null))
    options.setPivotColumns(options.normalizePivotColumns(restoredModelSnapshot.pivotColumns ?? []))
    options.resetPivotExpansionState()
    options.setAggregationModel(options.cloneAggregationModel(snapshot.aggregationModel))
    options.setPaginationInput(restoredModelSnapshot.pagination.enabled
      ? options.normalizePaginationInput({
        pageSize: restoredModelSnapshot.pagination.pageSize,
        currentPage: restoredModelSnapshot.pagination.currentPage,
      })
      : options.normalizePaginationInput(null))
    options.setViewportRange(
      options.normalizeViewportRange(restoredModelSnapshot.viewportRange, options.getOutputRowCount()),
    )

    options.commitFormulaDiagnostics(
      cloneProjectionFormulaDiagnostics(restoredModelSnapshot.projection?.formula ?? null)
        ?? options.createEmptyFormulaDiagnostics(),
    )
    options.commitFormulaComputeStageDiagnostics(
      snapshot.formulaComputeStage ?? options.createEmptyFormulaComputeStageDiagnostics(),
    )
    options.commitFormulaRowRecomputeDiagnostics(snapshot.formulaRowRecompute ?? { rows: [] })

    options.resetDerivedCaches()
    options.clearPendingPivotValuePatch()
    options.resetGroupByIncrementalAggregationState()
    options.invalidateTreeProjectionCaches()

    options.setProjectionInvalidation(["computedChanged"])
    if (!options.tryApplyFlatIdentityProjectionRefresh()) {
      options.refreshComputeHost()
    }
    if (restoreOptions.emit !== false) {
      options.emit()
    }
    return true
  }

  return {
    restoreCalculationSnapshot,
  }
}
