import {
  buildPaginationSnapshot,
  type DataGridAggregationModel,
  type DataGridFilterSnapshot,
  type DataGridGroupBySpec,
  type DataGridPaginationInput,
  type DataGridPaginationSnapshot,
  type DataGridPivotSpec,
  type DataGridRowNode,
  type DataGridViewportRange,
} from "../rowModel.js"
import type { DataGridClientRowRuntimeState } from "../state/clientRowRuntimeStateStore.js"
import { hasActiveFilterModel } from "./clientRowProjectionPrimitives.js"

export interface CreateClientRowFlatIdentityProjectionRefreshRuntimeOptions<T> {
  runtimeState: DataGridClientRowRuntimeState<T>
  getBaseSourceRows(): readonly DataGridRowNode<T>[]
  getFilterModel(): DataGridFilterSnapshot | null
  getSortModel(): readonly unknown[]
  isTreeDataEnabled(): boolean
  getGroupBy(): DataGridGroupBySpec | null
  getPivotModel(): DataGridPivotSpec | null
  getAggregationModel(): DataGridAggregationModel<T> | null
  getPagination(): DataGridPaginationSnapshot
  getPaginationInput(): DataGridPaginationInput | null
  setPagination(nextPagination: DataGridPaginationSnapshot): void
  getViewportRange(): DataGridViewportRange
  setViewportRange(range: DataGridViewportRange): void
  normalizeViewportRange(range: DataGridViewportRange, rowCount: number): DataGridViewportRange
  commitProjectionCycle(hadActualRecompute: boolean): void
  updateDerivedCacheRevisions(revisions: {
    row: number
    sort: number
    filter: number
    group: number
  }): void
}

export interface DataGridClientRowFlatIdentityProjectionRefreshRuntime {
  canApply(): boolean
  commit(): void
  tryApply(): boolean
}

export function createClientRowFlatIdentityProjectionRefreshRuntime<T>(
  options: CreateClientRowFlatIdentityProjectionRefreshRuntimeOptions<T>,
): DataGridClientRowFlatIdentityProjectionRefreshRuntime {
  const canApply = (): boolean => {
    return !hasActiveFilterModel(options.getFilterModel())
      && options.getSortModel().length === 0
      && !options.isTreeDataEnabled()
      && options.getGroupBy() === null
      && options.getPivotModel() === null
      && !Boolean(options.getAggregationModel()?.columns.length)
      && options.getPagination().enabled !== true
  }

  const commit = (): void => {
    const nextFlatRows = options.getBaseSourceRows() as DataGridRowNode<T>[]
    options.runtimeState.filteredRowsProjection = nextFlatRows
    options.runtimeState.sortedRowsProjection = nextFlatRows
    options.runtimeState.groupedRowsProjection = nextFlatRows
    options.runtimeState.pivotedRowsProjection = nextFlatRows
    options.runtimeState.aggregatedRowsProjection = nextFlatRows
    options.runtimeState.paginatedRowsProjection = nextFlatRows
    options.runtimeState.rows = nextFlatRows
    options.setPagination(buildPaginationSnapshot(nextFlatRows.length, options.getPaginationInput()))
    options.setViewportRange(
      options.normalizeViewportRange(options.getViewportRange(), nextFlatRows.length),
    )
    options.commitProjectionCycle(false)
    options.updateDerivedCacheRevisions({
      row: options.runtimeState.rowRevision,
      sort: options.runtimeState.sortRevision,
      filter: options.runtimeState.filterRevision,
      group: options.runtimeState.groupRevision,
    })
  }

  const tryApply = (): boolean => {
    if (!canApply()) {
      return false
    }
    commit()
    return true
  }

  return {
    canApply,
    commit,
    tryApply,
  }
}
