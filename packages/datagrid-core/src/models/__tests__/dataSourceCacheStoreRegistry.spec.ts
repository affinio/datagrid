import { describe, expect, it } from "vitest"
import { createDataSourceCacheStoreRegistry } from "../server/dataSourceCacheStoreRegistry"

describe("data source cache store registry", () => {
  it("reuses a retained store only for the same query signature", () => {
    const registry = createDataSourceCacheStoreRegistry({ maxStores: 3 })
    const first = registry.acquire({ key: "root/teams", parentKey: "root", signature: "rev-1|sort-a" })
    expect(first.reused).toBe(false)
    expect(registry.retain("root/teams")).toBe(true)
    const reused = registry.acquire({ key: "root/teams", parentKey: "root", signature: "rev-1|sort-a" })
    expect(reused.reused).toBe(true)
    expect(reused.store.lifecycle).toBe("active")
    expect(reused.store.generation).toBe(first.store.generation)
    const replaced = registry.acquire({ key: "root/teams", parentKey: "root", signature: "rev-2|sort-a" })
    expect(replaced.reused).toBe(false)
    expect(replaced.store.generation).toBe(first.store.generation + 1)
  })

  it("evicts oldest retained stores while preserving active branches", () => {
    const registry = createDataSourceCacheStoreRegistry({ maxStores: 2 })
    registry.acquire({ key: "root", signature: "rev-1" })
    registry.retain("root")
    registry.acquire({ key: "root/a", parentKey: "root", signature: "rev-1" })
    registry.retain("root/a")
    registry.acquire({ key: "root/b", parentKey: "root", signature: "rev-1" })
    expect(registry.enforceLimit()).toEqual(["root"])
    expect(registry.get("root")).toBeUndefined()
    expect(registry.get("root/a")?.lifecycle).toBe("retained")
    expect(registry.get("root/b")?.lifecycle).toBe("active")
  })

  it("invalidates a store by removing it before a new generation is acquired", () => {
    const registry = createDataSourceCacheStoreRegistry()
    const acquired = registry.acquire({ key: "root", signature: "rev-1" })
    expect(registry.invalidate("root")).toBe(true)
    expect(registry.get("root")).toBeUndefined()
    const next = registry.acquire({ key: "root", signature: "rev-2" })
    expect(next.store.generation).toBe(acquired.store.generation + 1)
  })
})
