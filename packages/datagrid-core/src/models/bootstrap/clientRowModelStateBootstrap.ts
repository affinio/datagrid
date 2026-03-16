import {
  buildPaginationSnapshot,
  normalizeGroupBySpec,
  normalizePaginationInput,
  normalizeTreeDataSpec,
  normalizeViewportRange,
  type DataGridAggregationModel,
  type DataGridFilterSnapshot,
  type DataGridGroupBySpec,
  type DataGridRowIdResolver,
  type DataGridRowNode,
  type DataGridSortState,
  type DataGridTreeDataResolvedSpec,
} from "../rowModel.js"
import {
  normalizePivotSpec,
  type DataGridPivotColumn,
  type DataGridPivotSpec,
} from "@affino/datagrid-pivot"
import type { CreateClientRowModelOptions } from "../clientRowModel.js"
import { createDataGridProjectionPolicy, type DataGridProjectionPolicy } from "../projection/projectionPolicy.js"
import { buildRowIdPositionIndex } from "../clientRowRuntimeUtils.js"
import { createClientRowProjectionTransientStateRuntime, type ClientRowProjectionTransientStateRuntime } from "../state/clientRowProjectionTransientStateRuntime.js"
import { createClientRowSourceNormalizationRuntime, type DataGridClientRowSourceNormalizationRuntime } from "../state/clientRowSourceNormalizationRuntime.js"
import { createClientRowSourceStateRuntime, type ClientRowSourceStateRuntime } from "../state/clientRowSourceStateRuntime.js"
import { createClientRowRuntimeStateStore, type DataGridClientRowRuntimeStateStore } from "../state/clientRowRuntimeStateStore.js"
import { createClientRowViewStateRuntime, type ClientRowViewStateRuntime } from "../state/clientRowViewStateRuntime.js"
import { cloneDataGridFilterSnapshot as cloneFilterSnapshot } from "../filters/advancedFilter.js"
import { cloneAggregationModel } from "../clientRowModelHelpers.js"
import type { DataGridFieldDependency } from "../dependency/dependencyGraph.js"

export interface ClientRowModelStateBootstrapResult<T> {
  cloneSortModel: (input: readonly DataGridSortState[]) => readonly DataGridSortState[]
  cloneFilterModel: (input: DataGridFilterSnapshot | null) => DataGridFilterSnapshot | null
  resolveRowId: DataGridRowIdResolver<T> | undefined
  treeData: DataGridTreeDataResolvedSpec<T> | null
  projectionPolicy: DataGridProjectionPolicy
  formulaColumnCacheMaxColumns: number
  captureFormulaRowRecomputeDiagnostics: boolean
  captureFormulaExplainDiagnostics: boolean
  projectionTransientStateRuntime: ClientRowProjectionTransientStateRuntime
  sourceNormalizationRuntime: DataGridClientRowSourceNormalizationRuntime<T>
  sourceStateRuntime: ClientRowSourceStateRuntime<T>
  runtimeStateStore: DataGridClientRowRuntimeStateStore<T>
  viewStateRuntime: ClientRowViewStateRuntime<T>
}

export interface CreateClientRowModelStateBootstrapOptions<T> {
  options: CreateClientRowModelOptions<T>
  normalizeFormulaColumnCacheMaxColumns: (value: number | null | undefined) => number
}

