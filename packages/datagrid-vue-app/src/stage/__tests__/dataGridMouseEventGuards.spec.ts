import { describe, expect, it } from "vitest"
import {
  resolveDataGridInteractionMode,
  shouldPrioritizeNativeScrollForMouseDown,
} from "../dataGridMouseEventGuards"

function createMouseDown({ firesTouchEvents = false, pointerType }: { firesTouchEvents?: boolean; pointerType?: string } = {}): MouseEvent {
  const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true })
  Object.defineProperty(event, "sourceCapabilities", {
    configurable: true,
    value: { firesTouchEvents },
  })
  if (pointerType) {
    Object.defineProperty(event, "pointerType", {
      configurable: true,
      value: pointerType,
    })
  }
  return event
}

describe("stage dataGridMouseEventGuards", () => {
  it("resolves auto interaction mode from coarse pointer state", () => {
    expect(resolveDataGridInteractionMode({ interactionMode: "auto", isCoarsePointer: false })).toBe("desktop")
    expect(resolveDataGridInteractionMode({ interactionMode: "auto", isCoarsePointer: true })).toBe("touch")
    expect(resolveDataGridInteractionMode({ interactionMode: "desktop", isCoarsePointer: true })).toBe("desktop")
    expect(resolveDataGridInteractionMode({ interactionMode: "touch", isCoarsePointer: false })).toBe("touch")
  })

  it("prioritizes native scroll only for touch-generated mouse events in touch mode", () => {
    expect(shouldPrioritizeNativeScrollForMouseDown(createMouseDown({ firesTouchEvents: true }), {
      interactionMode: "touch",
    })).toBe(true)
    expect(shouldPrioritizeNativeScrollForMouseDown(createMouseDown({ firesTouchEvents: true }), {
      interactionMode: "desktop",
    })).toBe(false)
    expect(shouldPrioritizeNativeScrollForMouseDown(createMouseDown({ firesTouchEvents: true }), {
      interactionMode: "auto",
      isCoarsePointer: false,
    })).toBe(true)
    expect(shouldPrioritizeNativeScrollForMouseDown(createMouseDown(), {
      interactionMode: "touch",
    })).toBe(false)
    expect(shouldPrioritizeNativeScrollForMouseDown(createMouseDown({ pointerType: "touch" }), {
      interactionMode: "touch",
    })).toBe(true)
  })
})
