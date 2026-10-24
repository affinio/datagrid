import { afterEach, describe, expect, it } from "vitest"
import { mountNumericEditingDemo, type NumericEditingDemoHandle } from "./main"

describe("numeric editing sandbox example", () => {
  let demo: NumericEditingDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("parses number, currency, and percent drafts through Core", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountNumericEditingDemo(root)
    await demo.grid.ready

    const edit = async (columnIndex: number, draft: string): Promise<void> => {
      root.querySelector<HTMLElement>(`[data-row-index="0"][data-column-index="${columnIndex}"]`)!
        .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
      const editor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")!
      editor.value = draft
      editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    await edit(1, "4")
    await edit(2, "$2,500.50")
    await edit(3, "10%")
    expect(demo.grid.api.rows.getById("i1")?.data.quantity).toBe(4)
    expect(demo.grid.api.rows.getById("i1")?.data.unitPrice).toBe(2500.5)
    expect(demo.grid.api.rows.getById("i1")?.data.taxRate).toBe(0.1)

    expect(demo.grid.api.transaction.canUndo()).toBe(true)
  })
})
