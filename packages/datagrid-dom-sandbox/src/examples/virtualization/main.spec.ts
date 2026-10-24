import { afterEach, describe, expect, it } from "vitest"
import { mountVirtualizationDemo, type VirtualizationDemoHandle } from "./main"

describe("row virtualization sandbox example", () => {
  let demo: VirtualizationDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("keeps a bounded DOM window for ten thousand logical rows", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountVirtualizationDemo(root)
    await demo.grid.ready

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    const renderedRows = root.querySelectorAll(".affino-grid-dom__body > [role=row][data-row-index]")
    expect(grid.getAttribute("aria-rowcount")).toBe("10001")
    expect(renderedRows.length).toBeLessThan(100)
    expect(root.querySelectorAll(".affino-grid-dom__virtual-spacer").length).toBeGreaterThan(0)
    expect(root.querySelector("[data-virtualization-status]")?.textContent).toContain("10,000 total")

    demo.grid.api.view.scrollToRow({ rowIndex: 9_000, rowId: "employee-9001" })
    const scrolledRows = Array.from(root.querySelectorAll<HTMLElement>(".affino-grid-dom__body > [role=row][data-row-index]"))
    expect(Number(scrolledRows[0]?.dataset.rowIndex)).toBeGreaterThan(8_900)
    expect(scrolledRows.length).toBeLessThan(100)
  })
})
