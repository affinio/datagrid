import { describe, expect, it } from "vitest"
import { useDataGridLinkedPaneScrollSync } from "../useDataGridLinkedPaneScrollSync"

describe("useDataGridLinkedPaneScrollSync contract", () => {
  it("applies direct transform sync to linked panes", () => {
    let sourceTop = 24
    const paneA = document.createElement("div")
    const paneB = document.createElement("div")

    const sync = useDataGridLinkedPaneScrollSync({
      resolveSourceScrollTop: () => sourceTop,
      mode: "direct-transform",
      resolvePaneElements: () => [paneA, paneB],
    })

    sync.syncNow()

    expect(paneA.style.transform).toBe("translate3d(0, -24px, 0)")
    expect(paneB.style.transform).toBe("translate3d(0, -24px, 0)")

    sourceTop = 8
    sync.syncNow()
    expect(paneA.style.transform).toBe("translate3d(0, -8px, 0)")
  })

  it("applies css-var mode on host element", () => {
    const host = document.createElement("div")
    const sync = useDataGridLinkedPaneScrollSync({
      resolveSourceScrollTop: () => 12,
      mode: "css-var",
      resolveCssVarHost: () => host,
      cssVarName: "--grid-scroll-top",
    })

    sync.syncNow()

    expect(host.style.getPropertyValue("--grid-scroll-top")).toBe("-12px")

    sync.reset()

    expect(host.style.getPropertyValue("--grid-scroll-top")).toBe("")
  })

  it("batches source scroll updates with onSourceScroll", () => {
    let sourceTop = 0
    const pane = document.createElement("div")
    const frameCallbacks: FrameRequestCallback[] = []

    const sync = useDataGridLinkedPaneScrollSync({
      resolveSourceScrollTop: () => sourceTop,
      mode: "direct-transform",
      resolvePaneElements: () => [pane],
      requestAnimationFrame(callback) {
        frameCallbacks.push(callback)
        return frameCallbacks.length
      },
      cancelAnimationFrame() {
      },
    })

    sourceTop = 10
    sync.onSourceScroll()
    sourceTop = 26
    sync.onSourceScroll()

    expect(pane.style.transform).toBe("")
    expect(frameCallbacks.length).toBe(1)

    const callback = frameCallbacks[0]
    callback(0)

    expect(pane.style.transform).toBe("translate3d(0, -26px, 0)")
  })
})