export function createClientRowModelStateBootstrap<T>(
  input: CreateClientRowModelStateBootstrapOptions<T>,
): ClientRowModelStateBootstrapResult<T> {
  const { options, normalizeFormulaColumnCacheMaxColumns } = input
  const structuredCloneRef = (globalThis as typeof globalThis & {
    structuredClone?: <U>(value: U) => U
  }).structuredClone

  const cloneSortModel = (value: readonly DataGridSortState[]): readonly DataGridSortState[] =>
    value.map(item => ({ ...item }))

  const cloneFilterModel = (value: DataGridFilterSnapshot | null): DataGridFilterSnapshot | null => {
    if (!value) {
      return null
    }
    if (typeof structuredCloneRef === "function") {
      try {
        return structuredCloneRef(value)
      } catch {
        // Fall through to deterministic JS clone for non-cloneable payloads.
      }
    }
    return cloneFilterSnapshot(value)
  }

  const resolveRowId = options.resolveRowId
  const treeData = normalizeTreeDataSpec(options.initialTreeData ?? null)
  const projectionPolicy = options.projectionPolicy ?? createDataGridProjectionPolicy({
    performanceMode: options.performanceMode,
    dependencies: options.fieldDependencies,
  })
  const formulaColumnCacheMaxColumns = normalizeFormulaColumnCacheMaxColumns(
    options.formulaColumnCacheMaxColumns,
  )
  const captureFormulaRowRecomputeDiagnostics = options.captureFormulaRowRecomputeDiagnostics !== false
  const captureFormulaExplainDiagnostics = options.captureFormulaExplainDiagnostics !== false
  if (options.projectionPolicy && Array.isArray(options.fieldDependencies)) {
    for (const dependency of options.fieldDependencies as readonly DataGridFieldDependency[]) {
      projectionPolicy.dependencyGraph.registerDependency(
        dependency.sourceField,
        dependency.dependentField,
      )
    }
  }

  const projectionTransientStateRuntime = createClientRowProjectionTransientStateRuntime({
    treeDataEnabled: Boolean(treeData),
  })
  const sourceNormalizationRuntime = createClientRowSourceNormalizationRuntime<T>({
    resolveRowId,
    treeDataEnabled: Boolean(treeData),
    projectionTransientStateRuntime,
    isolateInputRows: options.isolateInputRows !== false,
  })
  const initialBaseSourceRows: DataGridRowNode<T>[] = sourceNormalizationRuntime.normalizeSourceRows(options.rows ?? [])
  const sourceStateRuntime = createClientRowSourceStateRuntime<T>({
    baseSourceRows: initialBaseSourceRows,
    sourceRows: initialBaseSourceRows,
    sourceRowIndexById: buildRowIdPositionIndex(initialBaseSourceRows),
    buildSourceRowIndexById: (rows: readonly DataGridRowNode<T>[]) => buildRowIdPositionIndex(rows),
  })
  const runtimeStateStore = createClientRowRuntimeStateStore<T>()

  const initialSortModel: readonly DataGridSortState[] = options.initialSortModel
    ? cloneSortModel(options.initialSortModel)
    : []
  const initialFilterModel: DataGridFilterSnapshot | null = cloneFilterModel(options.initialFilterModel ?? null)
  const initialGroupBy: DataGridGroupBySpec | null = treeData
    ? null
    : normalizeGroupBySpec(options.initialGroupBy ?? null)
  const initialPivotModel: DataGridPivotSpec | null = normalizePivotSpec(options.initialPivotModel ?? null)
  const initialPivotColumns: DataGridPivotColumn[] = []
  const initialAggregationModel: DataGridAggregationModel<T> | null = cloneAggregationModel(options.initialAggregationModel ?? null)
  const initialPaginationInput = normalizePaginationInput(options.initialPagination ?? null)
  const initialPagination = buildPaginationSnapshot(0, initialPaginationInput)
  const initialViewportRange = normalizeViewportRange({ start: 0, end: 0 }, runtimeStateStore.state.rows.length)
  const viewStateRuntime = createClientRowViewStateRuntime<T>({
    sortModel: initialSortModel,
    filterModel: initialFilterModel,
    groupBy: initialGroupBy,
    pivotModel: initialPivotModel,
    pivotColumns: initialPivotColumns,
    aggregationModel: initialAggregationModel,
    paginationInput: initialPaginationInput,
    pagination: initialPagination,
    viewportRange: initialViewportRange,
  })

  return {
    cloneSortModel,
    cloneFilterModel,
    resolveRowId,
    treeData,
    projectionPolicy,
    formulaColumnCacheMaxColumns,
    captureFormulaRowRecomputeDiagnostics,
    captureFormulaExplainDiagnostics,
    projectionTransientStateRuntime,
    sourceNormalizationRuntime,
    sourceStateRuntime,
    runtimeStateStore,
    viewStateRuntime,
  }
}
