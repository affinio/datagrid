import { describe, expect, it } from "vitest"
import {
  normalizeColumnPinInput,
  resolveColumnPinPosition,
  type ColumnPinNormalizationInput,
} from "../columnPinNormalization"

function resolve(input: ColumnPinNormalizationInput) {
  return resolveColumnPinPosition(input)
}

describe("column pin normalization contract", () => {
  it("prefers canonical pin over legacy fields", () => {
    expect(resolve({ pin: "left", sticky: "right", pinned: "right" })).toBe("left")
    expect(resolve({ pin: "right", stickyLeft: true, locked: true })).toBe("right")
    expect(resolve({ pin: "none", pinned: "left", sticky: "left" })).toBe("none")
  })

  it("maps legacy pin permutations into canonical positions", () => {
    expect(resolve({ pinned: true })).toBe("left")
    expect(resolve({ pinned: "left" })).toBe("left")
    expect(resolve({ pinned: "right" })).toBe("right")
    expect(resolve({ lock: "left" })).toBe("left")
    expect(resolve({ lock: "right" })).toBe("right")
    expect(resolve({ locked: true })).toBe("left")
    expect(resolve({ sticky: "left" })).toBe("left")
    expect(resolve({ sticky: "right" })).toBe("right")
    expect(resolve({ stickyLeft: true })).toBe("left")
    expect(resolve({ stickyRight: true })).toBe("right")
    expect(resolve({ stickyLeft: 24 })).toBe("left")
    expect(resolve({ stickyRight: 16 })).toBe("right")
  })

  it("forces system columns to left and strips legacy fields after normalization", () => {
    const normalized = normalizeColumnPinInput({
      key: "priority",
      isSystem: true,
      pin: "right",
      pinned: "right",
      sticky: "right",
      stickyLeft: true,
      stickyRight: true,
      lock: "right",
      locked: true,
    })

    expect(normalized.pin).toBe("left")
    expect("pinned" in normalized).toBe(false)
    expect("sticky" in normalized).toBe(false)
    expect("stickyLeft" in normalized).toBe(false)
    expect("stickyRight" in normalized).toBe(false)
    expect("lock" in normalized).toBe(false)
    expect("locked" in normalized).toBe(false)
  })

  it("defaults to none when pinning is absent", () => {
    expect(resolve({})).toBe("none")
    expect(resolve({ pin: "unexpected" })).toBe("none")
  })
})
