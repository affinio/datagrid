import type {
  DataGridRowNode,
} from "../rowModel.js"
import type { ClientRowFormulaDiagnosticsRuntime } from "../compute/clientRowFormulaDiagnosticsRuntime.js"
import type { DataGridClientRowRuntimeState } from "../state/clientRowRuntimeStateStore.js"

export interface CreateClientRowDisposeHostRuntimeOptions<T> {
  lifecycle: { dispose(): boolean }
  formulaHostRuntime: { dispose(): void }
  computeHostRuntime: { dispose(): void }
  clearSourceRowsState: () => void
  clearSourceColumnValuesCache: () => void
  runtimeState: DataGridClientRowRuntimeState<T>
  materializationRuntime: { clearMaterializedSourceRowsCache(): void }
  resetPivotColumns: () => void
  rowVersionRuntime: { clear(): void }
  projectionIntegrationHostRuntime: {
    resetGroupByIncrementalAggregationState(): void
    invalidateTreeProjectionCaches(): void
  }
  projectionTransientStateRuntime: { resetGroupedProjectionGroupIndexByRowId(): void }
  treePivotIntegrationRuntime: { resetPivotExpansionState(): void }
  expansionHostRuntime: { resetExpansionState(): void }
  derivedCacheRuntime: {
    clearSortValueCache(): void
    clearGroupValueCache(): void
    clearFilterPredicateCache(): void
  }
  computedRegistry: { clear(): void }
  computedRegistryRef: { current: unknown }
  formulaDiagnosticsRuntime: Pick<
    ClientRowFormulaDiagnosticsRuntime,
    | "createEmptyFormulaComputeStageDiagnostics"
    | "commitFormulaComputeStageDiagnostics"
    | "commitFormulaRowRecomputeDiagnostics"
  >
  runtimeStateStore: { setProjectionFormulaDiagnostics(diagnostics: null): void }
}

export interface ClientRowDisposeHostRuntime {
  dispose(): void
}

export function clearClientRowProjectionArrays<T>(
  runtimeState: {
    rows: DataGridRowNode<T>[]
    filteredRowsProjection: DataGridRowNode<T>[]
    sortedRowsProjection: DataGridRowNode<T>[]
    groupedRowsProjection: DataGridRowNode<T>[]
    pivotedRowsProjection: DataGridRowNode<T>[]
    aggregatedRowsProjection: DataGridRowNode<T>[]
    paginatedRowsProjection: DataGridRowNode<T>[]
  },
): void {
  runtimeState.rows = []
  runtimeState.filteredRowsProjection = []
  runtimeState.sortedRowsProjection = []
  runtimeState.groupedRowsProjection = []
  runtimeState.pivotedRowsProjection = []
  runtimeState.aggregatedRowsProjection = []
  runtimeState.paginatedRowsProjection = []
}

export function createClientRowDisposeHostRuntime<T>(
  options: CreateClientRowDisposeHostRuntimeOptions<T>,
): ClientRowDisposeHostRuntime {
  return {
    dispose() {
      if (!options.lifecycle.dispose()) {
        return
      }
      options.formulaHostRuntime.dispose()
      options.computeHostRuntime.dispose()
      options.clearSourceRowsState()
      options.clearSourceColumnValuesCache()
      clearClientRowProjectionArrays(options.runtimeState)
      options.materializationRuntime.clearMaterializedSourceRowsCache()
      options.resetPivotColumns()
      options.rowVersionRuntime.clear()
      options.projectionIntegrationHostRuntime.resetGroupByIncrementalAggregationState()
      options.projectionTransientStateRuntime.resetGroupedProjectionGroupIndexByRowId()
      options.treePivotIntegrationRuntime.resetPivotExpansionState()
      options.expansionHostRuntime.resetExpansionState()
      options.derivedCacheRuntime.clearSortValueCache()
      options.derivedCacheRuntime.clearGroupValueCache()
      options.computedRegistry.clear()
      options.computedRegistryRef.current = null
      options.formulaDiagnosticsRuntime.commitFormulaComputeStageDiagnostics(
        options.formulaDiagnosticsRuntime.createEmptyFormulaComputeStageDiagnostics(),
      )
      options.formulaDiagnosticsRuntime.commitFormulaRowRecomputeDiagnostics({ rows: [] })
      options.runtimeStateStore.setProjectionFormulaDiagnostics(null)
      options.projectionIntegrationHostRuntime.invalidateTreeProjectionCaches()
      options.derivedCacheRuntime.clearFilterPredicateCache()
    },
  }
}
