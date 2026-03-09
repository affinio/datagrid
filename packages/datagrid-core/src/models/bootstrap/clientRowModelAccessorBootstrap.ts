import {
  type DataGridAggregationModel,
  type DataGridFilterSnapshot,
  type DataGridGroupBySpec,
  type DataGridPaginationInput,
  type DataGridPivotColumn,
  type DataGridPivotSpec,
  type DataGridRowId,
  type DataGridRowNode,
  type DataGridSortState,
  type DataGridViewportRange,
} from "../rowModel.js"
import type { DataGridClientRowRuntimeStateStore } from "../state/clientRowRuntimeStateStore.js"
import type { ClientRowSourceStateRuntime } from "../state/clientRowSourceStateRuntime.js"
import type { ClientRowViewStateRuntime } from "../state/clientRowViewStateRuntime.js"

export interface ClientRowModelAccessorBootstrapResult<T> {
  runtimeState: DataGridClientRowRuntimeStateStore<T>["state"]
  getBaseSourceRows(): DataGridRowNode<T>[]
  setBaseSourceRows(rows: DataGridRowNode<T>[]): void
  getSourceRowsState(): readonly DataGridRowNode<T>[]
  setSourceRowsState(rows: readonly DataGridRowNode<T>[]): void
  resetSourceRowsToBase(): void
  clearSourceRowsState(): void
  getSourceRowIndexById(): ReadonlyMap<DataGridRowId, number>
  setSourceRowIndexById(index: ReadonlyMap<DataGridRowId, number>): void
  getSortModel(): readonly DataGridSortState[]
  setSortModel(value: readonly DataGridSortState[]): void
  getFilterModel(): DataGridFilterSnapshot | null
  setFilterModel(value: DataGridFilterSnapshot | null): void
  getGroupBy(): DataGridGroupBySpec | null
  setGroupBy(value: DataGridGroupBySpec | null): void
  getPivotModel(): DataGridPivotSpec | null
  setPivotModel(value: DataGridPivotSpec | null): void
  getPivotColumns(): DataGridPivotColumn[]
  setPivotColumns(value: DataGridPivotColumn[]): void
  resetPivotColumns(): void
  getAggregationModel(): DataGridAggregationModel<T> | null
  setAggregationModel(value: DataGridAggregationModel<T> | null): void
  getPaginationInput(): DataGridPaginationInput
  setPaginationInput(value: DataGridPaginationInput): void
  getPagination(): ReturnType<ClientRowViewStateRuntime<T>["getPagination"]>
  setPagination(value: ReturnType<ClientRowViewStateRuntime<T>["getPagination"]>): void
  getViewportRange(): DataGridViewportRange
  setViewportRange(value: DataGridViewportRange): void
}

export interface CreateClientRowModelAccessorBootstrapOptions<T> {
  sourceStateRuntime: ClientRowSourceStateRuntime<T>
  runtimeStateStore: DataGridClientRowRuntimeStateStore<T>
  viewStateRuntime: ClientRowViewStateRuntime<T>
}

export function createClientRowModelAccessorBootstrap<T>(
  options: CreateClientRowModelAccessorBootstrapOptions<T>,
): ClientRowModelAccessorBootstrapResult<T> {
  const { sourceStateRuntime, runtimeStateStore, viewStateRuntime } = options

  return {
    runtimeState: runtimeStateStore.state,
    getBaseSourceRows: () => sourceStateRuntime.getBaseSourceRows(),
    setBaseSourceRows: rows => {
      sourceStateRuntime.setBaseSourceRows(rows)
    },
    getSourceRowsState: () => sourceStateRuntime.getSourceRows(),
    setSourceRowsState: rows => {
      sourceStateRuntime.setSourceRows(rows)
    },
    resetSourceRowsToBase: () => {
      sourceStateRuntime.resetSourceRowsToBase()
    },
    clearSourceRowsState: () => {
      sourceStateRuntime.clearSourceRows()
    },
    getSourceRowIndexById: () => sourceStateRuntime.getSourceRowIndexById(),
    setSourceRowIndexById: index => {
      sourceStateRuntime.setSourceRowIndexById(index)
    },
    getSortModel: () => viewStateRuntime.getSortModel(),
    setSortModel: value => {
      viewStateRuntime.setSortModel(value)
    },
    getFilterModel: () => viewStateRuntime.getFilterModel(),
    setFilterModel: value => {
      viewStateRuntime.setFilterModel(value)
    },
    getGroupBy: () => viewStateRuntime.getGroupBy(),
    setGroupBy: value => {
      viewStateRuntime.setGroupBy(value)
    },
    getPivotModel: () => viewStateRuntime.getPivotModel(),
    setPivotModel: value => {
      viewStateRuntime.setPivotModel(value)
    },
    getPivotColumns: () => viewStateRuntime.getPivotColumns(),
    setPivotColumns: value => {
      viewStateRuntime.setPivotColumns(value)
    },
    resetPivotColumns: () => {
      viewStateRuntime.resetPivotColumns()
    },
    getAggregationModel: () => viewStateRuntime.getAggregationModel(),
    setAggregationModel: value => {
      viewStateRuntime.setAggregationModel(value)
    },
    getPaginationInput: () => viewStateRuntime.getPaginationInput(),
    setPaginationInput: value => {
      viewStateRuntime.setPaginationInput(value)
    },
    getPagination: () => viewStateRuntime.getPagination(),
    setPagination: value => {
      viewStateRuntime.setPagination(value)
    },
    getViewportRange: () => viewStateRuntime.getViewportRange(),
    setViewportRange: value => {
      viewStateRuntime.setViewportRange(value)
    },
  }
}
