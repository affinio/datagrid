import { afterEach, describe, expect, it } from "vitest"
import { mountCellStylesDemo, type CellStylesDemoHandle } from "./main"

describe("cell styles sandbox example", () => {
  let demo: CellStylesDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("renders status colors and progress fills from resolver callbacks", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountCellStylesDemo(root)
    await demo.grid.ready

    const blocked = root.querySelector<HTMLElement>('[data-row-id="w3"] [data-column-index="2"]')!
    const progress = root.querySelector<HTMLElement>('[data-row-id="w2"] [data-column-index="3"]')!
    expect(blocked.classList).toContain("dom-cell-styles__blocked")
    expect(blocked.style.backgroundColor).toBe("rgb(255, 227, 224)")
    expect(blocked.style.color).toBe("rgb(163, 48, 38)")
    expect(progress.style.backgroundImage).toContain("48%")
    expect(progress.style.textAlign).toBe("right")
  })
})
