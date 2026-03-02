import type {
  DataGridAggregationModel,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridRowModel,
  DataGridSortAndFilterModelInput,
  DataGridSortState,
  DataGridViewportRange,
} from "../models"
import {
  assertPatchCapability,
  type DataGridPatchCapability,
  type DataGridSortFilterBatchCapability,
} from "./gridApiCapabilities"

export interface DataGridRowsRefreshOptions {
  reset?: boolean
}

export interface DataGridRowsApplyEditsOptions {
  emit?: boolean
  reapply?: boolean
}

export interface DataGridApiRowsMethods<TRow = unknown> {
  getRowModelSnapshot: () => ReturnType<DataGridRowModel<TRow>["getSnapshot"]>
  getRowCount: () => number
  getRow: (index: number) => ReturnType<DataGridRowModel<TRow>["getRow"]>
  getRowsInRange: (range: DataGridViewportRange) => ReturnType<DataGridRowModel<TRow>["getRowsInRange"]>
  getPaginationSnapshot: () => ReturnType<DataGridRowModel<TRow>["getSnapshot"]>["pagination"]
  setPagination: (pagination: DataGridPaginationInput | null) => void
  setPageSize: (pageSize: number | null) => void
  setCurrentPage: (page: number) => void
  setSortModel: (sortModel: readonly DataGridSortState[]) => void
  setFilterModel: (filterModel: DataGridFilterSnapshot | null) => void
  setSortAndFilterModel: (input: DataGridSortAndFilterModelInput) => void
  setGroupBy: (groupBy: DataGridGroupBySpec | null) => void
  setAggregationModel: (aggregationModel: DataGridAggregationModel<TRow> | null) => void
  getAggregationModel: () => DataGridAggregationModel<TRow> | null
  setGroupExpansion: (expansion: DataGridGroupExpansionSnapshot | null) => void
  toggleGroup: (groupKey: string) => void
  expandGroup: (groupKey: string) => void
  collapseGroup: (groupKey: string) => void
  expandAllGroups: () => void
  collapseAllGroups: () => void
  refresh: (options?: DataGridRowsRefreshOptions) => ReturnType<DataGridRowModel<TRow>["refresh"]>
  reapplyView: () => ReturnType<DataGridRowModel<TRow>["refresh"]>
  hasPatchSupport: () => boolean
  patchRows: (
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ) => void
  applyEdits: (
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridRowsApplyEditsOptions,
  ) => void
  setAutoReapply: (value: boolean) => void
  getAutoReapply: () => boolean
}

export interface CreateDataGridApiRowsMethodsInput<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  getPatchCapability: () => DataGridPatchCapability<TRow> | null
  getSortFilterBatchCapability: () => DataGridSortFilterBatchCapability | null
}

export function createDataGridApiRowsMethods<TRow = unknown>(
  input: CreateDataGridApiRowsMethodsInput<TRow>,
): DataGridApiRowsMethods<TRow> {
  const { rowModel, getPatchCapability, getSortFilterBatchCapability } = input
  let autoReapply = false

  return {
    getRowModelSnapshot() {
      return rowModel.getSnapshot()
    },
    getRowCount() {
      return rowModel.getRowCount()
    },
    getRow(index: number) {
      return rowModel.getRow(index)
    },
    getRowsInRange(range: DataGridViewportRange) {
      return rowModel.getRowsInRange(range)
    },
    getPaginationSnapshot() {
      return rowModel.getSnapshot().pagination
    },
    setPagination(pagination: DataGridPaginationInput | null) {
      rowModel.setPagination(pagination)
    },
    setPageSize(pageSize: number | null) {
      rowModel.setPageSize(pageSize)
    },
    setCurrentPage(page: number) {
      rowModel.setCurrentPage(page)
    },
    setSortModel(sortModel: readonly DataGridSortState[]) {
      rowModel.setSortModel(sortModel)
    },
    setFilterModel(filterModel: DataGridFilterSnapshot | null) {
      rowModel.setFilterModel(filterModel)
    },
    setSortAndFilterModel(input: DataGridSortAndFilterModelInput) {
      const capability = getSortFilterBatchCapability()
      if (capability) {
        capability.setSortAndFilterModel(input)
        return
      }
      rowModel.setFilterModel(input.filterModel)
      rowModel.setSortModel(input.sortModel)
    },
    setGroupBy(groupBy: DataGridGroupBySpec | null) {
      rowModel.setGroupBy(groupBy)
    },
    setAggregationModel(aggregationModel: DataGridAggregationModel<TRow> | null) {
      rowModel.setAggregationModel(aggregationModel)
    },
    getAggregationModel() {
      return rowModel.getAggregationModel()
    },
    setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null) {
      rowModel.setGroupExpansion(expansion)
    },
    toggleGroup(groupKey: string) {
      rowModel.toggleGroup(groupKey)
    },
    expandGroup(groupKey: string) {
      rowModel.expandGroup(groupKey)
    },
    collapseGroup(groupKey: string) {
      rowModel.collapseGroup(groupKey)
    },
    expandAllGroups() {
      rowModel.expandAllGroups()
    },
    collapseAllGroups() {
      rowModel.collapseAllGroups()
    },
    refresh(options?: DataGridRowsRefreshOptions) {
      return rowModel.refresh(options?.reset ? "reset" : undefined)
    },
    reapplyView() {
      return rowModel.refresh("reapply")
    },
    hasPatchSupport() {
      return getPatchCapability() !== null
    },
    patchRows(
      updates: readonly DataGridClientRowPatch<TRow>[],
      options?: DataGridClientRowPatchOptions,
    ) {
      const capability = assertPatchCapability(getPatchCapability())
      capability.patchRows(updates, options)
    },
    applyEdits(
      updates: readonly DataGridClientRowPatch<TRow>[],
      options?: DataGridRowsApplyEditsOptions,
    ) {
      const capability = assertPatchCapability(getPatchCapability())
      const shouldReapply = typeof options?.reapply === "boolean"
        ? options.reapply
        : autoReapply
      capability.patchRows(updates, {
        recomputeSort: shouldReapply,
        recomputeFilter: shouldReapply,
        recomputeGroup: shouldReapply,
        emit: options?.emit,
      })
    },
    setAutoReapply(value: boolean) {
      autoReapply = Boolean(value)
    },
    getAutoReapply() {
      return autoReapply
    },
  }
}
