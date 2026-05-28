import { buildPaginationSnapshot, type DataGridFilterSnapshot, type DataGridPaginationInput, type DataGridRowId, type DataGridRowNode, type DataGridSortState, type DataGridTreeDataResolvedSpec } from "../rowModel.js"
import type { DataGridProjectionPolicy } from "./projectionPolicy.js"
import { preservePivotProjectionRowIdentity } from "../pivot/clientRowPivotProjectionUtils.js"
import { serializeSortValueModelForCache, shouldUseFilteredRowsForTreeSort, sortLeafRows } from "./clientRowProjectionPrimitives.js"
import { assignDisplayIndexes, enforceCacheCap, patchProjectedRowsByIdentity, preserveRowOrder, remapRowsByIdentity } from "../clientRowRuntimeUtils.js"
import { compareDataGridValues, type DataGridComparatorRegistry } from "../comparator/comparatorPolicy.js"

export interface SortValueCacheEntry {
  rowVersion: number
  values: readonly unknown[]
  singleValue?: unknown
}

export interface SortValueCounters {
  hits: number
  misses: number
}

export interface RunFilterProjectionStageParams<T> {
  sourceRows: readonly DataGridRowNode<T>[]
  previousFilteredRowsProjection: readonly DataGridRowNode<T>[]
  previousFilteredRowIds: ReadonlySet<DataGridRowId>
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
  if (shouldRecomputeFilter) {
    const filteredRowIds = new Set<DataGridRowId>()
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
  return {
    filteredRowsProjection: nextFilteredRows,
    filteredRowIds: new Set(params.previousFilteredRowIds),
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
  sortProjectionKey: string
  sortInputRowsReference: readonly DataGridRowNode<T>[] | null
  rowVersionById: ReadonlyMap<DataGridRowId, number>
  counters: SortValueCounters
  readRowField: (row: DataGridRowNode<T>, key: string, field?: string) => unknown
  comparatorRegistry?: DataGridComparatorRegistry<T>
}

export interface RunSortProjectionStageResult<T> {
  sortedRowsProjection: DataGridRowNode<T>[]
  recomputed: boolean
  sortValueCacheKey: string
  sortProjectionKey: string
  sortInputRowsReference: readonly DataGridRowNode<T>[] | null
}

const EMPTY_SORT_VALUES: readonly unknown[] = Object.freeze([])

type SingleSortValueResolver<T> = (row: DataGridRowNode<T>, descriptor: DataGridSortState) => unknown

function resolveSingleSortDescriptor(sortModel: readonly DataGridSortState[]): DataGridSortState | null {
  if (!Array.isArray(sortModel)) {
    return null
  }
  const descriptors = sortModel.filter(Boolean)
  return descriptors.length === 1 ? descriptors[0] ?? null : null
}

function tryReverseSingleSortDirectionProjection<T>(input: {
  descriptor: DataGridSortState
  rowsForSort: readonly DataGridRowNode<T>[]
  previousSortedRowsProjection: readonly DataGridRowNode<T>[]
  previousSortInputRowsReference: readonly DataGridRowNode<T>[] | null
  previousSortValueCacheKey: string
  nextSortValueCacheKey: string
  previousSortProjectionKey: string
  nextSortProjectionKey: string
  resolveSingleSortValue: SingleSortValueResolver<T>
  comparatorRegistry?: DataGridComparatorRegistry<T>
}): DataGridRowNode<T>[] | null {
  if (
    input.nextSortValueCacheKey === "__none__"
    || input.previousSortValueCacheKey !== input.nextSortValueCacheKey
    || input.previousSortProjectionKey === "__none__"
    || input.previousSortProjectionKey === input.nextSortProjectionKey
    || input.previousSortedRowsProjection.length === 0
    || input.previousSortInputRowsReference !== input.rowsForSort
  ) {
    return null
  }

  const groups: Array<{ start: number; end: number }> = []
  let groupStart = 0
  let groupValue = input.resolveSingleSortValue(input.previousSortedRowsProjection[0]!, input.descriptor)
  for (let index = 1; index < input.previousSortedRowsProjection.length; index += 1) {
    const row = input.previousSortedRowsProjection[index]
    if (!row) {
      continue
    }
    const value = input.resolveSingleSortValue(row, input.descriptor)
    const compared = compareDataGridValues(
      groupValue,
      value,
      {
        descriptor: input.descriptor,
        leftRow: input.previousSortedRowsProjection[groupStart],
        rightRow: row,
      },
      { comparatorRegistry: input.comparatorRegistry },
    )
    if (compared === 0) {
      continue
    }
    groups.push({ start: groupStart, end: index })
    groupStart = index
    groupValue = value
  }
  groups.push({ start: groupStart, end: input.previousSortedRowsProjection.length })

  const sortedRows = new Array<DataGridRowNode<T>>(input.previousSortedRowsProjection.length)
  let outputIndex = 0
  for (let groupIndex = groups.length - 1; groupIndex >= 0; groupIndex -= 1) {
    const group = groups[groupIndex]
    if (!group) {
      continue
    }
    for (let index = group.start; index < group.end; index += 1) {
      const row = input.previousSortedRowsProjection[index]
      if (row) {
        sortedRows[outputIndex] = row
        outputIndex += 1
      }
    }
  }
  return sortedRows
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
    const sortProjectionKey = serializeSortValueModelForCache(params.sortModel, { includeDirection: true })
    if (sortKey !== params.sortValueCacheKey || !shouldCacheSortValues || maxSortValueCacheSize <= 0) {
      params.sortValueCache.clear()
    }
    const resolveSingleSortValue: SingleSortValueResolver<T> = (row, descriptor) => {
      if (!shouldCacheSortValues || maxSortValueCacheSize <= 0) {
        params.counters.misses += 1
        return params.readRowField(row, descriptor.key, descriptor.field)
      }
      const currentRowVersion = params.rowVersionById.get(row.rowId) ?? 0
      const cached = params.sortValueCache.get(row.rowId)
      if (cached && cached.rowVersion === currentRowVersion) {
        params.counters.hits += 1
        return Object.prototype.hasOwnProperty.call(cached, "singleValue")
          ? cached.singleValue
          : cached.values[0]
      }
      const resolved = params.readRowField(row, descriptor.key, descriptor.field)
      params.sortValueCache.set(row.rowId, {
        rowVersion: currentRowVersion,
        values: EMPTY_SORT_VALUES,
        singleValue: resolved,
      })
      enforceCacheCap(params.sortValueCache, maxSortValueCacheSize)
      params.counters.misses += 1
      return resolved
    }
    const singleSortDescriptor = resolveSingleSortDescriptor(params.sortModel)
    const directionReversedRows = singleSortDescriptor && !params.treeData
      ? tryReverseSingleSortDirectionProjection({
          descriptor: singleSortDescriptor,
          rowsForSort,
          previousSortedRowsProjection: params.previousSortedRowsProjection,
          previousSortInputRowsReference: params.sortInputRowsReference,
          previousSortValueCacheKey: params.sortValueCacheKey,
          nextSortValueCacheKey: sortKey,
          previousSortProjectionKey: params.sortProjectionKey,
          nextSortProjectionKey: sortProjectionKey,
          resolveSingleSortValue,
          comparatorRegistry: params.comparatorRegistry,
        })
      : null
    if (directionReversedRows) {
      return {
        sortedRowsProjection: directionReversedRows,
        recomputed: true,
        sortValueCacheKey: sortKey,
        sortProjectionKey,
        sortInputRowsReference: rowsForSort,
      }
    }

    const sortedRowsProjection = sortLeafRows(
      rowsForSort,
      params.sortModel,
      (row, descriptors) => {
        if (!shouldCacheSortValues || maxSortValueCacheSize <= 0) {
          params.counters.misses += 1
          const values = new Array<unknown>(descriptors.length)
          for (let index = 0; index < descriptors.length; index += 1) {
            const descriptor = descriptors[index]
            values[index] = descriptor
              ? params.readRowField(row, descriptor.key, descriptor.field)
              : undefined
          }
          return values
        }
        const currentRowVersion = params.rowVersionById.get(row.rowId) ?? 0
        const cached = params.sortValueCache.get(row.rowId)
        if (cached && cached.rowVersion === currentRowVersion) {
          params.counters.hits += 1
          return cached.values
        }
        const resolved = new Array<unknown>(descriptors.length)
        for (let index = 0; index < descriptors.length; index += 1) {
          const descriptor = descriptors[index]
          resolved[index] = descriptor
            ? params.readRowField(row, descriptor.key, descriptor.field)
            : undefined
        }
        params.sortValueCache.set(row.rowId, {
          rowVersion: currentRowVersion,
          values: resolved,
        })
        enforceCacheCap(params.sortValueCache, maxSortValueCacheSize)
        params.counters.misses += 1
        return resolved
      },
      (row, descriptor) => resolveSingleSortValue(row, descriptor),
      { comparatorRegistry: params.comparatorRegistry },
    )
    return {
      sortedRowsProjection,
      recomputed: true,
      sortValueCacheKey: sortKey,
      sortProjectionKey,
      sortInputRowsReference: rowsForSort,
    }
  }

  return {
    sortedRowsProjection: preserveRowOrder(params.previousSortedRowsProjection, rowsForSort),
    recomputed: false,
    sortValueCacheKey: params.sortValueCacheKey,
    sortProjectionKey: params.sortProjectionKey,
    sortInputRowsReference: params.sortInputRowsReference,
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
