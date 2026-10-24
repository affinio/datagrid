import { afterEach, describe, expect, it } from "vitest"
import { mountRangeMoveDemo, type RangeMoveDemoHandle } from "./main"

describe("range move sandbox example", () => {
  let demo: RangeMoveDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("provides an editable grid and selects ranges for the move interaction", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountRangeMoveDemo(root)
    await demo.grid.ready

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')?.click()
    root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="1"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }))

    expect(demo.grid.api.selection.getSnapshot()?.ranges[0])
      .toMatchObject({ startRow: 0, endRow: 1, startCol: 0, endCol: 1 })
    expect(root.querySelectorAll("[role=gridcell]")).toHaveLength(12)
    expect(root.querySelector("output")?.textContent).toContain("Shift-click")
  })
})
