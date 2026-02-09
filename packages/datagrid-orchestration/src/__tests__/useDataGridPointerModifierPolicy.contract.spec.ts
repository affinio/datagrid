import { describe, expect, it } from "vitest"
import { useDataGridPointerModifierPolicy } from "../useDataGridPointerModifierPolicy"

describe("useDataGridPointerModifierPolicy contract", () => {
  it("treats alt/ctrl/meta as range-move modifier", () => {
    const policy = useDataGridPointerModifierPolicy()
    expect(policy.isRangeMoveModifierActive({ altKey: true, ctrlKey: false, metaKey: false } as KeyboardEvent)).toBe(true)
    expect(policy.isRangeMoveModifierActive({ altKey: false, ctrlKey: true, metaKey: false } as KeyboardEvent)).toBe(true)
    expect(policy.isRangeMoveModifierActive({ altKey: false, ctrlKey: false, metaKey: true } as KeyboardEvent)).toBe(true)
    expect(policy.isRangeMoveModifierActive({ altKey: false, ctrlKey: false, metaKey: false } as KeyboardEvent)).toBe(false)
  })
})

