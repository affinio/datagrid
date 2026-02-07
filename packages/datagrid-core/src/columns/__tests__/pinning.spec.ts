import { describe, expect, it } from "vitest"
import { resolveCanonicalPinMode } from "../pinning"

describe("resolveCanonicalPinMode", () => {
  it("resolves canonical pin states and defaults to none", () => {
    expect(resolveCanonicalPinMode({ pin: "left" })).toBe("left")
    expect(resolveCanonicalPinMode({ pin: "right" })).toBe("right")
    expect(resolveCanonicalPinMode({ pin: "none" })).toBe("none")
    expect(resolveCanonicalPinMode({ pin: "unexpected" })).toBe("none")
    expect(resolveCanonicalPinMode({})).toBe("none")
  })

  it("forces system columns to left regardless of user pin value", () => {
    expect(resolveCanonicalPinMode({ isSystem: true, pin: "right" })).toBe("left")
    expect(resolveCanonicalPinMode({ isSystem: true, pin: "none" })).toBe("left")
  })

  it("ignores legacy pin fields by contract", () => {
    const legacyPayload = {
      pinned: "left",
      sticky: "right",
      stickyLeft: true,
      lock: "left",
      locked: true,
    }
    expect(resolveCanonicalPinMode(legacyPayload)).toBe("none")
  })
})
