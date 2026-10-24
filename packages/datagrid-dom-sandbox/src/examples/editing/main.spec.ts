import { afterEach, describe, expect, it } from "vitest"
import { mountEditingDemo, type EditingDemoHandle } from "./main"

describe("cell editing sandbox example", () => {
  let demo: EditingDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("commits edits and cancels drafts using the inline editor controls", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountEditingDemo(root)
    await demo.grid.ready

    const firstCell = root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!
    firstCell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    let editor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")!
    editor.value = "Discarded draft"
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))
    expect(demo.grid.api.rows.getById("p1")?.data.name).toBe("Ada Lovelace")

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    editor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")!
    editor.value = "Augusta King"
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(demo.grid.api.rows.getById("p1")?.data.name).toBe("Augusta King")
    expect(root.querySelector('[data-row-index="0"][data-column-index="0"]')?.textContent).toBe("Augusta King")
  })

  it("demonstrates type-to-edit and Enter direction", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountEditingDemo(root)
    await demo.grid.ready

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!.click()
    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "A", bubbles: true, cancelable: true }))
    let editor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")!
    expect(editor.value).toBe("A")
    editor.value = "Augusta Lovelace"
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
    expect(demo.grid.api.rows.getById("p1")?.data.name).toBe("Augusta Lovelace")
    expect(demo.grid.api.selection.getSnapshot()?.activeCell).toMatchObject({ rowIndex: 1, colIndex: 0, rowId: "p2" })

    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "G", bubbles: true, cancelable: true }))
    editor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")!
    editor.value = "Rear Admiral Hopper"
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true }))
    expect(demo.grid.api.rows.getById("p2")?.data.name).toBe("Rear Admiral Hopper")
    expect(demo.grid.api.selection.getSnapshot()?.activeCell).toMatchObject({ rowIndex: 0, colIndex: 0, rowId: "p1" })
  })
})
