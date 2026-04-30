import type {
  DataGridAggregationModel,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridComputedFieldComputeContext,
  DataGridComputedFieldDefinition,
  DataGridComputedFieldSnapshot,
  DataGridFormulaContextRecomputeRequest,
  DataGridFormulaFieldDefinition,
  DataGridFormulaFieldSnapshot,
  DataGridFormulaFunctionDefinition,
  DataGridFormulaValue,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridRowId,
  DataGridRowModel,
  DataGridRowNodeInput,
  DataGridSortAndFilterModelInput,
  DataGridSortState,
  DataGridViewportRange,
} from "../models/index.js"
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
  signal?: AbortSignal | null
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
  hasInsertSupport: () => boolean
  setData: (rows: readonly DataGridRowNodeInput<TRow>[]) => void
  replaceData: (rows: readonly DataGridRowNodeInput<TRow>[]) => void
  appendData: (rows: readonly DataGridRowNodeInput<TRow>[]) => void
  prependData: (rows: readonly DataGridRowNodeInput<TRow>[]) => void
  insertDataAt: (index: number, rows: readonly DataGridRowNodeInput<TRow>[]) => boolean
  insertDataBefore: (rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<TRow>[]) => boolean
  insertDataAfter: (rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<TRow>[]) => boolean
  hasPatchSupport: () => boolean
  hasComputedSupport: () => boolean
  registerComputedField: (definition: DataGridComputedFieldDefinition<TRow>) => void
  getComputedFields: () => readonly DataGridComputedFieldSnapshot[]
  recomputeComputedFields: (rowIds?: readonly DataGridRowId[]) => number
  hasFormulaSupport: () => boolean
  registerFormulaField: (definition: DataGridFormulaFieldDefinition) => void
  getFormulaFields: () => readonly DataGridFormulaFieldSnapshot[]
  recomputeFormulaContext: (request: DataGridFormulaContextRecomputeRequest) => number
  hasFormulaFunctionRegistrySupport: () => boolean
  registerFormulaFunction: (
    name: string,
    definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[], context?: DataGridComputedFieldComputeContext<unknown>) => unknown),
  ) => void
  unregisterFormulaFunction: (name: string) => boolean
  getFormulaFunctionNames: () => readonly string[]
  patchRows: (
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ) => void | Promise<void>
  applyEdits: (
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridRowsApplyEditsOptions,
  ) => void | Promise<void>
  setAutoReapply: (value: boolean) => void
  getAutoReapply: () => boolean
  batch: <TResult>(fn: () => TResult) => TResult
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

  const assertNotAborted = (signal: AbortSignal | null | undefined, operation: string): void => {
    if (signal?.aborted) {
      const error = new Error(`[DataGridApi] ${operation} aborted.`)
      error.name = "AbortError"
      throw error
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
    hasInsertSupport() {
      const capability = getRowsDataMutationCapability()
      return typeof capability?.insertRowsAt === "function"
        && typeof capability?.insertRowsBefore === "function"
        && typeof capability?.insertRowsAfter === "function"
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
    insertDataAt(index: number, rows: readonly DataGridRowNodeInput<TRow>[]) {
      assertMutationsAllowed("insert rows")
      const capability = getRowsDataMutationCapability()
      if (typeof capability?.insertRowsAt !== "function") {
        throw new Error('[DataGridApi] rowModel does not implement insertRowsAt data mutation capability.')
      }
      return capability.insertRowsAt(index, rows)
    },
    insertDataBefore(rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<TRow>[]) {
      assertMutationsAllowed("insert rows before")
      const capability = getRowsDataMutationCapability()
      if (typeof capability?.insertRowsBefore !== "function") {
        throw new Error('[DataGridApi] rowModel does not implement insertRowsBefore data mutation capability.')
      }
      return capability.insertRowsBefore(rowId, rows)
    },
    insertDataAfter(rowId: DataGridRowId, rows: readonly DataGridRowNodeInput<TRow>[]) {
      assertMutationsAllowed("insert rows after")
      const capability = getRowsDataMutationCapability()
      if (typeof capability?.insertRowsAfter !== "function") {
        throw new Error('[DataGridApi] rowModel does not implement insertRowsAfter data mutation capability.')
      }
      return capability.insertRowsAfter(rowId, rows)
    },
    hasPatchSupport() {
      return getPatchCapability() !== null
    },
    hasComputedSupport() {
      return typeof rowModel.registerComputedField === "function"
    },
    hasFormulaSupport() {
      return typeof rowModel.registerFormulaField === "function"
    },
    hasFormulaFunctionRegistrySupport() {
      return typeof rowModel.registerFormulaFunction === "function"
        && typeof rowModel.unregisterFormulaFunction === "function"
        && typeof rowModel.getFormulaFunctionNames === "function"
    },
    registerComputedField(definition: DataGridComputedFieldDefinition<TRow>) {
      assertMutationsAllowed("register computed field")
      if (typeof rowModel.registerComputedField !== "function") {
        throw new Error("[DataGridApi] rowModel does not implement computed field capability.")
      }
      rowModel.registerComputedField(definition)
    },
    registerFormulaField(definition: DataGridFormulaFieldDefinition) {
      assertMutationsAllowed("register formula field")
      if (typeof rowModel.registerFormulaField !== "function") {
        throw new Error("[DataGridApi] rowModel does not implement formula field capability.")
      }
      rowModel.registerFormulaField(definition)
    },
    getComputedFields() {
      if (typeof rowModel.getComputedFields !== "function") {
        return []
      }
      return rowModel.getComputedFields()
    },
    getFormulaFields() {
      if (typeof rowModel.getFormulaFields !== "function") {
        return []
      }
      return rowModel.getFormulaFields()
    },
    recomputeFormulaContext(request: DataGridFormulaContextRecomputeRequest) {
      assertMutationsAllowed("recompute formula context")
      if (typeof rowModel.recomputeFormulaContext !== "function") {
        throw new Error("[DataGridApi] rowModel does not implement formula field capability.")
      }
      return rowModel.recomputeFormulaContext(request)
    },
    registerFormulaFunction(
      name: string,
      definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[], context?: DataGridComputedFieldComputeContext<unknown>) => unknown),
    ) {
      assertMutationsAllowed("register formula function")
      if (typeof rowModel.registerFormulaFunction !== "function") {
        throw new Error("[DataGridApi] rowModel does not implement formula function registry capability.")
      }
      rowModel.registerFormulaFunction(name, definition)
    },
    unregisterFormulaFunction(name: string) {
      assertMutationsAllowed("unregister formula function")
      if (typeof rowModel.unregisterFormulaFunction !== "function") {
        throw new Error("[DataGridApi] rowModel does not implement formula function registry capability.")
      }
      return rowModel.unregisterFormulaFunction(name)
    },
    getFormulaFunctionNames() {
      if (typeof rowModel.getFormulaFunctionNames !== "function") {
        return []
      }
      return rowModel.getFormulaFunctionNames()
    },
    recomputeComputedFields(rowIds?: readonly DataGridRowId[]) {
      assertMutationsAllowed("recompute computed fields")
      if (typeof rowModel.recomputeComputedFields !== "function") {
        throw new Error("[DataGridApi] rowModel does not implement computed field capability.")
      }
      return rowModel.recomputeComputedFields(rowIds)
    },
    patchRows(
      updates: readonly DataGridClientRowPatch<TRow>[],
      options?: DataGridClientRowPatchOptions,
    ) {
      assertMutationsAllowed("patch rows")
      assertNotAborted(options?.signal, "rows.patch")
      const capability = assertPatchCapability(getPatchCapability())
      return capability.patchRows(updates, options)
    },
    applyEdits(
      updates: readonly DataGridClientRowPatch<TRow>[],
      options?: DataGridRowsApplyEditsOptions,
    ) {
      assertMutationsAllowed("apply edits")
      assertNotAborted(options?.signal, "rows.applyEdits")
      const capability = assertPatchCapability(getPatchCapability())
      const shouldReapply = typeof options?.reapply === "boolean"
        ? options.reapply
        : autoReapply
      return capability.patchRows(updates, {
        recomputeSort: shouldReapply,
        recomputeFilter: shouldReapply,
        recomputeGroup: shouldReapply,
        emit: options?.emit,
        signal: options?.signal,
      })
    },
    setAutoReapply(value: boolean) {
      autoReapply = Boolean(value)
    },
    getAutoReapply() {
      return autoReapply
    },
    batch<TResult>(fn: () => TResult): TResult {
      return fn()
    },
  }
}
