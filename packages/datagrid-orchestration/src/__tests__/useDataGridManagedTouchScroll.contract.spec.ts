import { describe, expect, it, vi } from "vitest"
import { useDataGridManagedTouchScroll } from "../useDataGridManagedTouchScroll"
import { useDataGridManagedWheelScroll } from "../useDataGridManagedWheelScroll"

function createTouch(identifier: number, clientX: number, clientY: number): Touch {
  return { identifier, clientX, clientY } as unknown as Touch
}

function createTouchList(touches: Touch[]): TouchList {
  return {
    length: touches.length,
    item(index: number): Touch | null {
      return touches[index] ?? null
    },
  } as TouchList
}

describe("useDataGridManagedTouchScroll contract", () => {
  it("applies vertical touch pan to body viewport", () => {
    const state = { top: 10, left: 0 }
    const lifecycle = useDataGridManagedTouchScroll({
      resolveBodyViewport: () => ({ scrollTop: state.top, scrollHeight: 1000, clientHeight: 200 }),
      resolveMainViewport: () => ({ scrollLeft: state.left, scrollWidth: 1000, clientWidth: 300 }),
      setHandledScrollTop(value) {
        state.top = value
      },
      setHandledScrollLeft(value) {
        state.left = value
      },
    })

    const target = document.createElement("div")
    lifecycle.onTouchStart({
      touches: createTouchList([createTouch(1, 100, 100)]),
      changedTouches: createTouchList([createTouch(1, 100, 100)]),
      target,
    } as unknown as TouchEvent)

    const moveEvent = {
      touches: createTouchList([createTouch(1, 100, 80)]),
      changedTouches: createTouchList([createTouch(1, 100, 80)]),
      target,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as TouchEvent

    lifecycle.onTouchMove(moveEvent)

    expect(state.top).toBe(30)
    expect(moveEvent.preventDefault).toHaveBeenCalledTimes(1)
  })

  it("applies horizontal touch pan with horizontal-preferred axis lock", () => {
    const state = { top: 10, left: 40 }
    const lifecycle = useDataGridManagedTouchScroll({
      resolveTouchAxisLockMode: () => "horizontal-preferred",
      resolveBodyViewport: () => ({ scrollTop: state.top, scrollHeight: 1000, clientHeight: 200 }),
      resolveMainViewport: () => ({ scrollLeft: state.left, scrollWidth: 1000, clientWidth: 300 }),
      setHandledScrollTop(value) {
        state.top = value
      },
      setHandledScrollLeft(value) {
        state.left = value
      },
    })

    const target = document.createElement("div")
    lifecycle.onTouchStart({
      touches: createTouchList([createTouch(1, 100, 100)]),
      changedTouches: createTouchList([createTouch(1, 100, 100)]),
      target,
    } as unknown as TouchEvent)

    lifecycle.onTouchMove({
      touches: createTouchList([createTouch(1, 80, 94)]),
      changedTouches: createTouchList([createTouch(1, 80, 94)]),
      target,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as TouchEvent)

    expect(state.left).toBe(60)
    expect(state.top).toBe(10)
  })

  it("keeps ownership released at boundary when unconsumed", () => {
    const state = { top: 0, left: 0 }
    const lifecycle = useDataGridManagedTouchScroll({
      resolveTouchPropagationMode: () => "release-at-boundary-when-unconsumed",
      resolveBodyViewport: () => ({ scrollTop: state.top, scrollHeight: 1000, clientHeight: 200 }),
      setHandledScrollTop(value) {
        state.top = value
      },
    })

    const target = document.createElement("div")
    lifecycle.onTouchStart({
      touches: createTouchList([createTouch(1, 100, 100)]),
      changedTouches: createTouchList([createTouch(1, 100, 100)]),
      target,
    } as unknown as TouchEvent)

    const moveEvent = {
      touches: createTouchList([createTouch(1, 100, 120)]),
      changedTouches: createTouchList([createTouch(1, 100, 120)]),
      target,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as TouchEvent

    lifecycle.onTouchMove(moveEvent)

    expect(state.top).toBe(0)
    expect(moveEvent.preventDefault).not.toHaveBeenCalled()
    expect(moveEvent.stopPropagation).not.toHaveBeenCalled()
  })

  it("ignores multi-touch gestures", () => {
    const state = { top: 50 }
    const lifecycle = useDataGridManagedTouchScroll({
      resolveBodyViewport: () => ({ scrollTop: state.top, scrollHeight: 1000, clientHeight: 200 }),
      setHandledScrollTop(value) {
        state.top = value
      },
    })

    const target = document.createElement("div")
    lifecycle.onTouchStart({
      touches: createTouchList([createTouch(1, 100, 100), createTouch(2, 120, 100)]),
      changedTouches: createTouchList([createTouch(1, 100, 100), createTouch(2, 120, 100)]),
      target,
    } as unknown as TouchEvent)

    const moveEvent = {
      touches: createTouchList([createTouch(1, 90, 80), createTouch(2, 110, 80)]),
      changedTouches: createTouchList([createTouch(1, 90, 80), createTouch(2, 110, 80)]),
      target,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as TouchEvent

    lifecycle.onTouchMove(moveEvent)

    expect(state.top).toBe(50)
    expect(moveEvent.preventDefault).not.toHaveBeenCalled()
  })

  it("ignores editable targets", () => {
    const state = { top: 50 }
    const lifecycle = useDataGridManagedTouchScroll({
      resolveBodyViewport: () => ({ scrollTop: state.top, scrollHeight: 1000, clientHeight: 200 }),
      setHandledScrollTop(value) {
        state.top = value
      },
    })

    const input = document.createElement("input")
    lifecycle.onTouchStart({
      touches: createTouchList([createTouch(1, 100, 100)]),
      changedTouches: createTouchList([createTouch(1, 100, 100)]),
      target: input,
    } as unknown as TouchEvent)

    lifecycle.onTouchMove({
      touches: createTouchList([createTouch(1, 100, 80)]),
      changedTouches: createTouchList([createTouch(1, 100, 80)]),
      target: input,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as TouchEvent)

    expect(state.top).toBe(50)
  })

  it("keeps managed wheel behavior after shared pipeline refactor", () => {
    const state = { top: 10 }
    const lifecycle = useDataGridManagedWheelScroll({
      resolveBodyViewport: () => ({ scrollTop: state.top, scrollHeight: 1000, clientHeight: 200 }),
      setHandledScrollTop(value) {
        state.top = value
      },
    })

    const event = {
      deltaX: 0,
      deltaY: 30,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent

    lifecycle.onBodyViewportWheel(event)

    expect(state.top).toBe(40)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })
})
