import { afterEach, describe, expect, it } from "vitest"
import { mountFillHandleDemo, type FillHandleDemoHandle } from "./main"

describe("fill-handle sandbox example", () => {
  let demo: FillHandleDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("previews and commits a dragged numeric series with undo support", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountFillHandleDemo(root)
    await demo.grid.ready

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="1"]')!.click()
    root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="1"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }))
    const handle = root.querySelector<HTMLButtonElement>("[data-fill-handle]")!
    const target = root.querySelector<HTMLElement>('[data-row-index="4"][data-column-index="1"]')!

    handle.dispatchEvent(createPointerEvent("pointerdown", 11))
    target.dispatchEvent(createPointerEvent("pointermove", 11))
    expect(root.querySelectorAll("[data-fill-preview-overlay]")).toHaveLength(1)
    target.dispatchEvent(createPointerEvent("pointerup", 11))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(demo.grid.api.rows.getById("r3")?.data.quantity).toBe(30)
    expect(demo.grid.api.rows.getById("r4")?.data.quantity).toBe(40)
    expect(demo.grid.api.rows.getById("r5")?.data.quantity).toBe(50)
    root.querySelector<HTMLButtonElement>("[data-fill-action]")!.click()
    root.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="false"]')!.click()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(demo.grid.api.rows.getById("r3")?.data.quantity).toBe(10)
    expect(demo.grid.api.rows.getById("r4")?.data.quantity).toBe(20)
    expect(demo.grid.api.rows.getById("r5")?.data.quantity).toBe(10)
    await demo.grid.api.transaction.undo()
    expect(demo.grid.api.rows.getById("r3")?.data.quantity).toBe(0)
    expect(demo.grid.api.rows.getById("r4")?.data.quantity).toBe(0)
    expect(demo.grid.api.rows.getById("r5")?.data.quantity).toBe(0)
  })
})

function createPointerEvent(type: string, pointerId: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    isPrimary: { value: true },
    button: { value: 0 },
    clientX: { value: 24 },
    clientY: { value: 24 },
  })
  return event
}
