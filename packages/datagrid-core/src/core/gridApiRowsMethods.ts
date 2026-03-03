import type {
  DataGridAggregationModel,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridRowModel,
  DataGridRowNodeInput,
  DataGridSortAndFilterModelInput,
  DataGridSortState,
  DataGridViewportRange,
} from "../models"
import {
  assertPatchCapability,
  assertRowsDataMutationCapability,
  type DataGridPatchCapability,
  type DataGridRowsDataMutationCapability,
  type DataGridSortFilterBatchCapability,
} from "./gridApiCapabilities"

type DataGridApiProjectionMode = "mutable" | "immutable" | "excel-like"

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
  hasDataMutationSupport: () => boolean
  setData: (rows: readonly DataGridRowNodeInput<TRow>[]) => void
  replaceData: (rows: readonly DataGridRowNodeInput<TRow>[]) => void
  appendData: (rows: readonly DataGridRowNodeInput<TRow>[]) => void
  prependData: (rows: readonly DataGridRowNodeInput<TRow>[]) => void
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
  getRowsDataMutationCapability: () => DataGridRowsDataMutationCapability<TRow> | null
  getSortFilterBatchCapability: () => DataGridSortFilterBatchCapability | null
  getProjectionMode?: () => DataGridApiProjectionMode
}

export function createDataGridApiRowsMethods<TRow = unknown>(
  input: CreateDataGridApiRowsMethodsInput<TRow>,
): DataGridApiRowsMethods<TRow> {
  const {
    rowModel,
    getPatchCapability,
    getRowsDataMutationCapability,
    getSortFilterBatchCapability,
    getProjectionMode,
  } = input
  let autoReapply = false

  const assertMutationsAllowed = (operation: string): void => {
    if (getProjectionMode?.() === "immutable") {
      throw new Error(`[DataGridApi] cannot ${operation} when projection mode is "immutable".`)
    }
  }

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
    hasDataMutationSupport() {
      return getRowsDataMutationCapability() !== null
    },
    setData(rows: readonly DataGridRowNodeInput<TRow>[]) {
      assertMutationsAllowed("set rows")
      const capability = assertRowsDataMutationCapability(getRowsDataMutationCapability())
      capability.setRows(rows)
    },
    replaceData(rows: readonly DataGridRowNodeInput<TRow>[]) {
      assertMutationsAllowed("replace rows")
      const capability = assertRowsDataMutationCapability(getRowsDataMutationCapability())
      if (typeof capability.replaceRows === "function") {
        capability.replaceRows(rows)
        return
      }
      capability.setRows(rows)
    },
    appendData(rows: readonly DataGridRowNodeInput<TRow>[]) {
      assertMutationsAllowed("append rows")
      const capability = assertRowsDataMutationCapability(getRowsDataMutationCapability())
      if (typeof capability.appendRows !== "function") {
        throw new Error('[DataGridApi] rowModel does not implement appendRows data mutation capability.')
      }
      capability.appendRows(rows)
    },
    prependData(rows: readonly DataGridRowNodeInput<TRow>[]) {
      assertMutationsAllowed("prepend rows")
      const capability = assertRowsDataMutationCapability(getRowsDataMutationCapability())
      if (typeof capability.prependRows !== "function") {
        throw new Error('[DataGridApi] rowModel does not implement prependRows data mutation capability.')
      }
      capability.prependRows(rows)
    },
    hasPatchSupport() {
      return getPatchCapability() !== null
    },
    patchRows(
      updates: readonly DataGridClientRowPatch<TRow>[],
      options?: DataGridClientRowPatchOptions,
    ) {
      assertMutationsAllowed("patch rows")
      const capability = assertPatchCapability(getPatchCapability())
      capability.patchRows(updates, options)
    },
    applyEdits(
      updates: readonly DataGridClientRowPatch<TRow>[],
      options?: DataGridRowsApplyEditsOptions,
    ) {
      assertMutationsAllowed("apply edits")
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
