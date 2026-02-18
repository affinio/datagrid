import { describe, expect, it, vi } from "vitest"
import {
  resolveDataGridWheelPropagationDecision,
  resolveDataGridWheelAxisPolicy,
  useDataGridManagedWheelScroll,
} from "../useDataGridManagedWheelScroll"

describe("useDataGridManagedWheelScroll contract", () => {
  it("uses vertical axis by default on close deltas", () => {
    expect(resolveDataGridWheelAxisPolicy(10, 11, "dominant")).toEqual({ applyX: false, applyY: true })
  })

  it("supports horizontal preferred policy", () => {
    expect(resolveDataGridWheelAxisPolicy(10, 11, "horizontal-preferred")).toEqual({ applyX: true, applyY: false })
  })

  it("supports off policy with both axes", () => {
    expect(resolveDataGridWheelAxisPolicy(8, 12, "off")).toEqual({ applyX: true, applyY: true })
  })

  it("supports propagation decision helper policies", () => {
    const boundaryUnconsumed = {
      handled: false,
      handledX: false,
      handledY: false,
      consumed: false,
      consumedX: false,
      consumedY: false,
      atBoundaryX: true,
      atBoundaryY: false,
    }
    const midScrollConsumed = {
      handled: true,
      handledX: false,
      handledY: true,
      consumed: true,
      consumedX: false,
      consumedY: true,
      atBoundaryX: false,
      atBoundaryY: false,
    }

    expect(resolveDataGridWheelPropagationDecision(boundaryUnconsumed, "retain")).toBe(false)
    expect(resolveDataGridWheelPropagationDecision(boundaryUnconsumed, "release-at-boundary-when-unconsumed")).toBe(true)
    expect(resolveDataGridWheelPropagationDecision(boundaryUnconsumed, "release-when-unconsumed")).toBe(true)
    const handledUnconsumed = {
      handled: true,
      handledX: false,
      handledY: true,
      consumed: false,
      consumedX: false,
      consumedY: false,
      atBoundaryX: false,
      atBoundaryY: false,
    }
    expect(resolveDataGridWheelPropagationDecision(handledUnconsumed, "release-when-unconsumed")).toBe(false)
    expect(resolveDataGridWheelPropagationDecision(midScrollConsumed, "release-when-unconsumed")).toBe(false)
  })

  it("does not consume wheel in native mode", () => {
    const state = {
      top: 0,
      left: 0,
    }
    const bodyViewport = {
      get scrollTop() { return state.top },
      scrollHeight: 1000,
      clientHeight: 200,
    }
    const mainViewport = {
      get scrollLeft() { return state.left },
      scrollWidth: 1000,
      clientWidth: 200,
    }

    const lifecycle = useDataGridManagedWheelScroll({
      resolveWheelMode: () => "native",
      resolveBodyViewport: () => bodyViewport,
      resolveMainViewport: () => mainViewport,
      setHandledScrollTop(value) {
        state.top = value
      },
      setHandledScrollLeft(value) {
        state.left = value
      },
    })

    const event = {
      deltaX: 20,
      deltaY: 20,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent

    lifecycle.onBodyViewportWheel(event)

    expect(state.top).toBe(0)
    expect(state.left).toBe(0)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(event.stopPropagation).not.toHaveBeenCalled()
  })

  it("prevents default only when managed wheel consumed", () => {
    const state = {
      top: 10,
      left: 0,
    }
    const bodyViewport = {
      get scrollTop() { return state.top },
      scrollHeight: 1000,
      clientHeight: 200,
    }
    const mainViewport = {
      get scrollLeft() { return state.left },
      scrollWidth: 1000,
      clientWidth: 200,
    }

    const onWheelConsumed = vi.fn()
    const lifecycle = useDataGridManagedWheelScroll({
      resolveWheelMode: () => "managed",
      resolveBodyViewport: () => bodyViewport,
      resolveMainViewport: () => mainViewport,
      resolvePreventDefaultWhenConsumed: () => true,
      setHandledScrollTop(value) {
        state.top = value
      },
      setHandledScrollLeft(value) {
        state.left = value
      },
      onWheelConsumed,
    })

    const event = {
      deltaX: 0,
      deltaY: 30,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent

    lifecycle.onLinkedViewportWheel(event)

    expect(state.top).toBe(40)
    expect(onWheelConsumed).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.stopPropagation).toHaveBeenCalledTimes(1)
  })

  it("allows propagation on boundary when ownership policy requests release", () => {
    const state = {
      top: 0,
      left: 100,
    }
    const bodyViewport = {
      get scrollTop() { return state.top },
      scrollHeight: 1000,
      clientHeight: 200,
    }
    const mainViewport = {
      get scrollLeft() { return state.left },
      scrollWidth: 1000,
      clientWidth: 200,
    }

    const lifecycle = useDataGridManagedWheelScroll({
      resolveWheelMode: () => "managed",
      resolveWheelAxisLockMode: () => "off",
      resolveBodyViewport: () => bodyViewport,
      resolveMainViewport: () => mainViewport,
      resolveWheelPropagationMode: () => "release-at-boundary-when-unconsumed",
      setHandledScrollTop(value) {
        state.top = value
      },
      setHandledScrollLeft(value) {
        state.left = value
      },
    })

    const event = {
      deltaX: 0,
      deltaY: -30,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent

    lifecycle.onBodyViewportWheel(event)

    expect(state.top).toBe(0)
    expect(state.left).toBe(100)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(event.stopPropagation).not.toHaveBeenCalled()
  })

  it("allows explicit propagation callback to extend mode policy", () => {
    const state = {
      top: 10,
      left: 100,
    }
    const bodyViewport = {
      get scrollTop() { return state.top },
      scrollHeight: 1000,
      clientHeight: 200,
    }
    const mainViewport = {
      get scrollLeft() { return state.left },
      scrollWidth: 1000,
      clientWidth: 200,
    }

    const lifecycle = useDataGridManagedWheelScroll({
      resolveWheelMode: () => "managed",
      resolveWheelAxisLockMode: () => "off",
      resolveBodyViewport: () => bodyViewport,
      resolveMainViewport: () => mainViewport,
      resolveWheelPropagationMode: () => "retain",
      resolveShouldPropagateWheelEvent: () => true,
      setHandledScrollTop(value) {
        state.top = value
      },
      setHandledScrollLeft(value) {
        state.left = value
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
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(event.stopPropagation).not.toHaveBeenCalled()
  })

  it("retains ownership when handled but not consumed in release-when-unconsumed mode", () => {
    const state = { top: 10 }
    const lifecycle = useDataGridManagedWheelScroll({
      resolveWheelMode: () => "managed",
      resolveWheelPropagationMode: () => "release-when-unconsumed",
      resolveMinDeltaToApply: () => 10,
      resolveBodyViewport: () => ({ scrollTop: state.top, scrollHeight: 1000, clientHeight: 200 }),
      setHandledScrollTop(value) {
        state.top = value
      },
    })

    const event = {
      deltaX: 0,
      deltaY: 3,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent

    lifecycle.onBodyViewportWheel(event)

    expect(state.top).toBe(10)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.stopPropagation).toHaveBeenCalledTimes(1)
  })

  it("supports optional stopImmediatePropagation for handled wheel events", () => {
    const state = { top: 10 }
    const lifecycle = useDataGridManagedWheelScroll({
      resolveWheelMode: () => "managed",
      resolveStopImmediatePropagation: () => true,
      resolveBodyViewport: () => ({ scrollTop: state.top, scrollHeight: 1000, clientHeight: 200 }),
      setHandledScrollTop(value) {
        state.top = value
      },
    })

    const event = {
      deltaX: 0,
      deltaY: 12,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    } as unknown as WheelEvent

    lifecycle.onBodyViewportWheel(event)

    expect(state.top).toBe(22)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.stopImmediatePropagation).toHaveBeenCalledTimes(1)
    expect(event.stopPropagation).not.toHaveBeenCalled()
  })

  it("reports boundary status when clamped at top edge", () => {
    const lifecycle = useDataGridManagedWheelScroll({
      resolveBodyViewport: () => ({ scrollTop: 0, scrollHeight: 1000, clientHeight: 200 }),
      setHandledScrollTop: vi.fn(),
    })

    const result = lifecycle.applyWheelToViewports({
      deltaX: 0,
      deltaY: -40,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent)

    expect(result).toEqual({
      handled: false,
      handledX: false,
      handledY: false,
      consumed: false,
      consumedX: false,
      consumedY: false,
      atBoundaryX: false,
      atBoundaryY: true,
    })
  })

  it("reports boundary by raw delta even when smoothing threshold defers movement", () => {
    const lifecycle = useDataGridManagedWheelScroll({
      resolveBodyViewport: () => ({ scrollTop: 0, scrollHeight: 1000, clientHeight: 200 }),
      resolveMinDeltaToApply: () => 50,
      setHandledScrollTop: vi.fn(),
    })

    const result = lifecycle.applyWheelToViewports({
      deltaX: 0,
      deltaY: -5,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent)

    expect(result.atBoundaryY).toBe(true)
    expect(result.handled).toBe(false)
    expect(result.consumed).toBe(false)
  })

  it("supports optional smoothing threshold", () => {
    const state = { top: 10 }
    const lifecycle = useDataGridManagedWheelScroll({
      resolveBodyViewport: () => ({ scrollTop: state.top, scrollHeight: 1000, clientHeight: 200 }),
      resolveMinDeltaToApply: () => 5,
      setHandledScrollTop(value) {
        state.top = value
      },
    })

    lifecycle.applyWheelToViewports({
      deltaX: 0,
      deltaY: 2,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent)
    expect(state.top).toBe(10)

    lifecycle.applyWheelToViewports({
      deltaX: 0,
      deltaY: 4,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent)
    expect(state.top).toBe(16)
  })

  it("marks micro-delta smoothing as handled and prevents default", () => {
    const state = { top: 10 }
    const lifecycle = useDataGridManagedWheelScroll({
      resolveBodyViewport: () => ({ scrollTop: state.top, scrollHeight: 1000, clientHeight: 200 }),
      resolveMinDeltaToApply: () => 8,
      setHandledScrollTop(value) {
        state.top = value
      },
    })

    const event = {
      deltaX: 0,
      deltaY: 3,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent

    lifecycle.onBodyViewportWheel(event)

    expect(state.top).toBe(10)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.stopPropagation).toHaveBeenCalledTimes(1)
  })

  it("resets pending smoothing delta on sign flip", () => {
    const state = { top: 100 }
    const lifecycle = useDataGridManagedWheelScroll({
      resolveBodyViewport: () => ({ scrollTop: state.top, scrollHeight: 1000, clientHeight: 200 }),
      resolveMinDeltaToApply: () => 5,
      setHandledScrollTop(value) {
        state.top = value
      },
    })

    lifecycle.applyWheelToViewports({
      deltaX: 0,
      deltaY: 4,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent)
    expect(state.top).toBe(100)

    lifecycle.applyWheelToViewports({
      deltaX: 0,
      deltaY: -6,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent)

    expect(state.top).toBe(94)
  })

  it("uses custom wheel page size resolver", () => {
    const state = { top: 10 }
    const lifecycle = useDataGridManagedWheelScroll({
      resolveBodyViewport: () => ({ scrollTop: state.top, scrollHeight: 1000, clientHeight: 200 }),
      resolveWheelPageSizeY: () => 50,
      setHandledScrollTop(value) {
        state.top = value
      },
    })

    lifecycle.applyWheelToViewports({
      deltaX: 0,
      deltaY: 1,
      deltaMode: 2,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent)

    expect(state.top).toBe(60)
  })

  it("exposes reset API for pending smoothing state", () => {
    const state = { top: 10 }
    const lifecycle = useDataGridManagedWheelScroll({
      resolveBodyViewport: () => ({ scrollTop: state.top, scrollHeight: 1000, clientHeight: 200 }),
      resolveMinDeltaToApply: () => 10,
      setHandledScrollTop(value) {
        state.top = value
      },
    })

    lifecycle.applyWheelToViewports({
      deltaX: 0,
      deltaY: 6,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent)
    expect(state.top).toBe(10)

    lifecycle.reset()

    lifecycle.applyWheelToViewports({
      deltaX: 0,
      deltaY: 5,
      deltaMode: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent)

    expect(state.top).toBe(10)
  })
})
