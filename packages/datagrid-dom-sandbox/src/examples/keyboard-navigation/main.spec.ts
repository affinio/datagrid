import { afterEach, describe, expect, it } from "vitest"
import { mountKeyboardNavigationDemo, type KeyboardNavigationDemoHandle } from "./main"

describe("keyboard navigation sandbox example", () => {
  let demo: KeyboardNavigationDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("moves the active cell and extends from the original anchor with Shift", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountKeyboardNavigationDemo(root)
    await demo.grid.ready

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')?.click()
    const grid = root.querySelector<HTMLElement>('[role="grid"]')!
    expect(document.activeElement).toBe(grid)

    const right = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })
    grid.dispatchEvent(right)
    expect(right.defaultPrevented).toBe(true)
    expect(demo.grid.api.selection.getSnapshot()).toMatchObject({
      activeCell: { rowIndex: 0, colIndex: 1, rowId: "p1" },
      ranges: [{ startRow: 0, endRow: 0, startCol: 1, endCol: 1, anchor: { rowIndex: 0, colIndex: 1 } }],
    })

    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true, bubbles: true, cancelable: true }))
    expect(demo.grid.api.selection.getSnapshot()).toMatchObject({
      activeCell: { rowIndex: 1, colIndex: 1, rowId: "p2" },
      ranges: [{
        startRow: 0,
        endRow: 1,
        startCol: 1,
        endCol: 1,
        anchor: { rowIndex: 0, colIndex: 1, rowId: "p1" },
        focus: { rowIndex: 1, colIndex: 1, rowId: "p2" },
      }],
    })
    expect(grid.getAttribute("aria-activedescendant")).toBe(`${grid.id}--cell-1-1`)
    expect(root.querySelector('[data-row-index="0"][data-column-index="1"]')?.classList.contains("affino-grid-dom__cell--range-anchor")).toBe(true)

    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }))
    expect(demo.grid.api.selection.getSnapshot()).toMatchObject({
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "p1" },
      ranges: [{ startRow: 0, endRow: 0, startCol: 0, endCol: 0, anchor: { rowIndex: 0, colIndex: 0, rowId: "p1" } }],
    })
    expect(root.querySelector("output")?.textContent).toBe("Active Ada Lovelace · Name")
  })

  it("keeps arrow navigation inside the grid bounds", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountKeyboardNavigationDemo(root)
    await demo.grid.ready
    const grid = root.querySelector<HTMLElement>('[role="grid"]')!
    grid.focus()
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }))

    expect(demo.grid.api.selection.getSnapshot()).toMatchObject({
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "p1" },
      ranges: [{ startRow: 0, endRow: 0, startCol: 0, endCol: 0 }],
    })
  })

  it("moves down with Enter and up with Shift+Enter", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountKeyboardNavigationDemo(root)
    await demo.grid.ready
    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="1"]')!.click()

    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
    grid.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
    expect(demo.grid.api.selection.getSnapshot()).toMatchObject({
      activeCell: { rowIndex: 2, colIndex: 1, rowId: "p3" },
      ranges: [{ startRow: 2, endRow: 2, startCol: 1, endCol: 1 }],
    })

    const shiftEnter = new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true })
    grid.dispatchEvent(shiftEnter)
    expect(shiftEnter.defaultPrevented).toBe(true)
    expect(demo.grid.api.selection.getSnapshot()).toMatchObject({
      activeCell: { rowIndex: 1, colIndex: 1, rowId: "p2" },
      ranges: [{ startRow: 1, endRow: 1, startCol: 1, endCol: 1 }],
    })
  })
})
