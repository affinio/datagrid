import { describe, expect, it, vi } from "vitest"
import { createClientRowRefreshHostRuntime } from "../host/clientRowRefreshHostRuntime.js"

describe("createClientRowRefreshHostRuntime", () => {
  it("bootstraps initial rows projection through compute stage fallback", () => {
    const setProjectionInvalidation = vi.fn()
    const recomputeFromComputeStage = vi.fn()
    const runtime = createClientRowRefreshHostRuntime({
      ensureActive: vi.fn(),
      setProjectionInvalidation,
      tryApplyFlatIdentityProjectionRefresh: () => false,
      refreshComputeHost: vi.fn(),
      recomputeFromComputeStage,
      emit: vi.fn(),
    })

    runtime.bootstrapInitialProjection()

    expect(setProjectionInvalidation).toHaveBeenCalledWith(["rowsChanged"])
    expect(recomputeFromComputeStage).toHaveBeenCalledTimes(1)
  })

  it("maps manual refresh to compute refresh and emits", () => {
    const setProjectionInvalidation = vi.fn()
    const refreshComputeHost = vi.fn()
    const emit = vi.fn()
    const runtime = createClientRowRefreshHostRuntime({
      ensureActive: vi.fn(),
      setProjectionInvalidation,
      tryApplyFlatIdentityProjectionRefresh: () => false,
      refreshComputeHost,
      recomputeFromComputeStage: vi.fn(),
      emit,
    })

    runtime.refresh("manual")

    expect(setProjectionInvalidation).toHaveBeenCalledWith(["manualRefresh"])
    expect(refreshComputeHost).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledTimes(1)
  })

  it("maps sort-change refresh without compute fallback when flat identity refresh applies", () => {
    const setProjectionInvalidation = vi.fn()
    const refreshComputeHost = vi.fn()
    const runtime = createClientRowRefreshHostRuntime({
      ensureActive: vi.fn(),
      setProjectionInvalidation,
      tryApplyFlatIdentityProjectionRefresh: () => true,
      refreshComputeHost,
      recomputeFromComputeStage: vi.fn(),
      emit: vi.fn(),
    })

    runtime.refresh("sort-change")

    expect(setProjectionInvalidation).toHaveBeenCalledWith(["sortChanged"])
    expect(refreshComputeHost).not.toHaveBeenCalled()
  })
})
