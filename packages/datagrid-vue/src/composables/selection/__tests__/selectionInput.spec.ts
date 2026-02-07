import { describe, expect, it } from "vitest"
import { toSelectionPointerCoordinates } from "../selectionInput"

describe("selectionInput", () => {
  it("maps mouse event coordinates into pointer payload", () => {
    const payload = toSelectionPointerCoordinates({ clientX: 128, clientY: 64 })
    expect(payload).toEqual({ clientX: 128, clientY: 64 })
  })
})
