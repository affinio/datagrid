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
  get(key: string): DataSourceCacheStoreDescriptor | undefined
  getDiagnostics(): { maxStores: number; stores: number; active: number; retained: number; disposed: number }
  clear(): void
}

export function createDataSourceCacheStoreRegistry(options: { maxStores?: number } = {}): DataSourceCacheStoreRegistry {
  const maxStores = Number.isFinite(options.maxStores) && (options.maxStores as number) > 0 ? Math.max(1, Math.trunc(options.maxStores as number)) : 8
  const stores = new Map<string, DataSourceCacheStoreDescriptor>()
  const generationByKey = new Map<string, number>()
  let accessCounter = 0
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
      touch({ ...store, lifecycle: "retained" })
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
      const retained = [...stores.values()].filter(store => store.lifecycle === "retained").sort((left, right) => left.lastAccess - right.lastAccess)
      const evicted: string[] = []
      while (stores.size > maxStores && retained.length > 0) {
        const candidate = retained.shift()
        if (!candidate) break
        if (stores.delete(candidate.key)) evicted.push(candidate.key)
      }
      return evicted
    },
    get(key) {
      const store = stores.get(key)
      return store ? touch(store) : undefined
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
    clear() { stores.clear(); generationByKey.clear() },
  }
}
