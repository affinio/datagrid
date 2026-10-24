import { afterEach, describe, expect, it } from "vitest"
import { mountFormulaDemo, type FormulaDemoHandle } from "./main"

describe("formula sandbox example", () => {
  let demo: FormulaDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("recomputes and renders dependent formula columns after source edits", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountFormulaDemo(root)
    await demo.grid.ready

    expect(demo.grid.api.rows.getFormulaFields().map(field => field.name)).toEqual([
      "subtotal", "tax", "total",
    ])
    expect(demo.grid.api.rows.get(0)?.row).toMatchObject({
      subtotal: 127.5,
      tax: 10.2,
      total: 137.7,
    })
    expect(cellText(root, 0, 2)).toBe("3")
    expect(cellText(root, 0, 3)).toBe("8%")
    expect(cellText(root, 0, 6)).toBe("137.7")

    const totalCell = root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="6"]')!
    totalCell.click()
    const copiedValues: string[] = []
    const copy = new Event("copy", { bubbles: true, cancelable: true })
    Object.defineProperty(copy, "clipboardData", {
      value: { setData: (_type: string, value: string) => copiedValues.push(value) },
    })
    root.querySelector("[role=grid]")!.dispatchEvent(copy)
    expect(copiedValues).toEqual(["137.7"])

    const priceCell = root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="1"]')!
    priceCell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    const editor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")!
    editor.value = "50"
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(demo.grid.api.rows.get(0)?.row).toMatchObject({
      unitPrice: 50,
      subtotal: 150,
      tax: 12,
      total: 162,
    })
    expect(cellText(root, 0, 6)).toBe("162")
  })
})

function cellText(root: HTMLElement, rowIndex: number, columnIndex: number): string {
  return root.querySelector<HTMLElement>(
    `[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
  )?.textContent?.trim() ?? ""
}
