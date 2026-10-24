import { afterEach, describe, expect, it } from "vitest"
import { mountColumnResizingDemo } from "./main"

describe("column resizing example", () => {
  const mounted: Array<Awaited<ReturnType<typeof mountColumnResizingDemo>>> = []
  afterEach(async () => {
    await Promise.all(mounted.splice(0).map(demo => demo.destroy()))
  })

  it("resizes through the header handle and keeps Core as the width owner", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    const demo = mountColumnResizingDemo(root)
    mounted.push(demo)
    await demo.grid.ready

    const handle = root.querySelector<HTMLElement>('[data-column-resize-handle="product"]')
    expect(handle).not.toBeNull()
    handle!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 100, pointerId: 1 }))
    expect(root.querySelector("[role=grid]")?.classList.contains("affino-grid-dom--column-resizing")).toBe(true)
    document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 160, pointerId: 1 }))
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }))

    expect(root.querySelector("[role=grid]")?.classList.contains("affino-grid-dom--column-resizing")).toBe(false)
    expect(demo.grid.api.columns.get("product")?.width).toBe(340)
    expect(root.querySelector<HTMLElement>("[role=grid]")?.style.getPropertyValue("--affino-grid-dom-columns")).toContain("340px")
  })

  it("supports keyboard resizing and blocks widths below the minimum", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    const demo = mountColumnResizingDemo(root)
    mounted.push(demo)
    await demo.grid.ready

    const handle = root.querySelector<HTMLElement>('[data-column-resize-handle="owner"]')!
    handle.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" }))
    expect(demo.grid.api.columns.get("owner")?.width).toBe(140)
    expect(demo.grid.api.selection.getSnapshot()).toBeNull()
    expect((document.activeElement as HTMLElement | null)?.dataset.columnResizeHandle).toBe("owner")
    for (let index = 0; index < 20; index += 1) {
      handle.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" }))
    }
    expect(demo.grid.api.columns.get("owner")?.width).toBe(56)
  })
})
