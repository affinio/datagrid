import { afterEach, describe, expect, it } from "vitest"
import { mountRangeSelectionDemo, type RangeSelectionDemoHandle } from "./main"

describe("cell range selection sandbox example", () => {
  let demo: RangeSelectionDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("extends from the anchor on Shift-click and starts over on a regular click", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountRangeSelectionDemo(root)
    await demo.grid.ready

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')?.click()
    root.querySelector<HTMLElement>('[data-row-index="2"][data-column-index="1"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }))

    expect(demo.grid.api.selection.getSnapshot()).toMatchObject({
      activeCell: { rowIndex: 2, colIndex: 1, rowId: "p3" },
      ranges: [{
        startRow: 0,
        endRow: 2,
        startCol: 0,
        endCol: 1,
        anchor: { rowIndex: 0, colIndex: 0, rowId: "p1" },
        focus: { rowIndex: 2, colIndex: 1, rowId: "p3" },
      }],
    })
    expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(6)
    const anchorCell = root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')
    const focusCell = root.querySelector<HTMLElement>('[data-row-index="2"][data-column-index="1"]')
    expect(anchorCell?.classList.contains("affino-grid-dom__cell--range-anchor")).toBe(true)
    expect(anchorCell?.classList.contains("affino-grid-dom__cell--range-top")).toBe(true)
    expect(anchorCell?.classList.contains("affino-grid-dom__cell--range-left")).toBe(true)
    expect(focusCell?.classList.contains("affino-grid-dom__cell--range-anchor")).toBe(false)
    expect(focusCell?.classList.contains("affino-grid-dom__cell--range-bottom")).toBe(true)
    expect(focusCell?.classList.contains("affino-grid-dom__cell--range-right")).toBe(true)
    expect(root.querySelector("output")?.textContent).toBe("Selected 3 rows × 2 columns · 1 range(s)")

    root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="0"]')?.click()
    expect(demo.grid.api.selection.getSnapshot()).toMatchObject({
      ranges: [{ startRow: 1, endRow: 1, startCol: 0, endCol: 0 }],
    })
    expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(1)
  })
})
