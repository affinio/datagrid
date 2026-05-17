import { describe, expect, it } from "vitest"
import {
  resolveDataGridMouseEventPolicy,
  resolveDataGridInteractionMode,
  shouldAllowGridPreventDefaultForMouseEvent,
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

describe("dataGridMouseEventGuards", () => {
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

  it("exposes a prevent-default policy for grid mouse handlers", () => {
    const touchEvent = createMouseDown({ firesTouchEvents: true })
    expect(resolveDataGridMouseEventPolicy(touchEvent, {
      interactionMode: "touch",
    })).toEqual({
      interactionMode: "touch",
      touchGenerated: true,
      nativeScrollPriority: true,
      preventDefaultAllowed: false,
    })
    expect(shouldAllowGridPreventDefaultForMouseEvent(touchEvent, {
      interactionMode: "touch",
    })).toBe(false)
    expect(shouldAllowGridPreventDefaultForMouseEvent(touchEvent, {
      interactionMode: "desktop",
    })).toBe(true)
    expect(shouldAllowGridPreventDefaultForMouseEvent(createMouseDown(), {
      interactionMode: "touch",
    })).toBe(true)
  })
})
