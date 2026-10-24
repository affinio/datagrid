import { afterEach, describe, expect, it } from "vitest"
import { mountCheckboxCellsDemo, type CheckboxCellsDemoHandle } from "./main"

describe("checkbox cell sandbox example", () => {
  let demo: CheckboxCellsDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("toggles Core boolean values by click and Space", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountCheckboxCellsDemo(root)
    await demo.grid.ready

    const checkbox = root.querySelector<HTMLInputElement>(".affino-grid-dom__cell-checkbox")!
    expect(checkbox.checked).toBe(true)
    checkbox.click()
    expect(demo.grid.api.rows.getById("r1")?.data.approved).toBe(false)
    expect(root.querySelector<HTMLInputElement>(".affino-grid-dom__cell-checkbox")?.checked).toBe(false)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(demo.grid.api.transaction.canUndo()).toBe(true)
    await demo.grid.api.transaction.undo()
    expect(demo.grid.api.rows.getById("r1")?.data.approved).toBe(true)

    root.querySelector<HTMLInputElement>(".affino-grid-dom__cell-checkbox")!.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }),
    )
    expect(demo.grid.api.rows.getById("r1")?.data.approved).toBe(false)
  })
})
