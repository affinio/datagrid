import {
  isSameGroupBySpec,
  isSamePivotSpec,
  normalizeGroupBySpec,
  normalizePaginationInput,
  normalizePivotSpec,
  normalizeViewportRange,
  setGroupExpansionKey,
  toggleGroupExpansionKey,
  type DataGridAggregationModel,
  type DataGridFilterSnapshot,
  type DataGridGroupBySpec,
  type DataGridGroupExpansionSnapshot,
  type DataGridPaginationInput,
  type DataGridPivotSpec,
  type DataGridSortAndFilterModelInput,
  type DataGridSortState,
  type DataGridViewportRange,
} from "./rowModel.js"
import { isSameFilterModel, isSameSortModel } from "./clientRowProjectionPrimitives.js"
import { cloneAggregationModel, isSameAggregationModel } from "./clientRowModelHelpers.js"
import type { DataGridClientProjectionStage } from "./clientRowProjectionEngine.js"
import type { ClientRowExpansionStateStore } from "./clientRowExpansionRuntime.js"

export interface ClientRowStateMutationsRuntimeContext<T> {
  ensureActive: () => void
  emit: () => void
  recomputeFromStage: (stage: DataGridClientProjectionStage) => void
  bumpSortRevision: () => void
  bumpFilterRevision: () => void
  bumpGroupRevision: () => void

  getRuntimeRowCount: () => number
  getViewportRange: () => DataGridViewportRange
  setViewportRange: (range: DataGridViewportRange) => void

  getPaginationInput: () => DataGridPaginationInput
  setPaginationInput: (pagination: DataGridPaginationInput) => void

  getSortModel: () => readonly DataGridSortState[]
  setSortModel: (sortModel: readonly DataGridSortState[]) => void
  cloneSortModel: (input: readonly DataGridSortState[]) => readonly DataGridSortState[]

  getFilterModel: () => DataGridFilterSnapshot | null
  setFilterModel: (filterModel: DataGridFilterSnapshot | null) => void
  cloneFilterModel: (input: DataGridFilterSnapshot | null) => DataGridFilterSnapshot | null

  isTreeDataEnabled: () => boolean
  getGroupBy: () => DataGridGroupBySpec | null
  setGroupBy: (groupBy: DataGridGroupBySpec | null) => void
  setExpansionExpandedByDefault: (value: boolean) => void
  clearToggledGroupKeys: () => void

  getPivotModel: () => DataGridPivotSpec | null
  setPivotModel: (pivotModel: DataGridPivotSpec | null) => void
  resetPivotColumns: () => void
  setPivotExpansionExpandedByDefault: (value: boolean) => void
  clearToggledPivotGroupKeys: () => void

  getAggregationModel: () => DataGridAggregationModel<T> | null
  setAggregationModel: (aggregationModel: DataGridAggregationModel<T> | null) => void
  invalidateTreeProjectionCaches: () => void

  applyGroupExpansion: (nextExpansion: DataGridGroupExpansionSnapshot | null) => boolean
  getExpansionSpec: () => DataGridGroupBySpec | null
  getActiveExpansionStateStore: () => ClientRowExpansionStateStore
}

