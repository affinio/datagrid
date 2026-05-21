import { describe, expect, it } from "vitest"
import { resolveDataSourceRuntimeState, type DataSourceRuntimeStateInput } from "../server/dataSourceRuntimeStateMachine"

const idleInput: DataSourceRuntimeStateInput = {
  cachedRows: 0,
  criticalInFlight: false,
  criticalAffectsLoading: false,
  backgroundInFlight: false,
  invalidating: false,
  optimisticMutating: false,
  staleRetainedRows: 0,
  error: null,
  disposed: false,
}

function resolve(overrides: Partial<DataSourceRuntimeStateInput>) {
  return resolveDataSourceRuntimeState({
    ...idleInput,
    ...overrides,
  })
}

describe("resolveDataSourceRuntimeState", () => {
  it("derives initial loading while the first critical pull is in flight", () => {
    expect(resolve({
      criticalInFlight: true,
      criticalAffectsLoading: true,
    })).toEqual({
      phase: "initial-loading",
      loading: true,
      initialLoading: true,
      refreshing: false,
    })
  })

  it("derives refreshing while a cached critical pull is in flight", () => {
    expect(resolve({
      cachedRows: 5,
      criticalInFlight: true,
      criticalAffectsLoading: true,
    })).toEqual({
      phase: "refreshing",
      loading: true,
      initialLoading: false,
      refreshing: true,
    })
  })

  it("keeps invalidation separate from public loading when it does not affect loading", () => {
    expect(resolve({
      cachedRows: 5,
      criticalInFlight: true,
      criticalAffectsLoading: false,
      backgroundInFlight: true,
      invalidating: true,
    })).toEqual({
      phase: "invalidating",
      loading: false,
      initialLoading: false,
      refreshing: false,
    })
  })

  it("tracks background prefetch without setting public loading flags", () => {
    expect(resolve({
      cachedRows: 5,
      backgroundInFlight: true,
    })).toEqual({
      phase: "prefetching",
      loading: false,
      initialLoading: false,
      refreshing: false,
    })
  })

  it("tracks optimistic mutation until the commit settles successfully", () => {
    expect(resolve({
      cachedRows: 5,
      optimisticMutating: true,
    }).phase).toBe("optimistic-mutating")

    expect(resolve({ cachedRows: 5 }).phase).toBe("idle")
  })

  it("moves optimistic rejects and failures into error recovery after rollback", () => {
    expect(resolve({
      cachedRows: 5,
      error: new Error("commit failed"),
    })).toEqual({
      phase: "error",
      loading: false,
      initialLoading: false,
      refreshing: false,
    })
  })

  it("tracks stale-retained rows after cache replacement", () => {
    expect(resolve({
      cachedRows: 5,
      staleRetainedRows: 2,
    })).toEqual({
      phase: "stale-retained",
      loading: false,
      initialLoading: false,
      refreshing: false,
    })
  })

  it("settles back to idle after pull completion clears transient work", () => {
    expect(resolve({ cachedRows: 5 })).toEqual({
      phase: "idle",
      loading: false,
      initialLoading: false,
      refreshing: false,
    })
  })

  it("forces idle flags after dispose even if transient work was active", () => {
    expect(resolve({
      cachedRows: 5,
      criticalInFlight: true,
      criticalAffectsLoading: true,
      backgroundInFlight: true,
      invalidating: true,
      optimisticMutating: true,
      staleRetainedRows: 3,
      error: new Error("stale"),
      disposed: true,
    })).toEqual({
      phase: "idle",
      loading: false,
      initialLoading: false,
      refreshing: false,
    })
  })
})
