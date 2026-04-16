import type { DataGridFilterSnapshot, DataGridRowId, DataGridRowNode } from "../rowModel.js"
import type {
  DataGridFilterCellStyleValueReader,
  DataGridFilterCellValueReader,
} from "./clientRowProjectionPrimitives.js"
import type { SortValueCacheEntry } from "./clientRowProjectionBasicStages.js"

export interface DataGridClientRowModelDerivedCacheDiagnostics {
  revisions: {
    row: number
    sort: number
    filter: number
    group: number
  }
  filterPredicateHits: number
  filterPredicateMisses: number
  sortValueHits: number
  sortValueMisses: number
  groupValueHits: number
  groupValueMisses: number
  sourceColumnCacheSize: number
  sourceColumnCacheLimit: number | null
  sourceColumnCacheEvictions: number
}

export interface ClientRowDerivedCacheRuntimeContext<T> {
  getFilterModel: () => DataGridFilterSnapshot | null
  getFilterRevision: () => number
  readRowField: (row: DataGridRowNode<T>, key: string, field?: string) => unknown
  readFilterCell?: DataGridFilterCellValueReader<T>
  readFilterCellStyle?: DataGridFilterCellStyleValueReader<T>
  createFilterPredicate: (
    filterModel: DataGridFilterSnapshot | null,
    options: {
      ignoreColumnFilterKey?: string
      readRowField: (row: DataGridRowNode<T>, key: string, field?: string) => unknown
      readFilterCell?: DataGridFilterCellValueReader<T>
      readFilterCellStyle?: DataGridFilterCellStyleValueReader<T>
    },
  ) => (rowNode: DataGridRowNode<T>) => boolean
  sourceColumnCacheLimit: number | null
}

export interface ClientRowDerivedCacheRuntime<T> {
  resolveFilterPredicate: (
    options?: { ignoreColumnFilterKey?: string },
  ) => (rowNode: DataGridRowNode<T>) => boolean
  clearFilterPredicateCache: () => void
  getSortValueCacheKey: () => string
  setSortValueCacheKey: (key: string) => void
  getSortValueCache: () => Map<DataGridRowId, SortValueCacheEntry>
  clearSortValueCache: () => void
  evictSortValueCacheRows: (rowIds: readonly DataGridRowId[]) => void
  getGroupValueCacheKey: () => string
  setGroupValueCacheKey: (key: string) => void
  getGroupValueCache: () => Map<string, string>
  clearGroupValueCache: () => void
  resetAllCaches: () => void
  updateRevisions: (revisions: {
    row: number
    sort: number
    filter: number
    group: number
  }) => void
  setSourceColumnCacheSize: (size: number) => void
  incrementSourceColumnCacheEvictions: () => void
  getMutableDiagnostics: () => DataGridClientRowModelDerivedCacheDiagnostics
  getDiagnostics: () => DataGridClientRowModelDerivedCacheDiagnostics
}

export function createClientRowDerivedCacheRuntime<T>(
  context: ClientRowDerivedCacheRuntimeContext<T>,
): ClientRowDerivedCacheRuntime<T> {
  let cachedFilterPredicateKey = "__none__"
  let cachedFilterPredicate: ((rowNode: DataGridRowNode<T>) => boolean) | null = null
  const sortValueCache = new Map<DataGridRowId, SortValueCacheEntry>()
  let sortValueCacheKey = "__none__"
  const groupValueCache = new Map<string, string>()
  let groupValueCacheKey = "__none__"
  const diagnostics: DataGridClientRowModelDerivedCacheDiagnostics = {
    revisions: {
      row: 0,
      sort: 0,
      filter: 0,
      group: 0,
    },
    filterPredicateHits: 0,
    filterPredicateMisses: 0,
    sortValueHits: 0,
    sortValueMisses: 0,
    groupValueHits: 0,
    groupValueMisses: 0,
    sourceColumnCacheSize: 0,
    sourceColumnCacheLimit: context.sourceColumnCacheLimit,
    sourceColumnCacheEvictions: 0,
  }

  return {
    resolveFilterPredicate(options: { ignoreColumnFilterKey?: string } = {}) {
      const ignoredColumnKey = typeof options.ignoreColumnFilterKey === "string"
        ? options.ignoreColumnFilterKey.trim()
        : ""
      const filterModel = context.getFilterModel()
      if (ignoredColumnKey) {
        diagnostics.filterPredicateMisses += 1
        return context.createFilterPredicate(filterModel, {
          ignoreColumnFilterKey: ignoredColumnKey,
          readRowField: context.readRowField,
          readFilterCell: context.readFilterCell,
          readFilterCellStyle: context.readFilterCellStyle,
        })
      }

      const filterKey = String(context.getFilterRevision())
      if (filterKey === cachedFilterPredicateKey && cachedFilterPredicate) {
        diagnostics.filterPredicateHits += 1
        return cachedFilterPredicate
      }

      const next = context.createFilterPredicate(filterModel, {
        readRowField: context.readRowField,
        readFilterCell: context.readFilterCell,
        readFilterCellStyle: context.readFilterCellStyle,
      })
      cachedFilterPredicateKey = filterKey
      cachedFilterPredicate = next
      diagnostics.filterPredicateMisses += 1
      return next
    },
    clearFilterPredicateCache() {
      cachedFilterPredicateKey = "__none__"
      cachedFilterPredicate = null
    },
    getSortValueCacheKey() {
      return sortValueCacheKey
    },
    setSortValueCacheKey(key: string) {
      sortValueCacheKey = key
    },
    getSortValueCache() {
      return sortValueCache
    },
    clearSortValueCache() {
      sortValueCache.clear()
    },
    evictSortValueCacheRows(rowIds: readonly DataGridRowId[]) {
      for (const rowId of rowIds) {
        sortValueCache.delete(rowId)
      }
    },
    getGroupValueCacheKey() {
      return groupValueCacheKey
    },
    setGroupValueCacheKey(key: string) {
      groupValueCacheKey = key
    },
    getGroupValueCache() {
      return groupValueCache
    },
    clearGroupValueCache() {
      groupValueCache.clear()
    },
    resetAllCaches() {
      cachedFilterPredicateKey = "__none__"
      cachedFilterPredicate = null
      sortValueCache.clear()
      sortValueCacheKey = "__none__"
      groupValueCache.clear()
      groupValueCacheKey = "__none__"
    },
    updateRevisions(revisions) {
      diagnostics.revisions.row = revisions.row
      diagnostics.revisions.sort = revisions.sort
      diagnostics.revisions.filter = revisions.filter
      diagnostics.revisions.group = revisions.group
    },
    setSourceColumnCacheSize(size: number) {
      diagnostics.sourceColumnCacheSize = size
    },
    incrementSourceColumnCacheEvictions() {
      diagnostics.sourceColumnCacheEvictions += 1
    },
    getMutableDiagnostics() {
      return diagnostics
    },
    getDiagnostics() {
      return {
        revisions: { ...diagnostics.revisions },
        filterPredicateHits: diagnostics.filterPredicateHits,
        filterPredicateMisses: diagnostics.filterPredicateMisses,
        sortValueHits: diagnostics.sortValueHits,
        sortValueMisses: diagnostics.sortValueMisses,
        groupValueHits: diagnostics.groupValueHits,
        groupValueMisses: diagnostics.groupValueMisses,
        sourceColumnCacheSize: diagnostics.sourceColumnCacheSize,
        sourceColumnCacheLimit: diagnostics.sourceColumnCacheLimit,
        sourceColumnCacheEvictions: diagnostics.sourceColumnCacheEvictions,
      }
    },
  }
}
