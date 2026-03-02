import type {
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationSnapshot,
  DataGridPivotColumn,
  DataGridPivotSpec,
  DataGridProjectionDiagnostics,
  DataGridProjectionStage,
  DataGridRowModelSnapshot,
  DataGridSortState,
  DataGridTreeDataDiagnostics,
  DataGridViewportRange,
} from "./rowModel.js"
import type { DataGridClientRowRuntimeState, DataGridClientRowRuntimeStateStore } from "./clientRowRuntimeStateStore.js"

export interface ClientRowSnapshotRuntimeContext<T> {
  runtimeState: DataGridClientRowRuntimeState<T>
  runtimeStateStore: Pick<DataGridClientRowRuntimeStateStore<T>, "getProjectionDiagnostics">
  getStaleStages: () => readonly DataGridProjectionStage[]

  getViewportRange: () => DataGridViewportRange
  setViewportRange: (range: DataGridViewportRange) => void
  normalizeViewportRange: (range: DataGridViewportRange, rowCount: number) => DataGridViewportRange

  getPagination: () => DataGridPaginationSnapshot
  getSortModel: () => readonly DataGridSortState[]
  cloneSortModel: (input: readonly DataGridSortState[]) => readonly DataGridSortState[]

  getFilterModel: () => DataGridFilterSnapshot | null
  cloneFilterModel: (input: DataGridFilterSnapshot | null) => DataGridFilterSnapshot | null

  isTreeDataEnabled: () => boolean
  getTreeDataDiagnostics: () => DataGridTreeDataDiagnostics | null
  cloneTreeDataDiagnostics: (input: DataGridTreeDataDiagnostics | null) => DataGridTreeDataDiagnostics | null

  getGroupBy: () => DataGridGroupBySpec | null
  cloneGroupBySpec: (groupBy: DataGridGroupBySpec | null) => DataGridGroupBySpec | null

  getPivotModel: () => DataGridPivotSpec | null
  clonePivotSpec: (pivotModel: DataGridPivotSpec | null) => DataGridPivotSpec | null
  getPivotColumns: () => readonly DataGridPivotColumn[]
  normalizePivotColumns: (columns: readonly DataGridPivotColumn[]) => DataGridPivotColumn[]

  getExpansionSnapshot: () => DataGridGroupExpansionSnapshot
}

export interface ClientRowSnapshotRuntime<T> {
  getProjectionDiagnostics: () => DataGridProjectionDiagnostics
  getSnapshot: () => DataGridRowModelSnapshot<T>
}

export function createClientRowSnapshotRuntime<T>(
  context: ClientRowSnapshotRuntimeContext<T>,
): ClientRowSnapshotRuntime<T> {
  const getProjectionDiagnostics = (): DataGridProjectionDiagnostics => {
    return context.runtimeStateStore.getProjectionDiagnostics(context.getStaleStages)
  }

  const getSnapshot = (): DataGridRowModelSnapshot<T> => {
    const normalizedViewportRange = context.normalizeViewportRange(
      context.getViewportRange(),
      context.runtimeState.rows.length,
    )
    context.setViewportRange(normalizedViewportRange)
    const treeDataEnabled = context.isTreeDataEnabled()
    const pivotModel = context.getPivotModel()
    return {
      revision: context.runtimeState.revision,
      kind: "client",
      rowCount: context.runtimeState.rows.length,
      loading: false,
      error: null,
      ...(treeDataEnabled
        ? { treeDataDiagnostics: context.cloneTreeDataDiagnostics(context.getTreeDataDiagnostics()) }
        : {}),
      projection: getProjectionDiagnostics(),
      viewportRange: normalizedViewportRange,
      pagination: context.getPagination(),
      sortModel: context.cloneSortModel(context.getSortModel()),
      filterModel: context.cloneFilterModel(context.getFilterModel()),
      groupBy: treeDataEnabled ? null : context.cloneGroupBySpec(context.getGroupBy()),
      ...(pivotModel
        ? {
            pivotModel: context.clonePivotSpec(pivotModel),
            pivotColumns: context.normalizePivotColumns(context.getPivotColumns()),
          }
        : {}),
      groupExpansion: context.getExpansionSnapshot(),
    }
  }

  return {
    getProjectionDiagnostics,
    getSnapshot,
  }
}
