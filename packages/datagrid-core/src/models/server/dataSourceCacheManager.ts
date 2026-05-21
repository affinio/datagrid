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
    protectedRanges: readonly DataGridViewportRange[]
    onEvict?: (index: number) => void
  }): void
  deleteIndex(index: number): boolean
  clear(): void
}

export function createDataSourceCacheManager<T>(options: {
  rowCacheLimit: number
  rangeCacheChunkSize: number
}): DataSourceCacheManager<T> {
  const rowCache = new Map<number, DataGridRowNode<T>>()
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
    enforceLimit({ rowCacheLimit, protectedRanges, onEvict }) {
      while (rowCache.size > rowCacheLimit) {
        let evictIndex: number | undefined
        for (const cachedIndex of rowCache.keys()) {
          if (!isProtectedIndex(cachedIndex, protectedRanges)) {
            evictIndex = cachedIndex
            break
          }
        }
        if (typeof evictIndex === "undefined") {
          evictIndex = rowCache.keys().next().value as number | undefined
        }
        if (typeof evictIndex === "undefined") {
          break
        }
        if (deleteIndex(evictIndex)) {
          onEvict?.(evictIndex)
        }
      }
    },
    deleteIndex,
    clear,
  }
}
