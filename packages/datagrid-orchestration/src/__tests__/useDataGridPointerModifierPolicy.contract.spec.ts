import { describe, expect, it } from "vitest"
import { useDataGridPointerModifierPolicy } from "../pointer/useDataGridPointerModifierPolicy"

describe("useDataGridPointerModifierPolicy contract", () => {
  it("treats only alt as range-move modifier so ctrl/cmd remain available for additive selection", () => {
    const policy = useDataGridPointerModifierPolicy()
    expect(policy.isRangeMoveModifierActive({ altKey: true, ctrlKey: false, metaKey: false } as KeyboardEvent)).toBe(true)
    expect(policy.isRangeMoveModifierActive({ altKey: false, ctrlKey: true, metaKey: false } as KeyboardEvent)).toBe(false)
    expect(policy.isRangeMoveModifierActive({ altKey: false, ctrlKey: false, metaKey: true } as KeyboardEvent)).toBe(false)
    expect(policy.isRangeMoveModifierActive({ altKey: false, ctrlKey: false, metaKey: false } as KeyboardEvent)).toBe(false)
  })
})

