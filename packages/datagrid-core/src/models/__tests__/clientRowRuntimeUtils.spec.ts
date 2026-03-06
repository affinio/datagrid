import { describe, expect, it } from "vitest"
import { applyRowDataPatch } from "../clientRowRuntimeUtils"

describe("clientRowRuntimeUtils.applyRowDataPatch", () => {
  it("returns original reference for empty patch or identical values", () => {
    const current = { id: 1, score: 10 }
    const emptyPatched = applyRowDataPatch(current, {})
    const sameValuePatched = applyRowDataPatch(current, { score: 10 })

    expect(emptyPatched).toBe(current)
    expect(sameValuePatched).toBe(current)
  })

  it("preserves prototype and accessor descriptors when patch changes values", () => {
    const current = Object.create(
      { kind: "row-proto" },
      {
        base: {
          value: 5,
          writable: true,
          enumerable: true,
          configurable: true,
        },
        doubled: {
          enumerable: true,
          configurable: true,
          get() {
            return this.base * 2
          },
        },
      },
    ) as { base: number; doubled: number }

    const next = applyRowDataPatch(current, { base: 7 })

    expect(next).not.toBe(current)
    expect(Object.getPrototypeOf(next)).toBe(Object.getPrototypeOf(current))
    const doubledDescriptor = Object.getOwnPropertyDescriptor(next, "doubled")
    expect(typeof doubledDescriptor?.get).toBe("function")
    expect(next.base).toBe(7)
    expect(next.doubled).toBe(14)
  })
})
