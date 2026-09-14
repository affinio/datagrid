export type DataSourceCacheStoreLifecycle = "active" | "retained" | "disposed"

export interface DataSourceCacheStoreDescriptor {
  readonly key: string
  readonly parentKey: string | null
  readonly signature: string
  readonly generation: number
  readonly lifecycle: DataSourceCacheStoreLifecycle
  readonly lastAccess: number
}

export interface DataSourceCacheStoreRegistry {
  acquire(input: { key: string; parentKey?: string | null; signature: string }): { store: DataSourceCacheStoreDescriptor; reused: boolean }
  retain(key: string): boolean
  dispose(key: string): boolean
  invalidate(key: string): boolean
  enforceLimit(): readonly string[]
  evictLeastRecentlyUsedRetained(): string | undefined
  get(key: string): DataSourceCacheStoreDescriptor | undefined
  getDiagnostics(): { maxStores: number; stores: number; active: number; retained: number; disposed: number }
  clear(): void
}

export function createDataSourceCacheStoreRegistry(options: { maxStores?: number } = {}): DataSourceCacheStoreRegistry {
  const maxStores = Number.isFinite(options.maxStores) && (options.maxStores as number) > 0 ? Math.max(1, Math.trunc(options.maxStores as number)) : 8
  const stores = new Map<string, DataSourceCacheStoreDescriptor>()
  const generationByKey = new Map<string, number>()
  const retainedHeap: Array<{ key: string; lastAccess: number }> = []
  let accessCounter = 0

  const insertRetainedHeapEntry = (entry: { key: string; lastAccess: number }): void => {
    retainedHeap.push(entry)
    let index = retainedHeap.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (retainedHeap[parent]!.lastAccess <= retainedHeap[index]!.lastAccess) break
      ;[retainedHeap[parent], retainedHeap[index]] = [retainedHeap[index]!, retainedHeap[parent]!]
      index = parent
    }
  }

  const rebuildRetainedHeap = (): void => {
    retainedHeap.length = 0
    for (const store of stores.values()) {
      if (store.lifecycle === "retained") {
        insertRetainedHeapEntry({ key: store.key, lastAccess: store.lastAccess })
      }
    }
  }

  const pushRetained = (store: DataSourceCacheStoreDescriptor): void => {
    insertRetainedHeapEntry({ key: store.key, lastAccess: store.lastAccess })
    if (retainedHeap.length > stores.size * 4 + 32) {
      rebuildRetainedHeap()
    }
  }

  const popRetained = (): { key: string; lastAccess: number } | undefined => {
    const first = retainedHeap[0]
    const last = retainedHeap.pop()
    if (last && retainedHeap.length > 0) {
      retainedHeap[0] = last
      let index = 0
      while (true) {
        const left = index * 2 + 1
        const right = left + 1
        let smallest = index
        if (left < retainedHeap.length && retainedHeap[left]!.lastAccess < retainedHeap[smallest]!.lastAccess) smallest = left
        if (right < retainedHeap.length && retainedHeap[right]!.lastAccess < retainedHeap[smallest]!.lastAccess) smallest = right
        if (smallest === index) break
        ;[retainedHeap[index], retainedHeap[smallest]] = [retainedHeap[smallest]!, retainedHeap[index]!]
        index = smallest
      }
    }
    return first
  }
  const touch = (store: DataSourceCacheStoreDescriptor): DataSourceCacheStoreDescriptor => {
    const next = { ...store, lastAccess: ++accessCounter }
    stores.set(next.key, next)
    return next
  }
  const create = (key: string, parentKey: string | null, signature: string, generation: number) => touch({ key, parentKey, signature, generation, lifecycle: "active", lastAccess: 0 })

  return {
    acquire({ key, parentKey = null, signature }) {
      const existing = stores.get(key)
      if (existing && existing.signature === signature && existing.lifecycle !== "disposed") return { store: touch({ ...existing, lifecycle: "active" }), reused: true }
      const generation = existing ? existing.generation + 1 : (generationByKey.get(key) ?? -1) + 1
      generationByKey.set(key, generation)
      if (existing) stores.delete(key)
      return { store: create(key, parentKey, signature, generation), reused: false }
    },
    retain(key) {
      const store = stores.get(key)
      if (!store || store.lifecycle === "disposed") return false
      const retained = touch({ ...store, lifecycle: "retained" })
      pushRetained(retained)
      return true
    },
    dispose(key) {
      return stores.delete(key)
    },
    invalidate(key) {
      const store = stores.get(key)
      if (!store) return false
      stores.delete(key)
      generationByKey.set(key, store.generation)
      return true
    },
    enforceLimit() {
      const evicted: string[] = []
      while (stores.size > maxStores) {
        const key = this.evictLeastRecentlyUsedRetained()
        if (!key) break
        evicted.push(key)
      }
      return evicted
    },
    evictLeastRecentlyUsedRetained() {
      while (true) {
        const candidate = popRetained()
        if (!candidate) return undefined
        const current = stores.get(candidate.key)
        if (!current || current.lifecycle !== "retained" || current.lastAccess !== candidate.lastAccess) continue
        stores.delete(candidate.key)
        return candidate.key
      }
    },
    get(key) {
      const store = stores.get(key)
      if (!store) return undefined
      const touched = touch(store)
      if (touched.lifecycle === "retained") pushRetained(touched)
      return touched
    },
    getDiagnostics() {
      let active = 0
      let retained = 0
      for (const store of stores.values()) {
        if (store.lifecycle === "active") active += 1
        if (store.lifecycle === "retained") retained += 1
      }
      return { maxStores, stores: stores.size, active, retained, disposed: 0 }
    },
    clear() { stores.clear(); generationByKey.clear(); retainedHeap.length = 0 },
  }
}
