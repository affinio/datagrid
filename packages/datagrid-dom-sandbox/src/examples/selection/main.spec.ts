import { afterEach, describe, expect, it } from "vitest"
import { mountCellSelectionDemo, type CellSelectionDemoHandle } from "./main"

describe("cell selection sandbox example", () => {
  let demo: CellSelectionDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("selects a clicked cell through Core and clears it through the API", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountCellSelectionDemo(root)
    await demo.grid.ready

    root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="1"]')?.click()

    expect(demo.grid.api.selection.getSnapshot()).toMatchObject({
      activeCell: { rowIndex: 1, colIndex: 1, rowId: "p2" },
      ranges: [{ startRow: 1, endRow: 1, startCol: 1, endCol: 1 }],
    })
    let selectedCell = root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="1"]')
    expect(selectedCell?.getAttribute("aria-selected")).toBe("true")
    expect(selectedCell?.classList.contains("affino-grid-dom__cell--active")).toBe(true)
    expect(root.querySelector("output")?.textContent).toBe("Selected Grace Hopper · Team")

    root.querySelector<HTMLButtonElement>('[data-action="clear-selection"]')?.click()
    expect(demo.grid.api.selection.getSnapshot()).toBeNull()
    selectedCell = root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="1"]')
    expect(selectedCell?.getAttribute("aria-selected")).toBe("false")
    expect(selectedCell?.classList.contains("affino-grid-dom__cell--active")).toBe(false)
  })
})
