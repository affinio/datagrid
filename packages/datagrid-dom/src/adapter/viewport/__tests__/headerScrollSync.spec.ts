import { afterEach, describe, expect, it, vi } from "vitest"
import { createHeaderScrollSync } from "../headerScrollSync.js"

function createHarness(pinnedWidths?: { left: number; right: number }, withPinnedBottom = false) {
  const grid = document.createElement("div")
  grid.innerHTML = `<div class="affino-grid-dom__header-viewport"></div><div class="affino-grid-dom__body"></div>${withPinnedBottom ? '<div class="affino-grid-dom__pinned-bottom"></div>' : ""}`
  if (pinnedWidths) {
    grid.style.setProperty("--affino-grid-dom-pinned-left-width", `${pinnedWidths.left}px`)
    grid.style.setProperty("--affino-grid-dom-pinned-right-width", `${pinnedWidths.right}px`)
  }
  const [header, body] = [...grid.children] as HTMLElement[]
  Object.defineProperties(body!, {
    clientWidth: { configurable: true, value: 300 },
    scrollWidth: { configurable: true, value: 1200 },
    clientHeight: { configurable: true, value: 200 },
    scrollHeight: { configurable: true, value: 800 },
  })
  const sync = createHeaderScrollSync(grid)
  sync.attach()
  const wheel = (target: HTMLElement, deltaX: number, options: WheelEventInit = {}) => {
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX, ...options })
    target.dispatchEvent(event)
    return event
  }
  return { grid, body: body!, header: header!, pinnedBottom: grid.querySelector<HTMLElement>(".affino-grid-dom__pinned-bottom"), sync, wheel }
}

afterEach(() => vi.unstubAllGlobals())

describe("header/body horizontal scroll ownership", () => {
  it("moves both surfaces in the wheel task, before a native scroll notification", () => {
    const { body, header, sync, wheel } = createHarness()
    expect(wheel(body, 36).defaultPrevented).toBe(true)
    expect([body.scrollLeft, header.scrollLeft]).toEqual([36, 36])
    expect(wheel(header, 20).defaultPrevented).toBe(true)
    expect([body.scrollLeft, header.scrollLeft]).toEqual([56, 56])
    sync.detach()
  })

  it("normalizes line/page wheel units and retains horizontal boundary ownership", () => {
    const { body, header, sync, wheel } = createHarness()
    wheel(body, 2, { deltaMode: 1 })
    expect([body.scrollLeft, header.scrollLeft]).toEqual([32, 32])
    wheel(header, 1, { deltaMode: 2 })
    expect([body.scrollLeft, header.scrollLeft]).toEqual([332, 332])
    wheel(body, 2000)
    expect([body.scrollLeft, header.scrollLeft]).toEqual([900, 900])
    expect(wheel(header, 40).defaultPrevented).toBe(true)
    sync.detach()
  })

  it("preserves native vertical/zoom gestures and removes wheel listeners on detach", () => {
    const { body, header, sync, wheel } = createHarness()
    expect(wheel(body, 10, { deltaY: 40 }).defaultPrevented).toBe(false)
    expect(wheel(header, 40, { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(body.scrollLeft).toBe(0)
    sync.detach()
    expect(wheel(body, 40).defaultPrevented).toBe(false)
    expect(wheel(header, 40).defaultPrevented).toBe(false)
    expect(body.scrollLeft).toBe(0)
  })

  it("updates header width on resize and disconnects its observer", () => {
    let resize: (() => void) | undefined
    const disconnect = vi.fn()
    const observe = vi.fn()
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resize = callback }
      observe = observe
      disconnect = disconnect
    })
    const { body, grid, sync } = createHarness()
    expect(observe).toHaveBeenCalledWith(body)
    expect(grid.style.getPropertyValue("--affino-grid-dom-viewport-width")).toBe("300px")
    Object.defineProperty(body, "clientWidth", { configurable: true, value: 280 })
    resize?.()
    expect(grid.style.getPropertyValue("--affino-grid-dom-viewport-width")).toBe("280px")
    sync.detach()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it("sizes the center header viewport after reserving both pinned panes", () => {
    const { grid, sync } = createHarness({ left: 80, right: 60 })
    expect(grid.style.getPropertyValue("--affino-grid-dom-viewport-width")).toBe("160px")
    sync.detach()
  })

  it("keeps the pinned-bottom lane horizontally aligned with the body and header", () => {
    const { body, header, pinnedBottom, sync } = createHarness(undefined, true)
    pinnedBottom!.scrollLeft = 88
    pinnedBottom!.dispatchEvent(new Event("scroll"))
    expect([body.scrollLeft, header.scrollLeft, pinnedBottom!.scrollLeft]).toEqual([88, 88, 88])

    body.scrollLeft = 144
    body.dispatchEvent(new Event("scroll"))
    expect([body.scrollLeft, header.scrollLeft, pinnedBottom!.scrollLeft]).toEqual([144, 144, 144])
    sync.detach()
  })
})
