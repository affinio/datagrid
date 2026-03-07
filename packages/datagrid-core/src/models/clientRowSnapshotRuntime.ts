import type {
  DataGridFilterSnapshot,
  DataGridFormulaComputeStageDiagnostics,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationSnapshot,
  DataGridProjectionDiagnostics,
  DataGridProjectionStage,
  DataGridRowModelSnapshot,
  DataGridSortState,
  DataGridTreeDataDiagnostics,
  DataGridViewportRange,
} from "./rowModel.js"
import type {
  DataGridPivotColumn,
  DataGridPivotSpec,
} from "@affino/datagrid-pivot"
import type { DataGridClientRowRuntimeState, DataGridClientRowRuntimeStateStore } from "./clientRowRuntimeStateStore.js"

export interface ClientRowSnapshotRuntimeContext<T> {
  runtimeState: DataGridClientRowRuntimeState<T>
  runtimeStateStore: Pick<DataGridClientRowRuntimeStateStore<T>, "getProjectionDiagnostics">
  getStaleStages: () => readonly DataGridProjectionStage[]
  getFormulaComputeStageDiagnostics?: () => DataGridFormulaComputeStageDiagnostics | null

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
  const cloneFormulaComputeStageDiagnostics = (
    diagnostics: DataGridFormulaComputeStageDiagnostics,
  ): DataGridFormulaComputeStageDiagnostics => ({
    strategy: diagnostics.strategy,
    rowsTouched: diagnostics.rowsTouched,
    changedRows: diagnostics.changedRows,
    fieldsTouched: [...diagnostics.fieldsTouched],
    evaluations: diagnostics.evaluations,
    skippedByObjectIs: diagnostics.skippedByObjectIs,
    dirtyRows: diagnostics.dirtyRows,
    dirtyNodes: [...diagnostics.dirtyNodes],
    ...(diagnostics.nodes
      ? {
        nodes: diagnostics.nodes.map(node => ({
          name: node.name,
          field: node.field,
          dirty: node.dirty,
          touched: node.touched,
          ...(node.runtimeMode ? { runtimeMode: node.runtimeMode } : {}),
          evaluations: node.evaluations,
          dirtyRows: node.dirtyRows,
          dirtyCauses: node.dirtyCauses.map(cause => ({ ...cause })),
          ...(node.iterative ? { iterative: true } : {}),
          ...(typeof node.converged === "boolean" ? { converged: node.converged } : {}),
          ...(typeof node.iterationCount === "number" ? { iterationCount: node.iterationCount } : {}),
          ...(node.cycleGroup ? { cycleGroup: [...node.cycleGroup] } : {}),
        })),
      }
      : {}),
  })

  const getProjectionDiagnostics = (): DataGridProjectionDiagnostics => {
    const base = context.runtimeStateStore.getProjectionDiagnostics(context.getStaleStages)
    const computeStage = context.getFormulaComputeStageDiagnostics?.() ?? null
    if (!computeStage) {
      return base
    }
    return {
      ...base,
      computeStage: cloneFormulaComputeStageDiagnostics(computeStage),
    }
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
