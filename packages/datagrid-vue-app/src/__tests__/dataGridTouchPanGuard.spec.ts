import { describe, expect, it, vi } from "vitest"
import { installDataGridTouchPanGuard, resolveDataGridTouchPanAxis } from "../gestures/dataGridTouchPanGuard"

function defineScrollMetrics(element: HTMLElement, metrics: {
  scrollHeight: number
  clientHeight: number
  scrollWidth?: number
  clientWidth?: number
}): void {
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: metrics.scrollHeight,
  })
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: metrics.clientHeight,
  })
  Object.defineProperty(element, "scrollWidth", {
    configurable: true,
    value: metrics.scrollWidth ?? 0,
  })
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: metrics.clientWidth ?? 0,
  })
}

function createTouchEvent(type: string, touch: { identifier?: number; clientX: number; clientY: number }): TouchEvent {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as TouchEvent
  Object.defineProperty(event, "touches", {
    configurable: true,
    value: [{
      identifier: touch.identifier ?? 1,
      clientX: touch.clientX,
      clientY: touch.clientY,
    }],
  })
  return event
}

describe("dataGridTouchPanGuard", () => {
  it("locks vertical gestures to the y axis", () => {
    expect(resolveDataGridTouchPanAxis({
      deltaX: 10,
      deltaY: 30,
      maxScrollLeft: 400,
      maxScrollTop: 1200,
    })).toBe("y")
  })

  it("locks diagonal horizontal-dominant gestures to the x axis", () => {
    expect(resolveDataGridTouchPanAxis({
      deltaX: 42,
      deltaY: 26,
      maxScrollLeft: 400,
      maxScrollTop: 1200,
    })).toBe("x")
  })

  it("locks diagonal vertical-dominant gestures to the y axis", () => {
    expect(resolveDataGridTouchPanAxis({
      deltaX: 26,
      deltaY: 42,
      maxScrollLeft: 400,
      maxScrollTop: 1200,
    })).toBe("y")
  })

  it("locks to x when only horizontal scrolling is available", () => {
    expect(resolveDataGridTouchPanAxis({
      deltaX: 24,
      deltaY: 3,
      maxScrollLeft: 400,
      maxScrollTop: 0,
    })).toBe("x")
  })

  it("locks to y when only vertical scrolling is available", () => {
    expect(resolveDataGridTouchPanAxis({
      deltaX: 24,
      deltaY: 3,
      maxScrollLeft: 0,
      maxScrollTop: 1200,
    })).toBe("y")
  })

  it("does not claim tiny gestures before lock distance", () => {
    expect(resolveDataGridTouchPanAxis({
      deltaX: 3,
      deltaY: 4,
      maxScrollLeft: 400,
      maxScrollTop: 1200,
    })).toBeNull()
  })

  it("ignores gestures when the container is not scrollable", () => {
    expect(resolveDataGridTouchPanAxis({
      deltaX: 18,
      deltaY: 1,
      maxScrollLeft: 0,
      maxScrollTop: 0,
    })).toBeNull()
  })

  it("uses passive listeners for non-canceling touch lifecycle events", () => {
    const root = document.createElement("div")
    const addEventListener = vi.spyOn(root, "addEventListener")

    const teardown = installDataGridTouchPanGuard({
      root,
      resolveScrollContainers: () => [],
    })

    expect(addEventListener).toHaveBeenCalledWith("touchstart", expect.any(Function), { capture: true, passive: true })
    expect(addEventListener).toHaveBeenCalledWith("touchend", expect.any(Function), { capture: true, passive: true })
    expect(addEventListener).toHaveBeenCalledWith("touchcancel", expect.any(Function), { capture: true, passive: true })
    expect(addEventListener).not.toHaveBeenCalledWith("touchmove", expect.any(Function), { capture: true, passive: false })

    teardown()
  })

  it("routes a handled external touch pan into the resolved scroll container", () => {
    const root = document.createElement("div")
    const pinnedPane = document.createElement("div")
    const scrollContainer = document.createElement("div")
    root.append(pinnedPane)
    defineScrollMetrics(scrollContainer, {
      scrollHeight: 1200,
      clientHeight: 200,
    })
    scrollContainer.scrollTop = 100
    const addEventListener = vi.spyOn(root, "addEventListener")
    const removeEventListener = vi.spyOn(root, "removeEventListener")

    const teardown = installDataGridTouchPanGuard({
      root,
      resolveScrollContainers: () => [scrollContainer],
      shouldHandleTarget: target => target === pinnedPane,
    })

    pinnedPane.dispatchEvent(createTouchEvent("touchstart", { clientX: 20, clientY: 100 }))
    expect(addEventListener).toHaveBeenCalledWith("touchmove", expect.any(Function), { capture: true, passive: false })

    const moveEvent = createTouchEvent("touchmove", { clientX: 20, clientY: 50 })
    pinnedPane.dispatchEvent(moveEvent)

    expect(moveEvent.defaultPrevented).toBe(true)
    expect(scrollContainer.scrollTop).toBe(150)

    pinnedPane.dispatchEvent(createTouchEvent("touchend", { clientX: 20, clientY: 50 }))
    expect(removeEventListener).toHaveBeenCalledWith("touchmove", expect.any(Function), true)

    teardown()
  })

  it("selects the scroll container by locked pan axis", () => {
    const root = document.createElement("div")
    const header = document.createElement("div")
    const verticalContainer = document.createElement("div")
    const horizontalContainer = document.createElement("div")
    root.append(header)
    defineScrollMetrics(verticalContainer, {
      scrollHeight: 1200,
      clientHeight: 200,
      scrollWidth: 200,
      clientWidth: 200,
    })
    defineScrollMetrics(horizontalContainer, {
      scrollHeight: 200,
      clientHeight: 200,
      scrollWidth: 1200,
      clientWidth: 200,
    })
    verticalContainer.scrollTop = 100
    horizontalContainer.scrollLeft = 100

    const teardown = installDataGridTouchPanGuard({
      root,
      resolveScrollContainers: () => [verticalContainer, horizontalContainer],
      shouldHandleTarget: target => target === header,
    })

    header.dispatchEvent(createTouchEvent("touchstart", { clientX: 100, clientY: 20 }))
    const moveEvent = createTouchEvent("touchmove", { clientX: 50, clientY: 20 })
    header.dispatchEvent(moveEvent)

    expect(moveEvent.defaultPrevented).toBe(true)
    expect(horizontalContainer.scrollLeft).toBe(150)
    expect(verticalContainer.scrollTop).toBe(100)

    teardown()
  })

  it("does not cancel non-cancelable routed touchmove events", () => {
    const root = document.createElement("div")
    const pinnedPane = document.createElement("div")
    const scrollContainer = document.createElement("div")
    root.append(pinnedPane)
    defineScrollMetrics(scrollContainer, {
      scrollHeight: 1200,
      clientHeight: 200,
    })
    scrollContainer.scrollTop = 100

    const teardown = installDataGridTouchPanGuard({
      root,
      resolveScrollContainers: () => [scrollContainer],
      shouldHandleTarget: target => target === pinnedPane,
    })

    pinnedPane.dispatchEvent(createTouchEvent("touchstart", { clientX: 20, clientY: 100 }))
    const moveEvent = createTouchEvent("touchmove", { clientX: 20, clientY: 50 })
    Object.defineProperty(moveEvent, "cancelable", {
      configurable: true,
      value: false,
    })
    pinnedPane.dispatchEvent(moveEvent)

    expect(moveEvent.defaultPrevented).toBe(false)
    expect(scrollContainer.scrollTop).toBe(100)

    teardown()
  })

  it("does not install the canceling touchmove listener for ignored targets", () => {
    const root = document.createElement("div")
    const nativeViewport = document.createElement("div")
    root.append(nativeViewport)
    const addEventListener = vi.spyOn(root, "addEventListener")

    const teardown = installDataGridTouchPanGuard({
      root,
      resolveScrollContainers: () => [],
      shouldHandleTarget: () => false,
    })

    nativeViewport.dispatchEvent(createTouchEvent("touchstart", { clientX: 20, clientY: 100 }))

    expect(addEventListener).not.toHaveBeenCalledWith("touchmove", expect.any(Function), { capture: true, passive: false })

    teardown()
  })
})
