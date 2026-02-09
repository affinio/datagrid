import { describe, expect, it } from "vitest"
import { useDataGridClipboardValuePolicy } from "../useDataGridClipboardValuePolicy"

describe("useDataGridClipboardValuePolicy contract", () => {
  it("normalizes nullish values to empty string", () => {
    const policy = useDataGridClipboardValuePolicy()
    expect(policy.normalizeClipboardValue(undefined)).toBe("")
    expect(policy.normalizeClipboardValue(null)).toBe("")
  })

  it("stringifies primitive values", () => {
    const policy = useDataGridClipboardValuePolicy()
    expect(policy.normalizeClipboardValue(42)).toBe("42")
    expect(policy.normalizeClipboardValue(true)).toBe("true")
    expect(policy.normalizeClipboardValue("ok")).toBe("ok")
  })

  it("stringifies objects via String()", () => {
    const policy = useDataGridClipboardValuePolicy()
    expect(policy.normalizeClipboardValue({ a: 1 })).toBe("[object Object]")
  })
})
