import { afterEach, describe, expect, it } from "vitest"
import { mountDateEditingDemo, type DateEditingDemoHandle } from "./main"

describe("date editing sandbox example", () => {
  let demo: DateEditingDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("commits date and datetime drafts as Core Date values", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountDateEditingDemo(root)
    await demo.grid.ready

    const dueDateCell = root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="1"]')!
    dueDateCell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    const dateEditor = root.querySelector<HTMLInputElement>('.affino-grid-dom__editor[type="date"]')!
    expect(dateEditor.value).toBe("2026-10-24")
    dateEditor.value = "2026-10-26"
    dateEditor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(demo.grid.api.rows.getById("s1")?.data.dueDate).toBeInstanceOf(Date)
    expect((demo.grid.api.rows.getById("s1")?.data.dueDate as unknown as Date).toISOString()).toBe("2026-10-26T00:00:00.000Z")

    const startsAtCell = root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="2"]')!
    startsAtCell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    const datetimeEditor = root.querySelector<HTMLInputElement>('.affino-grid-dom__editor[type="datetime-local"]')!
    datetimeEditor.value = "2026-10-26T11:45"
    datetimeEditor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(demo.grid.api.rows.getById("s1")?.data.startsAt).toBeInstanceOf(Date)
    expect((demo.grid.api.rows.getById("s1")?.data.startsAt as unknown as Date).getTime()).toBe(Date.parse("2026-10-26T11:45"))
    expect(demo.grid.api.transaction.canUndo()).toBe(true)
  })
})
