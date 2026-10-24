import { describe, expect, it } from "vitest"
import { validateClipboardValue } from "../clipboardController.js"

describe("DOM clipboard value validation", () => {
  it("uses the Core column parser and constraints", () => {
    const column = { key: "amount", cellType: "number", constraints: { min: 0, max: 10 } }
    expect(validateClipboardValue("5", 1, column, { amount: 1 })).toEqual({ ok: true, value: 5 })
    expect(validateClipboardValue("500", 1, column, { amount: 1 })).toEqual({ ok: false })
  })
})
