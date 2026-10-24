import {
  isSameGroupBySpec,
  normalizeGroupBySpec,
  normalizePaginationInput,
  normalizeViewportRange,
  setGroupExpansionKey,
  toggleGroupExpansionKey,
  type DataGridAggregationModel,
  type DataGridFilterSnapshot,
  type DataGridGroupBySpec,
  type DataGridGroupExpansionSnapshot,
  type DataGridPaginationInput,
  type DataGridSortAndFilterModelInput,
  type DataGridSortState,
  type DataGridProjectionInvalidationReason,
  type DataGridViewportRange,
} from "../rowModel.js"
import {
  isSamePivotSpec,
  normalizePivotSpec,
} from "@affino/datagrid-pivot"
import type { DataGridPivotSpec } from "@affino/datagrid-pivot"
import { isSameFilterModel, isSameSortModel } from "../projection/clientRowProjectionPrimitives.js"
import { cloneAggregationModel, isSameAggregationModel } from "../clientRowModelHelpers.js"
import type { DataGridClientProjectionStage } from "../projection/clientRowProjectionEngine.js"
import type { ClientRowExpansionStateStore } from "../clientRowExpansionRuntime.js"

export interface ClientRowStateMutationsRuntimeContext<T> {
  ensureActive: () => void
  emit: () => void
  recomputeFromStage: (stage: DataGridClientProjectionStage) => void
  setProjectionInvalidation: (reasons: readonly DataGridProjectionInvalidationReason[]) => void
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
  const captureExpansionState = () => {
    const store = context.getActiveExpansionStateStore()
    return { store, expandedByDefault: store.expandedByDefault, toggledKeys: [...store.toggledKeys] }
  }
  const restoreExpansionState = (snapshot: ReturnType<typeof captureExpansionState>): void => {
    snapshot.store.setExpandedByDefault(snapshot.expandedByDefault)
    snapshot.store.toggledKeys.clear()
    for (const key of snapshot.toggledKeys) snapshot.store.toggledKeys.add(key)
  }
  const restoreProjectionAndRethrow = (stage: DataGridClientProjectionStage, error: unknown): never => {
    try {
      context.recomputeFromStage(stage)
    } catch (recoveryError) {
      throw Object.assign(new Error("[DataGridProjection] state change failed and previous projection recovery was incomplete."), {
        errors: [error, recoveryError],
      })
    }
    throw error
  }
  const applyExpansionMutation = (mutate: () => boolean): void => {
    const previousExpansion = captureExpansionState()
    if (!mutate()) return
    context.bumpGroupRevision()
    context.setProjectionInvalidation(["groupExpansionChanged"])
    try {
      context.recomputeFromStage("group")
    } catch (error) {
      restoreExpansionState(previousExpansion)
      context.bumpGroupRevision()
      context.setProjectionInvalidation(["groupExpansionChanged"])
      restoreProjectionAndRethrow("group", error)
    }
    context.emit()
  }
  const applyPaginationMutation = (nextPagination: DataGridPaginationInput): void => {
    const current = context.getPaginationInput()
    if (nextPagination.pageSize === current.pageSize && nextPagination.currentPage === current.currentPage) return
    context.setPaginationInput(nextPagination)
    context.setProjectionInvalidation(["paginationChanged"])
    try {
      context.recomputeFromStage("paginate")
    } catch (error) {
      context.setPaginationInput(current)
      context.setProjectionInvalidation(["paginationChanged"])
      restoreProjectionAndRethrow("paginate", error)
    }
    context.emit()
  }
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
      applyPaginationMutation(normalized)
    },
    setPageSize(pageSize: number | null) {
      context.ensureActive()
      const normalizedPageSize = normalizePaginationInput({ pageSize: pageSize ?? 0, currentPage: 0 }).pageSize
      applyPaginationMutation({ pageSize: normalizedPageSize, currentPage: 0 })
    },
    setCurrentPage(page: number) {
      context.ensureActive()
      const current = context.getPaginationInput()
      const normalized = normalizePaginationInput({ pageSize: current.pageSize, currentPage: page })
      applyPaginationMutation(normalized)
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
      context.setProjectionInvalidation(["sortChanged"])
      try {
        context.recomputeFromStage("sort")
      } catch (error) {
        context.setSortModel(currentSortModel)
        context.bumpSortRevision()
        context.setProjectionInvalidation(["sortChanged"])
        restoreProjectionAndRethrow("sort", error)
      }
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
      context.setProjectionInvalidation(["filterChanged"])
      try {
        context.recomputeFromStage("filter")
      } catch (error) {
        context.setFilterModel(currentFilterModel)
        context.bumpFilterRevision()
        context.setProjectionInvalidation(["filterChanged"])
        restoreProjectionAndRethrow("filter", error)
      }
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
      const invalidationReasons: DataGridProjectionInvalidationReason[] = []
      if (filterChanged) {
        invalidationReasons.push("filterChanged")
      }
      if (sortChanged) {
        invalidationReasons.push("sortChanged")
      }
      context.setProjectionInvalidation(invalidationReasons)
      try {
        context.recomputeFromStage(filterChanged ? "filter" : "sort")
      } catch (error) {
        context.setSortModel(currentSortModel)
        context.setFilterModel(currentFilterModel)
        if (filterChanged) context.bumpFilterRevision()
        if (sortChanged) context.bumpSortRevision()
        context.setProjectionInvalidation(invalidationReasons)
        restoreProjectionAndRethrow(filterChanged ? "filter" : "sort", error)
      }
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
      const previousExpansion = captureExpansionState()
      context.setGroupBy(normalized)
      context.setExpansionExpandedByDefault(Boolean(normalized?.expandedByDefault))
      context.clearToggledGroupKeys()
      context.bumpGroupRevision()
      context.setProjectionInvalidation(["groupChanged"])
      try {
        context.recomputeFromStage("group")
      } catch (error) {
        context.setGroupBy(currentGroupBy)
        restoreExpansionState(previousExpansion)
        context.bumpGroupRevision()
        context.setProjectionInvalidation(["groupChanged"])
        restoreProjectionAndRethrow("group", error)
      }
      context.emit()
    },
    setPivotModel(nextPivotModel: DataGridPivotSpec | null) {
      context.ensureActive()
      const normalized = normalizePivotSpec(nextPivotModel)
      const currentPivotModel = context.getPivotModel()
      if (isSamePivotSpec(currentPivotModel, normalized)) {
        return
      }
      const previousExpansion = captureExpansionState()
      context.setPivotModel(normalized)
      context.resetPivotColumns()
      context.setPivotExpansionExpandedByDefault(true)
      context.clearToggledPivotGroupKeys()
      context.bumpGroupRevision()
      context.setProjectionInvalidation(["pivotChanged"])
      try {
        context.recomputeFromStage("pivot")
      } catch (error) {
        context.setPivotModel(currentPivotModel)
        context.resetPivotColumns()
        restoreExpansionState(previousExpansion)
        context.bumpGroupRevision()
        context.setProjectionInvalidation(["pivotChanged"])
        restoreProjectionAndRethrow("pivot", error)
      }
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
      context.setProjectionInvalidation(["aggregationChanged"])
      try {
        if (context.isTreeDataEnabled()) {
          context.invalidateTreeProjectionCaches()
          context.recomputeFromStage("group")
        } else {
          context.recomputeFromStage("aggregate")
        }
      } catch (error) {
        context.setAggregationModel(currentAggregationModel)
        context.setProjectionInvalidation(["aggregationChanged"])
        restoreProjectionAndRethrow(context.isTreeDataEnabled() ? "group" : "aggregate", error)
      }
      context.emit()
    },
    setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null) {
      context.ensureActive()
      applyExpansionMutation(() => context.applyGroupExpansion(expansion))
    },
    toggleGroup(groupKey: string) {
      context.ensureActive()
      const expansionSpec = context.getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      const expansionState = context.getActiveExpansionStateStore()
      applyExpansionMutation(() => toggleGroupExpansionKey(expansionState.toggledKeys, groupKey))
    },
    expandGroup(groupKey: string) {
      context.ensureActive()
      const expansionSpec = context.getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      const expansionState = context.getActiveExpansionStateStore()
      applyExpansionMutation(() => setGroupExpansionKey(expansionState.toggledKeys, groupKey, expansionState.expandedByDefault, true))
    },
    collapseGroup(groupKey: string) {
      context.ensureActive()
      const expansionSpec = context.getExpansionSpec()
      if (!expansionSpec) {
        return
      }
      const expansionState = context.getActiveExpansionStateStore()
      applyExpansionMutation(() => setGroupExpansionKey(expansionState.toggledKeys, groupKey, expansionState.expandedByDefault, false))
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
      applyExpansionMutation(() => {
        expansionState.setExpandedByDefault(true)
        expansionState.toggledKeys.clear()
        return true
      })
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
      applyExpansionMutation(() => {
        expansionState.setExpandedByDefault(false)
        expansionState.toggledKeys.clear()
        return true
      })
    },
  }
}
