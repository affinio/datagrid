import type {
  DataGridAggregationModel,
  DataGridFilterSnapshot,
  DataGridFormulaComputeStageDiagnostics,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationSnapshot,
  DataGridPivotColumn,
  DataGridPivotSpec,
  DataGridProjectionStage,
  DataGridRowModelSnapshot,
  DataGridSortState,
  DataGridTreeDataDiagnostics,
  DataGridViewportRange,
} from "../rowModel.js"
import type {
  DataGridCalculationSnapshot,
  DataGridCalculationSnapshotInspection,
  DataGridCalculationSnapshotRestoreOptions,
  DataGridClientRowCalculationSnapshotRuntime,
} from "../snapshot/clientRowCalculationSnapshotRuntime.js"
import {
  createClientRowCalculationSnapshotRuntime,
} from "../snapshot/clientRowCalculationSnapshotRuntime.js"
import type {
  ClientRowSnapshotRuntime,
} from "../snapshot/clientRowSnapshotRuntime.js"
import { createClientRowSnapshotRuntime } from "../snapshot/clientRowSnapshotRuntime.js"
import type {
  DataGridClientRowSnapshotHostRuntime,
} from "../host/clientRowSnapshotHostRuntime.js"
import { createClientRowSnapshotHostRuntime } from "../host/clientRowSnapshotHostRuntime.js"
import type {
  ClientRowComputedRowBoundSnapshot,
} from "../materialization/clientRowComputedSnapshotRuntime.js"
import type {
  DataGridClientRowRuntimeState,
  DataGridClientRowRuntimeStateStore,
} from "../state/clientRowRuntimeStateStore.js"
import type {
  DataGridFormulaRowRecomputeDiagnostics,
} from "../rowModel.js"

export interface ClientRowModelSnapshotBootstrapResult<T> {
  calculationSnapshotRuntime: DataGridClientRowCalculationSnapshotRuntime<T>
  snapshotRuntime: ClientRowSnapshotRuntime<T>
  snapshotHostRuntime: DataGridClientRowSnapshotHostRuntime<T>
}

export interface CreateClientRowModelSnapshotBootstrapOptions<T> {
  runtimeState: DataGridClientRowRuntimeState<T>
  runtimeStateStore: DataGridClientRowRuntimeStateStore<T>
  getStaleStages: () => readonly DataGridProjectionStage[]
  getFormulaComputeStageDiagnostics: () => DataGridFormulaComputeStageDiagnostics | null
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
  getBaseSourceRows: () => readonly { rowId: string | number }[]
  createComputedSnapshot: () => ClientRowComputedRowBoundSnapshot
  getAggregationModel: () => DataGridAggregationModel<T> | null
  cloneAggregationModel: (
    model: DataGridAggregationModel<T> | null,
  ) => DataGridAggregationModel<T> | null
  getFormulaComputeStageDiagnosticsSnapshot: () => DataGridFormulaComputeStageDiagnostics | null
  getFormulaRowRecomputeDiagnosticsSnapshot: () => DataGridFormulaRowRecomputeDiagnostics | null
  applySnapshotRestore: (
    snapshot: DataGridCalculationSnapshot<T>,
    inspection: DataGridCalculationSnapshotInspection,
    options: DataGridCalculationSnapshotRestoreOptions,
  ) => boolean
}

export function createClientRowModelSnapshotBootstrap<T>(
  options: CreateClientRowModelSnapshotBootstrapOptions<T>,
): ClientRowModelSnapshotBootstrapResult<T> {
  const snapshotRuntime = createClientRowSnapshotRuntime<T>({
    runtimeState: options.runtimeState,
    runtimeStateStore: options.runtimeStateStore,
    getSourceRowCount: () => options.getBaseSourceRows().length,
    getSourceRowIndexSize: () => options.getBaseSourceRows().length,
    getStaleStages: options.getStaleStages,
    getFormulaComputeStageDiagnostics: options.getFormulaComputeStageDiagnostics,
    getViewportRange: options.getViewportRange,
    setViewportRange: options.setViewportRange,
    normalizeViewportRange: options.normalizeViewportRange,
    getPagination: options.getPagination,
    getSortModel: options.getSortModel,
    cloneSortModel: options.cloneSortModel,
    getFilterModel: options.getFilterModel,
    cloneFilterModel: options.cloneFilterModel,
    isTreeDataEnabled: options.isTreeDataEnabled,
    getTreeDataDiagnostics: options.getTreeDataDiagnostics,
    cloneTreeDataDiagnostics: options.cloneTreeDataDiagnostics,
    getGroupBy: options.getGroupBy,
    cloneGroupBySpec: options.cloneGroupBySpec,
    getPivotModel: options.getPivotModel,
    clonePivotSpec: options.clonePivotSpec,
    getPivotColumns: options.getPivotColumns,
    normalizePivotColumns: options.normalizePivotColumns,
    getExpansionSnapshot: options.getExpansionSnapshot,
  })

  const calculationSnapshotRuntime = createClientRowCalculationSnapshotRuntime<T>({
    getBaseSourceRows: options.getBaseSourceRows,
    createComputedSnapshot: options.createComputedSnapshot,
    getModelSnapshot: () => snapshotRuntime.getSnapshot() as DataGridRowModelSnapshot<T>,
    getAggregationModel: options.getAggregationModel,
    cloneAggregationModel: options.cloneAggregationModel,
    getFormulaComputeStageDiagnosticsSnapshot: options.getFormulaComputeStageDiagnosticsSnapshot,
    getFormulaRowRecomputeDiagnosticsSnapshot: options.getFormulaRowRecomputeDiagnosticsSnapshot,
    applySnapshotRestore: options.applySnapshotRestore,
  })

  const snapshotHostRuntime = createClientRowSnapshotHostRuntime<T>({
    snapshotRuntime,
    calculationSnapshotRuntime,
  })

  return {
    calculationSnapshotRuntime,
    snapshotRuntime,
    snapshotHostRuntime,
  }
}
