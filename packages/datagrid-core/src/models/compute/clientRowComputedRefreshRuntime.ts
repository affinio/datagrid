import type {
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaRowRecomputeDiagnostics,
  DataGridProjectionFormulaDiagnostics,
  DataGridRowId,
} from "../rowModel.js"
import type {
  ApplyComputedFieldsToSourceRowsOptions,
  ApplyComputedFieldsToSourceRowsResult,
} from "./clientRowComputedExecutionRuntime.js"

export interface RecomputeComputedFieldsAndRefreshOptions {
  contextKeys?: ReadonlySet<string>
}

export interface CreateClientRowComputedRefreshRuntimeOptions<T> {
  applyComputedFieldsToSourceRows: (
    options?: ApplyComputedFieldsToSourceRowsOptions,
  ) => ApplyComputedFieldsToSourceRowsResult<T>
  commitFormulaDiagnostics: (diagnostics: DataGridProjectionFormulaDiagnostics) => void
  commitFormulaComputeStageDiagnostics: (diagnostics: DataGridFormulaComputeStageDiagnostics) => void
  commitFormulaRowRecomputeDiagnostics: (diagnostics: DataGridFormulaRowRecomputeDiagnostics) => void
  bumpRowVersions: (rowIds: readonly DataGridRowId[]) => void
  bumpRowRevision: () => void
  resetGroupByIncrementalAggregationState: () => void
  invalidateTreeProjectionCaches: () => void
  markComputedProjectionInvalidated: () => void
  tryApplyFlatIdentityProjectionRefresh: () => boolean
  recomputeFromComputeStage: () => void
  emit: () => void
}

export interface ClientRowComputedRefreshRuntime {
  recomputeComputedFieldsAndRefresh(
    rowIds?: ReadonlySet<DataGridRowId>,
    options?: RecomputeComputedFieldsAndRefreshOptions,
  ): number
}

export function createClientRowComputedRefreshRuntime<T>(
  options: CreateClientRowComputedRefreshRuntimeOptions<T>,
): ClientRowComputedRefreshRuntime {
  return {
    recomputeComputedFieldsAndRefresh(rowIds, refreshOptions = {}) {
      const computedResult = options.applyComputedFieldsToSourceRows({
        rowIds,
        changedContextKeys: refreshOptions.contextKeys,
      })
      options.commitFormulaDiagnostics(computedResult.formulaDiagnostics)
      options.commitFormulaComputeStageDiagnostics(computedResult.computeStageDiagnostics)
      options.commitFormulaRowRecomputeDiagnostics(computedResult.rowRecomputeDiagnostics)
      if (!computedResult.changed) {
        return 0
      }
      options.bumpRowVersions(computedResult.changedRowIds)
      options.bumpRowRevision()
      options.resetGroupByIncrementalAggregationState()
      options.invalidateTreeProjectionCaches()
      options.markComputedProjectionInvalidated()
      if (!options.tryApplyFlatIdentityProjectionRefresh()) {
        options.recomputeFromComputeStage()
      }
      options.emit()
      return computedResult.changedRowIds.length
    },
  }
}
