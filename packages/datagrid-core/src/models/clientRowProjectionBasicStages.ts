import { buildPaginationSnapshot, type DataGridFilterSnapshot, type DataGridPaginationInput, type DataGridRowId, type DataGridRowNode, type DataGridSortState, type DataGridTreeDataResolvedSpec } from "./rowModel.js"
import type { DataGridProjectionPolicy } from "./projectionPolicy.js"
import { preservePivotProjectionRowIdentity } from "./clientRowPivotProjectionUtils.js"
import { serializeSortValueModelForCache, shouldUseFilteredRowsForTreeSort, sortLeafRows } from "./clientRowProjectionPrimitives.js"
import { assignDisplayIndexes, enforceCacheCap, patchProjectedRowsByIdentity, preserveRowOrder, remapRowsByIdentity } from "./clientRowRuntimeUtils.js"

export interface SortValueCacheEntry {
  rowVersion: number
  values: readonly unknown[]
}

export interface SortValueCounters {
  hits: number
  misses: number
}

export interface RunFilterProjectionStageParams<T> {
  sourceRows: readonly DataGridRowNode<T>[]
  previousFilteredRowsProjection: readonly DataGridRowNode<T>[]
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  shouldRecompute: boolean
  filterPredicate?: ((rowNode: DataGridRowNode<T>) => boolean) | null
  resolveFilterPredicate: () => (rowNode: DataGridRowNode<T>) => boolean
}

export interface RunFilterProjectionStageResult<T> {
  filteredRowsProjection: DataGridRowNode<T>[]
  filteredRowIds: Set<DataGridRowId>
  recomputed: boolean
}

export function runFilterProjectionStage<T>(
  params: RunFilterProjectionStageParams<T>,
): RunFilterProjectionStageResult<T> {
  const shouldRecomputeFilter = params.shouldRecompute || params.previousFilteredRowsProjection.length === 0
  const filteredRowIds = new Set<DataGridRowId>()
  if (shouldRecomputeFilter) {
    const filterPredicate = params.filterPredicate ?? params.resolveFilterPredicate()
    const nextFilteredRows: DataGridRowNode<T>[] = []
    for (const row of params.sourceRows) {
      if (!filterPredicate(row)) {
        continue
      }
      nextFilteredRows.push(row)
      filteredRowIds.add(row.rowId)
    }
    return {
      filteredRowsProjection: nextFilteredRows,
      filteredRowIds,
      recomputed: true,
    }
  }
  const nextFilteredRows = remapRowsByIdentity(params.previousFilteredRowsProjection, params.sourceById)
  for (const row of nextFilteredRows) {
    filteredRowIds.add(row.rowId)
  }
  return {
    filteredRowsProjection: nextFilteredRows,
    filteredRowIds,
    recomputed: false,
  }
}

export interface RunSortProjectionStageParams<T> {
  treeData: DataGridTreeDataResolvedSpec<T> | null
  filterModel: DataGridFilterSnapshot | null
  sourceRows: readonly DataGridRowNode<T>[]
  filteredRowsProjection: readonly DataGridRowNode<T>[]
  previousSortedRowsProjection: readonly DataGridRowNode<T>[]
  shouldRecompute: boolean
  sortModel: readonly DataGridSortState[]
  projectionPolicy: DataGridProjectionPolicy
  sortValueCache: Map<DataGridRowId, SortValueCacheEntry>
  sortValueCacheKey: string
  rowVersionById: ReadonlyMap<DataGridRowId, number>
  counters: SortValueCounters
  readRowField: (row: DataGridRowNode<T>, key: string, field?: string) => unknown
}

export interface RunSortProjectionStageResult<T> {
  sortedRowsProjection: DataGridRowNode<T>[]
  recomputed: boolean
  sortValueCacheKey: string
}

