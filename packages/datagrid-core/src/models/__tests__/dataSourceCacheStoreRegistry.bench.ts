import { bench, describe } from "vitest"
import { createDataSourceCacheStoreRegistry } from "../server/dataSourceCacheStoreRegistry"

describe("data source cache store registry", () => {
  bench("acquire, retain and enforce 10k stores at cap 64", () => {
    const registry = createDataSourceCacheStoreRegistry({ maxStores: 64 })
    for (let index = 0; index < 10_000; index += 1) {
      const key = "root/branch-" + index
      registry.acquire({ key, parentKey: "root", signature: "rev-1" })
      registry.retain(key)
      registry.enforceLimit()
    }
  }, { iterations: 5, time: 500 })
})
