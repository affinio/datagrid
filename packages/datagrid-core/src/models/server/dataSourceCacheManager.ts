import type { DataGridRowNode, DataGridViewportRange } from "../rowModel.js"
import {
  createDataSourceRuntimeLifecycle,
  type DataSourceRuntimeLifecycle,
} from "./dataSourceRuntimeLifecycle.js"
import {
  createDataGridRangeCache,
  type DataGridRangeCache,
} from "./rangeCache.js"

export interface DataSourceCacheManager<T> extends DataSourceRuntimeLifecycle {
  readonly rowCache: Map<number, DataGridRowNode<T>>
  readonly staleRetainedRowIndexes: Set<number>
  readonly rangeCache: DataGridRangeCache<DataGridRowNode<T>>
  isProtectedIndex(index: number, protectedRanges: readonly DataGridViewportRange[]): boolean
  enforceLimit(options: {
    rowCacheLimit: number
    maxBytes?: number
    protectedRanges: readonly DataGridViewportRange[]
    onEvict?: (index: number) => void
  }): void
  getEstimatedBytes(): number
  deleteIndex(index: number): boolean
  clear(): void
}

export function createDataSourceCacheManager<T>(options: {
  rowCacheLimit: number
  rangeCacheChunkSize: number
  maxBytes?: number
  estimateRowBytes?: (row: DataGridRowNode<T>) => number
}): DataSourceCacheManager<T> {
  let estimatedBytes = 0
  const estimateRowBytes = options.estimateRowBytes ?? ((row: DataGridRowNode<T>): number => {
    try {
      return 128 + JSON.stringify(row.data).length * 2
    } catch {
      return 128
    }
  })
  class AccountingRowCache extends Map<number, DataGridRowNode<T>> {
    override set(index: number, row: DataGridRowNode<T>): this {
      const previous = super.get(index)
      if (previous) estimatedBytes -= estimateRowBytes(previous)
      estimatedBytes += Math.max(0, estimateRowBytes(row))
      return super.set(index, row)
    }
    override delete(index: number): boolean {
      const previous = super.get(index)
      if (!previous) return false
      estimatedBytes -= estimateRowBytes(previous)
      return super.delete(index)
    }
    override clear(): void {
      estimatedBytes = 0
      super.clear()
    }
  }
  const rowCache = new AccountingRowCache()
  const staleRetainedRowIndexes = new Set<number>()
  const rangeCache = createDataGridRangeCache<DataGridRowNode<T>>({
    chunkSize: options.rangeCacheChunkSize,
    maxChunks: Math.max(1, Math.ceil(options.rowCacheLimit / options.rangeCacheChunkSize)),
  })

  function isProtectedIndex(index: number, protectedRanges: readonly DataGridViewportRange[]): boolean {
    for (const range of protectedRanges) {
      if (index >= range.start && index <= range.end) {
        return true
      }
    }
    return false
  }

  function deleteIndex(index: number): boolean {
    const deleted = rowCache.delete(index)
    if (deleted) {
      staleRetainedRowIndexes.delete(index)
      rangeCache.deleteRow(index)
    }
    return deleted
  }

  function clear(): void {
    rowCache.clear()
    staleRetainedRowIndexes.clear()
    rangeCache.reset()
  }

  const lifecycle = createDataSourceRuntimeLifecycle({
    service: "cache-manager",
    onAttach: clear,
    onDispose: clear,
  })

  return {
    ...lifecycle,
    rowCache,
    staleRetainedRowIndexes,
    rangeCache,
    isProtectedIndex,
    enforceLimit({ rowCacheLimit, maxBytes = options.maxBytes, protectedRanges, onEvict }) {
      const normalizedMaxBytes = Number.isFinite(maxBytes) && (maxBytes as number) > 0
        ? Math.max(1, Math.trunc(maxBytes as number))
        : Number.POSITIVE_INFINITY
      if (rowCache.size <= rowCacheLimit && estimatedBytes <= normalizedMaxBytes) {
        return
      }
      const evictionCandidates: number[] = []
      for (const cachedIndex of rowCache.keys()) {
        if (!isProtectedIndex(cachedIndex, protectedRanges)) {
          evictionCandidates.push(cachedIndex)
        }
      }
      let candidateIndex = 0
      while (rowCache.size > rowCacheLimit || estimatedBytes > normalizedMaxBytes) {
        const evictIndex = evictionCandidates[candidateIndex]
        candidateIndex += 1
        if (typeof evictIndex === "undefined") {
          break
        }
        if (deleteIndex(evictIndex)) {
          onEvict?.(evictIndex)
        }
      }
    },
    deleteIndex,
    getEstimatedBytes: () => estimatedBytes,
    clear,
  }
}