export function runSortProjectionStage<T>(
  params: RunSortProjectionStageParams<T>,
): RunSortProjectionStageResult<T> {
  const rowsForSort = params.treeData
    ? (shouldUseFilteredRowsForTreeSort(params.treeData, params.filterModel)
        ? params.filteredRowsProjection
        : params.sourceRows)
    : params.filteredRowsProjection
  const shouldRecomputeSort = params.shouldRecompute || params.previousSortedRowsProjection.length === 0
  if (shouldRecomputeSort) {
    const shouldCacheSortValues = params.projectionPolicy.shouldCacheSortValues()
    const maxSortValueCacheSize = params.projectionPolicy.maxSortValueCacheSize(params.sourceRows.length)
    const sortKey = serializeSortValueModelForCache(params.sortModel, { includeDirection: false })
    if (sortKey !== params.sortValueCacheKey || !shouldCacheSortValues || maxSortValueCacheSize <= 0) {
      params.sortValueCache.clear()
    }
    const sortedRowsProjection = sortLeafRows(rowsForSort, params.sortModel, (row, descriptors) => {
      if (!shouldCacheSortValues || maxSortValueCacheSize <= 0) {
        params.counters.misses += 1
        return descriptors.map(descriptor => params.readRowField(row, descriptor.key, descriptor.field))
      }
      const currentRowVersion = params.rowVersionById.get(row.rowId) ?? 0
      const cached = params.sortValueCache.get(row.rowId)
      if (cached && cached.rowVersion === currentRowVersion) {
        params.sortValueCache.delete(row.rowId)
        params.sortValueCache.set(row.rowId, cached)
        params.counters.hits += 1
        return cached.values
      }
      const resolved = descriptors.map(descriptor => params.readRowField(row, descriptor.key, descriptor.field))
      params.sortValueCache.set(row.rowId, {
        rowVersion: currentRowVersion,
        values: resolved,
      })
      enforceCacheCap(params.sortValueCache, maxSortValueCacheSize)
      params.counters.misses += 1
      return resolved
    })
    return {
      sortedRowsProjection,
      recomputed: true,
      sortValueCacheKey: sortKey,
    }
  }

  return {
    sortedRowsProjection: preserveRowOrder(params.previousSortedRowsProjection, rowsForSort),
    recomputed: false,
    sortValueCacheKey: params.sortValueCacheKey,
  }
}

export interface RunPaginateProjectionStageParams<T> {
  aggregatedRowsProjection: readonly DataGridRowNode<T>[]
  previousPaginatedRowsProjection: readonly DataGridRowNode<T>[]
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  shouldRecompute: boolean
  paginationInput: DataGridPaginationInput
  currentPagination: ReturnType<typeof buildPaginationSnapshot>
}

export interface RunPaginateProjectionStageResult<T> {
  paginatedRowsProjection: DataGridRowNode<T>[]
  pagination: ReturnType<typeof buildPaginationSnapshot>
  recomputed: boolean
}

export function runPaginateProjectionStage<T>(
  params: RunPaginateProjectionStageParams<T>,
): RunPaginateProjectionStageResult<T> {
  const shouldRecomputePaginate = params.shouldRecompute || params.previousPaginatedRowsProjection.length === 0
  if (shouldRecomputePaginate) {
    const pagination = buildPaginationSnapshot(params.aggregatedRowsProjection.length, params.paginationInput)
    const paginatedRowsProjection =
      pagination.enabled && pagination.startIndex >= 0 && pagination.endIndex >= pagination.startIndex
        ? params.aggregatedRowsProjection.slice(pagination.startIndex, pagination.endIndex + 1)
        : (params.aggregatedRowsProjection as DataGridRowNode<T>[])
    return {
      paginatedRowsProjection,
      pagination,
      recomputed: true,
    }
  }
  return {
    paginatedRowsProjection: patchProjectedRowsByIdentity(params.previousPaginatedRowsProjection, params.sourceById),
    pagination: params.currentPagination,
    recomputed: false,
  }
}

export interface RunVisibleProjectionStageParams<T> {
  paginatedRowsProjection: readonly DataGridRowNode<T>[]
  previousRows: readonly DataGridRowNode<T>[]
  sourceById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  shouldRecompute: boolean
  pivotEnabled: boolean
}

export interface RunVisibleProjectionStageResult<T> {
  rows: DataGridRowNode<T>[]
  recomputed: boolean
}

export function runVisibleProjectionStage<T>(
  params: RunVisibleProjectionStageParams<T>,
): RunVisibleProjectionStageResult<T> {
  const shouldRecomputeVisible = params.shouldRecompute || params.previousRows.length === 0
  if (shouldRecomputeVisible) {
    const nextVisibleRows = assignDisplayIndexes(params.paginatedRowsProjection)
    return {
      rows: params.pivotEnabled
        ? preservePivotProjectionRowIdentity(params.previousRows, nextVisibleRows, { includeDisplayIndex: true })
        : nextVisibleRows,
      recomputed: true,
    }
  }
  return {
    rows: patchProjectedRowsByIdentity(params.previousRows, params.sourceById),
    recomputed: false,
  }
}