export interface ClientRowStateMutationsRuntime<T> {
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

export function createClientRowStateMutationsRuntime<T>(
  context: ClientRowStateMutationsRuntimeContext<T>,
): ClientRowStateMutationsRuntime<T> {
  return {
    setViewportRange(range: DataGridViewportRange) {
      context.ensureActive()
      const nextRange = normalizeViewportRange(range, context.getRuntimeRowCount())
      const currentRange = context.getViewportRange()
      if (nextRange.start === currentRange.start && nextRange.end === currentRange.end) {
        return
      }
      context.setViewportRange(nextRange)
      context.emit()
    },
    setPagination(nextPagination: DataGridPaginationInput | null) {
      context.ensureActive()
      const normalized = normalizePaginationInput(nextPagination)
      const current = context.getPaginationInput()
      if (
        normalized.pageSize === current.pageSize &&
        normalized.currentPage === current.currentPage
      ) {
        return
      }
      context.setPaginationInput(normalized)
      context.recomputeFromStage("paginate")
      context.emit()
    },
    setPageSize(pageSize: number | null) {
      context.ensureActive()
      const normalizedPageSize = normalizePaginationInput({ pageSize: pageSize ?? 0, currentPage: 0 }).pageSize
      const current = context.getPaginationInput()
      if (normalizedPageSize === current.pageSize) {
        return
      }
      context.setPaginationInput({
        pageSize: normalizedPageSize,
        currentPage: 0,
      })
      context.recomputeFromStage("paginate")
      context.emit()
    },
    setCurrentPage(page: number) {
      context.ensureActive()
      const current = context.getPaginationInput()
      const normalizedPage = normalizePaginationInput({ pageSize: current.pageSize, currentPage: page }).currentPage
      if (normalizedPage === current.currentPage) {
        return
      }
      context.setPaginationInput({
        ...current,
        currentPage: normalizedPage,
      })
      context.recomputeFromStage("paginate")
      context.emit()
    },
    setSortModel(nextSortModel: readonly DataGridSortState[]) {
      context.ensureActive()
      const normalizedSortModel = Array.isArray(nextSortModel) ? context.cloneSortModel(nextSortModel) : []
      const currentSortModel = context.getSortModel()
      if (isSameSortModel(currentSortModel, normalizedSortModel)) {
        return
      }
      context.setSortModel(normalizedSortModel)
      context.bumpSortRevision()
      context.recomputeFromStage("sort")
      context.emit()
    },
    setFilterModel(nextFilterModel: DataGridFilterSnapshot | null) {
      context.ensureActive()
      const normalizedFilterModel = context.cloneFilterModel(nextFilterModel ?? null)
      const currentFilterModel = context.getFilterModel()
      if (isSameFilterModel(currentFilterModel, normalizedFilterModel)) {
        return
      }
      context.setFilterModel(normalizedFilterModel)
      context.bumpFilterRevision()
      context.recomputeFromStage("filter")
      context.emit()
    },
    setSortAndFilterModel(input: DataGridSortAndFilterModelInput) {
      context.ensureActive()
      const normalizedSortModel = Array.isArray(input?.sortModel) ? context.cloneSortModel(input.sortModel) : []
      const normalizedFilterModel = context.cloneFilterModel(input?.filterModel ?? null)
      const currentSortModel = context.getSortModel()
      const currentFilterModel = context.getFilterModel()
      const sortChanged = !isSameSortModel(currentSortModel, normalizedSortModel)
      const filterChanged = !isSameFilterModel(currentFilterModel, normalizedFilterModel)
      if (!sortChanged && !filterChanged) {
        return
      }
      context.setSortModel(normalizedSortModel)
      context.setFilterModel(normalizedFilterModel)
      if (filterChanged) {
        context.bumpFilterRevision()
      }
      if (sortChanged) {
        context.bumpSortRevision()
      }
      context.recomputeFromStage(filterChanged ? "filter" : "sort")
      context.emit()
    },
    setGroupBy(nextGroupBy: DataGridGroupBySpec | null) {
      context.ensureActive()
      if (context.isTreeDataEnabled()) {
        return
      }
      const normalized = normalizeGroupBySpec(nextGroupBy)
      const currentGroupBy = context.getGroupBy()
      if (isSameGroupBySpec(currentGroupBy, normalized)) {
        return
      }
      context.setGroupBy(normalized)
      context.setExpansionExpandedByDefault(Boolean(normalized?.expandedByDefault))
      context.clearToggledGroupKeys()
      context.bumpGroupRevision()
      context.recomputeFromStage("group")
      context.emit()
    },
    setPivotModel(nextPivotModel: DataGridPivotSpec | null) {
      context.ensureActive()
      const normalized = normalizePivotSpec(nextPivotModel)
      const currentPivotModel = context.getPivotModel()
      if (isSamePivotSpec(currentPivotModel, normalized)) {
        return
      }
      context.setPivotModel(normalized)
      context.resetPivotColumns()
      context.setPivotExpansionExpandedByDefault(true)
      context.clearToggledPivotGroupKeys()
      context.bumpGroupRevision()
      context.recomputeFromStage("pivot")
      context.emit()
    },
    setAggregationModel(nextAggregationModel: DataGridAggregationModel<T> | null) {
      context.ensureActive()
      const normalized = cloneAggregationModel(nextAggregationModel ?? null)
      const currentAggregationModel = context.getAggregationModel()
      if (isSameAggregationModel(currentAggregationModel, normalized)) {
        return
      }
      context.setAggregationModel(normalized)
      if (context.isTreeDataEnabled()) {
        context.invalidateTreeProjectionCaches()
        context.recomputeFromStage("group")
      } else {
        context.recomputeFromStage("aggregate")
      }
      context.emit()
    },
    setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null) {
      context.ensureActive()
      if (!context.applyGroupExpansion(expansion)) {
        return
      }
      context.bumpGroupRevision()
      context.recomputeFromStage("group")
      context.emit()
    },
    toggleGroup(groupKey: string) {
      context.ensureActive()
      const expansionSpec = context.getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      const expansionState = context.getActiveExpansionStateStore()
      if (!toggleGroupExpansionKey(expansionState.toggledKeys, groupKey)) {
        return
      }
      context.bumpGroupRevision()
      context.recomputeFromStage("group")
      context.emit()
    },
    expandGroup(groupKey: string) {
      context.ensureActive()
      const expansionSpec = context.getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      const expansionState = context.getActiveExpansionStateStore()
      if (!setGroupExpansionKey(expansionState.toggledKeys, groupKey, expansionState.expandedByDefault, true)) {
        return
      }
      context.bumpGroupRevision()
      context.recomputeFromStage("group")
      context.emit()
    },
    collapseGroup(groupKey: string) {
      context.ensureActive()
      const expansionSpec = context.getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      const expansionState = context.getActiveExpansionStateStore()
      if (!setGroupExpansionKey(expansionState.toggledKeys, groupKey, expansionState.expandedByDefault, false)) {
        return
      }
      context.bumpGroupRevision()
      context.recomputeFromStage("group")
      context.emit()
    },
    expandAllGroups() {
      context.ensureActive()
      const expansionSpec = context.getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      const expansionState = context.getActiveExpansionStateStore()
      if (expansionState.expandedByDefault && expansionState.toggledKeys.size === 0) {
        return
      }
      expansionState.setExpandedByDefault(true)
      expansionState.toggledKeys.clear()
      context.bumpGroupRevision()
      context.recomputeFromStage("group")
      context.emit()
    },
    collapseAllGroups() {
      context.ensureActive()
      const expansionSpec = context.getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      const expansionState = context.getActiveExpansionStateStore()
      if (!expansionState.expandedByDefault && expansionState.toggledKeys.size === 0) {
        return
      }
      expansionState.setExpandedByDefault(false)
      expansionState.toggledKeys.clear()
      context.bumpGroupRevision()
      context.recomputeFromStage("group")
      context.emit()
    },
  }
}
