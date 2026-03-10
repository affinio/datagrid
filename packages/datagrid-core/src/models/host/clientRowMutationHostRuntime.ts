import {
  createClientRowRowsMutationsRuntime,
  type ClientRowRowsMutationsRuntime,
  type ClientRowRowsMutationsRuntimeContext,
  type ClientRowRowsMutationsRuntimeReorderInput,
} from "../mutation/clientRowRowsMutationsRuntime.js"
import {
  createClientRowStateMutationsRuntime,
  type ClientRowStateMutationsRuntime,
  type ClientRowStateMutationsRuntimeContext,
} from "../mutation/clientRowStateMutationsRuntime.js"
import type {
  DataGridAggregationModel,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridPivotSpec,
  DataGridRowId,
  DataGridRowNodeInput,
  DataGridSortAndFilterModelInput,
  DataGridSortState,
  DataGridViewportRange,
} from "../rowModel.js"

export interface CreateClientRowMutationHostRuntimeOptions<T> {
  stateMutationsContext: ClientRowStateMutationsRuntimeContext<T>
  rowsMutationsContext: ClientRowRowsMutationsRuntimeContext<T>
}

export interface ClientRowMutationHostRuntime<T> {
  setRows: (nextRows: readonly DataGridRowNodeInput<T>[]) => void
  reorderRows: (input: ClientRowRowsMutationsRuntimeReorderInput) => boolean
  insertRowsAt: (index: number, rows: readonly DataGridRowNodeInput<T>[]) => boolean
  insertRowsBefore: (rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]) => boolean
  insertRowsAfter: (rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<T>[]) => boolean
  setViewportRange: (range: DataGridViewportRange) => void
  setPagination: (nextPagination: DataGridPaginationInput | null) => void
  setPageSize: (pageSize: number | null) => void
  setCurrentPage: (page: number) => void
  setSortModel: (nextSortModel: readonly DataGridSortState[]) => void
  setFilterModel: (nextFilterModel: DataGridFilterSnapshot | null) => void
  setSortAndFilterModel: (input: DataGridSortAndFilterModelInput) => void
  setGroupBy: (nextGroupBy: DataGridGroupBySpec | null) => void
  setPivotModel: (nextPivotModel: DataGridPivotSpec | null) => void
  setAggregationModel: (nextAggregationModel: DataGridAggregationModel<T> | null) => void
  setGroupExpansion: (expansion: DataGridGroupExpansionSnapshot | null) => void
  toggleGroup: (groupKey: string) => void
  expandGroup: (groupKey: string) => void
  collapseGroup: (groupKey: string) => void
  expandAllGroups: () => void
  collapseAllGroups: () => void
}

export function createClientRowMutationHostRuntime<T>(
  options: CreateClientRowMutationHostRuntimeOptions<T>,
): ClientRowMutationHostRuntime<T> {
  const stateMutationsRuntime: ClientRowStateMutationsRuntime<T> =
    createClientRowStateMutationsRuntime(options.stateMutationsContext)
  const rowsMutationsRuntime: ClientRowRowsMutationsRuntime<T> =
    createClientRowRowsMutationsRuntime(options.rowsMutationsContext)

  return {
    setRows: (nextRows) => rowsMutationsRuntime.setRows(nextRows),
    reorderRows: (input) => rowsMutationsRuntime.reorderRows(input),
    insertRowsAt: (index, rows) => rowsMutationsRuntime.insertRowsAt(index, rows),
    insertRowsBefore: (rowId, rows) => rowsMutationsRuntime.insertRowsBefore(rowId, rows),
    insertRowsAfter: (rowId, rows) => rowsMutationsRuntime.insertRowsAfter(rowId, rows),
    setViewportRange: (range) => stateMutationsRuntime.setViewportRange(range),
    setPagination: (nextPagination) => stateMutationsRuntime.setPagination(nextPagination),
    setPageSize: (pageSize) => stateMutationsRuntime.setPageSize(pageSize),
    setCurrentPage: (page) => stateMutationsRuntime.setCurrentPage(page),
    setSortModel: (nextSortModel) => stateMutationsRuntime.setSortModel(nextSortModel),
    setFilterModel: (nextFilterModel) => stateMutationsRuntime.setFilterModel(nextFilterModel),
    setSortAndFilterModel: (input) => stateMutationsRuntime.setSortAndFilterModel(input),
    setGroupBy: (nextGroupBy) => stateMutationsRuntime.setGroupBy(nextGroupBy),
    setPivotModel: (nextPivotModel) => stateMutationsRuntime.setPivotModel(nextPivotModel),
    setAggregationModel: (nextAggregationModel) =>
      stateMutationsRuntime.setAggregationModel(nextAggregationModel),
    setGroupExpansion: (expansion) => stateMutationsRuntime.setGroupExpansion(expansion),
    toggleGroup: (groupKey) => stateMutationsRuntime.toggleGroup(groupKey),
    expandGroup: (groupKey) => stateMutationsRuntime.expandGroup(groupKey),
    collapseGroup: (groupKey) => stateMutationsRuntime.collapseGroup(groupKey),
    expandAllGroups: () => stateMutationsRuntime.expandAllGroups(),
    collapseAllGroups: () => stateMutationsRuntime.collapseAllGroups(),
  }
}
