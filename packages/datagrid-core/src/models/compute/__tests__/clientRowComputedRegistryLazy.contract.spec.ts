import { describe, expect, it, vi } from "vitest"
import {
  createLazyClientRowComputedRegistryRuntime,
  type ClientRowComputedRegistryRuntime,
} from "../clientRowComputedRegistryRuntime"

describe("lazy computed registry contract", () => {
  it("does not initialize for plain capability checks or dispose", () => {
    const factory = vi.fn(() => ({
      hasComputedFields: () => false,
      hasFormulaFields: () => false,
      clear: vi.fn(),
    } as unknown as ClientRowComputedRegistryRuntime<unknown>))
    const registry = createLazyClientRowComputedRegistryRuntime(factory)

    expect(registry.hasComputedFields()).toBe(false)
    expect(registry.hasFormulaFields()).toBe(false)
    registry.clear()
    expect(factory).not.toHaveBeenCalled()
  })

  it("initializes exactly once at the first non-trivial capability call", () => {
    const clear = vi.fn()
    const factory = vi.fn(() => ({
      hasComputedFields: () => true,
      hasFormulaFields: () => false,
      getComputedFields: () => [],
      clear,
    } as unknown as ClientRowComputedRegistryRuntime<unknown>))
    const registry = createLazyClientRowComputedRegistryRuntime(factory)

    expect(registry.getComputedFields()).toEqual([])
    expect(factory).toHaveBeenCalledTimes(1)
    registry.clear()
    registry.clear()
    expect(factory).toHaveBeenCalledTimes(1)
    expect(clear).toHaveBeenCalledTimes(2)
  })
})
