import { afterEach, describe, expect, it } from "vitest"
import { mountHistoryDemo, type HistoryDemoHandle } from "./main"

describe("history sandbox example", () => {
  let demo: HistoryDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("records edit, undo, and redo with one transaction per edit", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountHistoryDemo(root)
    await demo.grid.ready

    expect(demo.grid.api.transaction.hasSupport()).toBe(true)
    expect(root.querySelector<HTMLButtonElement>('[data-history-action="undo"]')?.disabled).toBe(true)

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    const editor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")!
    editor.value = "Desk light"
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
    await waitFor(() => demo?.grid.api.transaction.canUndo() === true)
    expect(demo.grid.api.rows.getById("i1")?.data.item).toBe("Desk light")
    expect(root.querySelector<HTMLButtonElement>('[data-history-action="undo"]')?.disabled).toBe(false)

    root.querySelector<HTMLButtonElement>('[data-history-action="undo"]')!.click()
    await waitFor(() => demo?.grid.api.transaction.canRedo() === true)
    expect(demo.grid.api.rows.getById("i1")?.data.item).toBe("Desk lamp")
    expect(demo.grid.api.transaction.canRedo()).toBe(true)

    const redoShortcut = new KeyboardEvent("keydown", {
      key: "z", shiftKey: true, ctrlKey: true, bubbles: true, cancelable: true,
    })
    root.querySelector<HTMLElement>("[role=grid]")!.dispatchEvent(redoShortcut)
    expect(redoShortcut.defaultPrevented).toBe(true)
    await waitFor(() => demo?.grid.api.rows.getById("i1")?.data.item === "Desk light")
    expect(demo.grid.api.rows.getById("i1")?.data.item).toBe("Desk light")
    await waitFor(() => demo?.grid.api.transaction.canUndo() === true)
    expect(demo.grid.api.transaction.canUndo()).toBe(true)
    expect(demo.grid.api.transaction.canRedo()).toBe(false)
  })

  it("records a pasted range as one undoable operation", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountHistoryDemo(root)
    await demo.grid.ready

    root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="1"]')!.click()
    const paste = new Event("paste", { bubbles: true, cancelable: true })
    Object.defineProperty(paste, "clipboardData", {
      value: { getData: () => "Team lead" },
    })
    root.querySelector("[role=grid]")!.dispatchEvent(paste)

    await waitFor(() => demo?.grid.api.transaction.canUndo() === true)
    expect(demo.grid.api.rows.getById("i2")?.data.owner).toBe("Team lead")
    expect(demo.grid.api.transaction.getSnapshot()?.undoDepth).toBe(1)

    await demo.grid.api.transaction.undo()
    expect(demo.grid.api.rows.getById("i2")?.data.owner).toBe("Grace")
    expect(demo.grid.api.transaction.canRedo()).toBe(true)
  })
})

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  expect(predicate()).toBe(true)
}
