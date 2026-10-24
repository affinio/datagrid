import { afterEach, describe, expect, it, vi } from "vitest"
import { mountSelectEditingDemo, type SelectEditingDemoHandle } from "./main"

describe("select editing sandbox example", () => {
  let demo: SelectEditingDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("commits the selected option and renders its label", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountSelectEditingDemo(root)
    await demo.grid.ready

    const cell = root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="1"]')!
    expect(cell.textContent).toBe("Queued")
    cell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    const doneOption = [...root.ownerDocument.querySelectorAll<HTMLElement>('[role="option"]')]
      .find(option => option.textContent === "Done")!
    doneOption.click()

    await vi.waitFor(() => {
      expect(demo!.grid.api.rows.getById("t1")?.data.status).toBe("done")
      expect(root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="1"]')?.textContent).toBe("Done")
    })
  })
})
