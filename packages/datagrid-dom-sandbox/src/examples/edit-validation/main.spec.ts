import { afterEach, describe, expect, it } from "vitest"
import { mountEditValidationDemo, type EditValidationDemoHandle } from "./main"

describe("inline validation sandbox example", () => {
  let demo: EditValidationDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("retains invalid drafts and commits after correction", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountEditValidationDemo(root)
    await demo.grid.ready

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="1"]')!
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    const editor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")!
    editor.value = "not a number"
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
    expect(demo.grid.api.rows.getById("stock-1")?.data.reorderPoint).toBe(12)
    expect(root.querySelector(".affino-grid-dom__editor")).toBe(editor)
    expect(editor.getAttribute("aria-invalid")).toBe("true")
    expect(editor.title).toBe("Invalid number")

    editor.value = "15"
    editor.dispatchEvent(new Event("input", { bubbles: true }))
    expect(editor.hasAttribute("aria-invalid")).toBe(false)
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(demo.grid.api.rows.getById("stock-1")?.data.reorderPoint).toBe(15)
    expect(demo.grid.api.transaction.canUndo()).toBe(true)
  })

  it("releases an editor session when an external row update rerenders its cell", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountEditValidationDemo(root)
    await demo.grid.ready

    const cell = root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="1"]')!
    cell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    expect(root.querySelector(".affino-grid-dom__editor")).not.toBeNull()

    await demo.grid.api.rows.applyEdits([{ rowId: "stock-1", data: { item: "Externally changed" } }], { source: "application" })
    expect(root.querySelector(".affino-grid-dom__editor")).toBeNull()
    const currentCell = root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="1"]')!
    currentCell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    expect(root.querySelector(".affino-grid-dom__editor")).not.toBeNull()
  })
})
