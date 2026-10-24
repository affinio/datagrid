import { afterEach, describe, expect, it } from "vitest"
import { mountComboboxCellDemo, type ComboboxCellDemoHandle } from "./main"

describe("combobox cell sandbox example", () => {
  let demo: ComboboxCellDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("filters options and commits the selected typed value", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountComboboxCellDemo(root)
    await demo.grid.ready

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="2"]')!
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    const editor = root.querySelector<HTMLInputElement>('[role="combobox"]')!
    expect(document.body.querySelectorAll('[role="option"]')).toHaveLength(10)

    editor.value = "doc"
    editor.dispatchEvent(new Event("input", { bubbles: true }))
    const options = [...document.body.querySelectorAll<HTMLButtonElement>('[role="option"]')]
    expect(options).toHaveLength(1)
    expect(options[0]?.textContent).toContain("Developer documentation")
    options[0]!.click()

    expect(demo.grid.api.rows.getById("a1")?.data.assignment).toBe("documentation")
    expect(document.body.querySelector('[role="listbox"]')).toBeNull()
  })

  it("commits a keyboard choice and moves to the next row", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountComboboxCellDemo(root)
    await demo.grid.ready

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="2"]')!
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    const editor = root.querySelector<HTMLInputElement>('[role="combobox"]')!
    editor.value = "sec"
    editor.dispatchEvent(new Event("input", { bubbles: true }))
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))

    expect(demo.grid.api.rows.getById("a1")?.data.assignment).toBe("security")
    expect(demo.grid.api.selection.getSnapshot()?.activeCell?.rowIndex).toBe(1)
  })
})
