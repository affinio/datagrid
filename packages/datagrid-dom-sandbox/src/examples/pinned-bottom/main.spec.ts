import { afterEach, describe, expect, it } from "vitest"
import { mountPinnedBottomDemo, type PinnedBottomDemoHandle } from "./main"

describe("pinned bottom sandbox example", () => {
  let demo: PinnedBottomDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("renders the pinned summary after the scrollable account rows", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountPinnedBottomDemo(root)
    await demo.grid.ready

    const body = root.querySelector(".affino-grid-dom__body")!
    const pinned = root.querySelector(".affino-grid-dom__pinned-bottom")!
    expect(body.querySelectorAll('[role="row"]')).toHaveLength(5)
    expect(pinned.getAttribute("role")).toBe("rowgroup")
    expect(pinned.querySelector('[data-row-id="a-150"]')?.textContent).toContain("Research budget")
    expect(root.querySelector("[role=grid]")?.classList.contains("affino-grid-dom--has-pinned-bottom")).toBe(true)
    expect(demo.grid.api.rows.getCount()).toBe(6)
  })
})
