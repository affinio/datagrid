import { describe, expect, it } from "vitest"
import {
  DATAGRID_PROJECTION_CACHE_POLICY_MATRIX,
  createDataGridProjectionPolicy,
  resolveDataGridProjectionCachePolicy,
} from "../projectionPolicy"

describe("projectionPolicy", () => {
  it("maps performance modes to deterministic cache policy limits", () => {
    expect(resolveDataGridProjectionCachePolicy("memory", 1_000)).toEqual({
      sortValues: {
        enabled: true,
        maxSize: 1_250,
      },
      groupValues: {
        enabled: true,
        maxSize: 1_000,
      },
    })
    expect(resolveDataGridProjectionCachePolicy("balanced", 100)).toEqual({
      sortValues: {
        enabled: true,
        maxSize: 1_024,
      },
      groupValues: {
        enabled: true,
        maxSize: 1_024,
      },
    })
    expect(resolveDataGridProjectionCachePolicy("speed", 1_000)).toEqual({
      sortValues: {
        enabled: true,
        maxSize: 6_000,
      },
      groupValues: {
        enabled: true,
        maxSize: 8_000,
      },
    })
  })

  it("keeps legacy sort/group cache API aligned with unified cache matrix", () => {
    const policy = createDataGridProjectionPolicy({ performanceMode: "memory" })
    const resolved = policy.resolveCachePolicy?.(2_000)
    expect(resolved).toEqual({
      sortValues: {
        enabled: DATAGRID_PROJECTION_CACHE_POLICY_MATRIX.memory.sortValues.enabled,
        maxSize: 2_500,
      },
      groupValues: {
        enabled: DATAGRID_PROJECTION_CACHE_POLICY_MATRIX.memory.groupValues.enabled,
        maxSize: 2_000,
      },
    })
    expect(policy.shouldCacheSortValues()).toBe(resolved?.sortValues.enabled)
    expect(policy.shouldCacheGroupValues()).toBe(resolved?.groupValues.enabled)
    expect(policy.maxSortValueCacheSize(2_000)).toBe(resolved?.sortValues.maxSize)
    expect(policy.maxGroupValueCacheSize(2_000)).toBe(resolved?.groupValues.maxSize)
  })

  it("returns zero cache size for disabled buckets in custom matrix", () => {
    const customMatrix = {
      ...DATAGRID_PROJECTION_CACHE_POLICY_MATRIX,
      balanced: {
        sortValues: {
          enabled: false,
          multiplier: 0,
          floor: 0,
        },
        groupValues: DATAGRID_PROJECTION_CACHE_POLICY_MATRIX.balanced.groupValues,
      },
    }
    const resolved = resolveDataGridProjectionCachePolicy("balanced", 1_000, customMatrix)
    expect(resolved.sortValues).toEqual({
      enabled: false,
      maxSize: 0,
    })
    expect(resolved.groupValues).toEqual({
      enabled: true,
      maxSize: 4_000,
    })
  })
})
