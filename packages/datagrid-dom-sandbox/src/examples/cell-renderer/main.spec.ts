import { afterEach, describe, expect, it } from "vitest"
import { mountCellRendererDemo, type CellRendererDemoHandle } from "./main"

describe("cell renderer sandbox example", () => {
  let demo: CellRendererDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("renders a cell-level pseudo-button and preserves Enter row navigation", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountCellRendererDemo(root)
    await demo.grid.ready

    expect(root.querySelectorAll(".renderer-demo__badge")).toHaveLength(3)
    expect(root.querySelector(".renderer-demo__badge--ready")?.textContent).toBe("18")
    expect(root.querySelector(".renderer-demo__badge--low")?.textContent).toBe("3")
    expect(root.querySelector(".renderer-demo__badge--empty")?.textContent).toBe("0")
    const cell = root.querySelector<HTMLElement>('[data-column-index="2"][data-row-index="1"]')!
    const pseudoButton = cell.querySelector<HTMLElement>(".renderer-demo__action")!
    expect(pseudoButton.textContent).toBe("LOW STOCK")
    expect(cell.getAttribute("role")).toBe("button")
    expect(cell.getAttribute("aria-label")).toBe("Open status details for Monitor arm")
    const unavailableCell = root.querySelector<HTMLElement>('[data-column-index="2"][data-row-index="2"]')!
    expect(unavailableCell.getAttribute("aria-disabled")).toBe("true")

    cell.click()
    expect(root.querySelector(".renderer-demo__action-status")?.textContent)
      .toBe("Monitor arm activated by click.")
    expect(demo.grid.api.selection.getSnapshot()?.activeCell).toMatchObject({
      rowIndex: 1,
      colIndex: 2,
      rowId: "sku-205",
    })

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    const space = new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true })
    grid.dispatchEvent(space)
    expect(space.defaultPrevented).toBe(true)
    expect(root.querySelector(".renderer-demo__action-status")?.textContent)
      .toBe("Monitor arm activated by keyboard-space.")

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!.click()
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
    grid.dispatchEvent(enter)

    expect(enter.defaultPrevented).toBe(true)
    expect(demo.grid.api.selection.getSnapshot()?.activeCell).toMatchObject({ rowIndex: 1, colIndex: 0 })
    expect(root.querySelector(".renderer-demo__action-status")?.textContent)
      .toBe("Monitor arm activated by keyboard-space.")
  })
})
