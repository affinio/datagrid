import type {
  DataGridAggregationModel,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridPaginationInput,
  DataGridPaginationSnapshot,
  DataGridSortState,
  DataGridViewportRange,
} from "../rowModel.js"
import type { DataGridPivotColumn, DataGridPivotSpec } from "@affino/datagrid-pivot"

export interface CreateClientRowViewStateRuntimeOptions<T> {
  sortModel: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
  groupBy: DataGridGroupBySpec | null
  pivotModel: DataGridPivotSpec | null
  pivotColumns: DataGridPivotColumn[]
  aggregationModel: DataGridAggregationModel<T> | null
  paginationInput: DataGridPaginationInput
  pagination: DataGridPaginationSnapshot
  viewportRange: DataGridViewportRange
}

export interface ClientRowViewStateRuntime<T> {
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
  getPagination(): DataGridPaginationSnapshot
  setPagination(value: DataGridPaginationSnapshot): void
  getViewportRange(): DataGridViewportRange
  setViewportRange(value: DataGridViewportRange): void
}

export function createClientRowViewStateRuntime<T>(
  options: CreateClientRowViewStateRuntimeOptions<T>,
): ClientRowViewStateRuntime<T> {
  let sortModel = options.sortModel
  let filterModel = options.filterModel
  let groupBy = options.groupBy
  let pivotModel = options.pivotModel
  let pivotColumns = options.pivotColumns
  let aggregationModel = options.aggregationModel
  let paginationInput = options.paginationInput
  let pagination = options.pagination
  let viewportRange = options.viewportRange

  return {
    getSortModel() {
      return sortModel
    },
    setSortModel(value) {
      sortModel = value
    },
    getFilterModel() {
      return filterModel
    },
    setFilterModel(value) {
      filterModel = value
    },
    getGroupBy() {
      return groupBy
    },
    setGroupBy(value) {
      groupBy = value
    },
    getPivotModel() {
      return pivotModel
    },
    setPivotModel(value) {
      pivotModel = value
    },
    getPivotColumns() {
      return pivotColumns
    },
    setPivotColumns(value) {
      pivotColumns = value
    },
    resetPivotColumns() {
      pivotColumns = []
    },
    getAggregationModel() {
      return aggregationModel
    },
    setAggregationModel(value) {
      aggregationModel = value
    },
    getPaginationInput() {
      return paginationInput
    },
    setPaginationInput(value) {
      paginationInput = value
    },
    getPagination() {
      return pagination
    },
    setPagination(value) {
      pagination = value
    },
    getViewportRange() {
      return viewportRange
    },
    setViewportRange(value) {
      viewportRange = value
    },
  }
}
