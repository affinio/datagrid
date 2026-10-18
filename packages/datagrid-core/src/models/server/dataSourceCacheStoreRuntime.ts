import { createDataSourceCacheManager } from "./dataSourceCacheManager.js"
import { createDataSourceCacheStoreRegistry } from "./dataSourceCacheStoreRegistry.js"

export interface DataSourceCacheStore<T> {
  key: string
  cacheManager: ReturnType<typeof createDataSourceCacheManager<T>>
  cacheStateKeyByIndex: Map<number, string>
}

export interface DataSourceCacheStoreRuntime<T> {
  readonly activeCacheStore: DataSourceCacheStore<T>
  activateCacheStore(key: string): DataSourceCacheStore<T>
  enforceGlobalCacheRowBudget(): void
  disposeRetainedStores(): void
}

export function createDataSourceCacheStoreRuntime<T>(options: {
  rowCacheLimit: number
  rowCacheMaxBytes?: number
  rangeCacheChunkSize: number
  maxStores?: number
}): DataSourceCacheStoreRuntime<T> {
  const registry = createDataSourceCacheStoreRegistry({ maxStores: options.maxStores ?? 8 })
  const stores = new Map<string, DataSourceCacheStore<T>>()
  const createStore = (key: string): DataSourceCacheStore<T> => {
    const cacheManager = createDataSourceCacheManager<T>({
      rowCacheLimit: options.rowCacheLimit,
      maxBytes: options.rowCacheMaxBytes,
      rangeCacheChunkSize: options.rangeCacheChunkSize,
    })
    cacheManager.init()
    cacheManager.attach()
    const store = { key, cacheManager, cacheStateKeyByIndex: new Map<number, string>() }
    stores.set(key, store)
    return store
  }

  const rootStore = createStore("__root__")
  registry.acquire({ key: rootStore.key, signature: rootStore.key })
  let activeStore = rootStore

  const disposeStore = (key: string): void => {
    if (key === activeStore.key) return
    const store = stores.get(key)
    if (!store) return
    store.cacheManager.dispose()
    store.cacheStateKeyByIndex.clear()
    stores.delete(key)
  }

  const enforceGlobalRowBudget = (): void => {
    const maxBytes = Number.isFinite(options.rowCacheMaxBytes) && (options.rowCacheMaxBytes as number) > 0
      ? Math.max(1, Math.trunc(options.rowCacheMaxBytes as number))
      : Number.POSITIVE_INFINITY
    const getTotals = (): { rows: number; bytes: number } => {
      let rows = 0
      let bytes = 0
      for (const store of stores.values()) {
        rows += store.cacheManager.rowCache.size
        bytes += store.cacheManager.getEstimatedBytes()
      }
      return { rows, bytes }
    }
    let totals = getTotals()
    while (totals.rows > options.rowCacheLimit || totals.bytes > maxBytes) {
      const evictedKey = registry.evictLeastRecentlyUsedRetained()
      if (!evictedKey) return
      disposeStore(evictedKey)
      totals = getTotals()
    }
  }

  return {
    get activeCacheStore() {
      return activeStore
    },
    enforceGlobalCacheRowBudget: enforceGlobalRowBudget,
    activateCacheStore(key) {
      if (activeStore.key === key) return activeStore
      const previousStore = activeStore
      registry.retain(previousStore.key)
      registry.acquire({ key, signature: key })
      const nextStore = stores.get(key) ?? createStore(key)
      activeStore = nextStore
      if (nextStore.cacheManager.rowCache.size === 0 && previousStore.cacheManager.rowCache.size > 0) {
        for (const [index, row] of previousStore.cacheManager.rowCache) {
          nextStore.cacheManager.rowCache.set(index, row)
          nextStore.cacheManager.staleRetainedRowIndexes.add(index)
          nextStore.cacheManager.rangeCache.setRow(index, row)
          nextStore.cacheStateKeyByIndex.set(index, previousStore.cacheStateKeyByIndex.get(index) ?? "__retained__")
        }
      }
      for (const evictedKey of registry.enforceLimit()) {
        if (evictedKey !== activeStore.key) disposeStore(evictedKey)
      }
      enforceGlobalRowBudget()
      return activeStore
    },
    disposeRetainedStores() {
      for (const store of stores.values()) {
        if (store.cacheManager !== activeStore.cacheManager) store.cacheManager.dispose()
      }
      stores.clear()
      registry.clear()
    },
  }
}
