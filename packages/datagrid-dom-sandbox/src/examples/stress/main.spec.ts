import { afterEach, describe, expect, it } from "vitest"
import { mountStressDemo, type StressDemoHandle } from "./main"

describe("combined viewport stress sandbox example", () => {
  let demo: StressDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("keeps the combined 10,000-row by 120-column grid bounded while both windows move", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountStressDemo(root)
    await demo.grid.ready

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    expect(grid.getAttribute("aria-rowcount")).toBe("10001")
    expect(grid.getAttribute("aria-colcount")).toBe("120")
    expect(root.querySelectorAll(".affino-grid-dom__body > [role=row][data-row-index]").length).toBeLessThan(100)
    expect(root.querySelectorAll(".affino-grid-dom__header [role=columnheader]").length).toBeLessThan(30)

    await demo.runViewportStress()

    expect(root.querySelector("[data-stress-status]")?.textContent).toContain("Viewport stress complete")
    expect(root.querySelector("[data-stress-status]")?.textContent).toContain("10,000 × 120 logical")
    expect(root.querySelectorAll(".affino-grid-dom__body > [role=row][data-row-index]").length).toBeLessThan(100)
    expect(root.querySelectorAll(".affino-grid-dom__header [role=columnheader]").length).toBeLessThan(30)
    expect(grid.querySelectorAll("*").length).toBeLessThan(2_000)
  }, 15_000)
})
