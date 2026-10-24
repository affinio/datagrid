import { afterEach, describe, expect, it } from "vitest"
import { mountSortingDemo, type SortingDemoHandle } from "./main"

describe("sorting sandbox example", () => {
  let demo: SortingDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("routes sort controls through Core and renders the projected row order", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountSortingDemo(root)
    await demo.grid.ready

    expect(readNames(root)).toEqual(["Katherine Johnson", "Ada Lovelace", "Grace Hopper"])

    root.querySelector<HTMLButtonElement>('[data-sort-direction="asc"]')?.click()
    expect(readNames(root)).toEqual(["Ada Lovelace", "Grace Hopper", "Katherine Johnson"])
    expect(root.querySelector('[data-sort-direction="asc"]')?.getAttribute("aria-pressed")).toBe("true")

    root.querySelector<HTMLButtonElement>('[data-sort-direction="desc"]')?.click()
    expect(readNames(root)).toEqual(["Katherine Johnson", "Grace Hopper", "Ada Lovelace"])
    expect(root.querySelector('[data-sort-direction="desc"]')?.getAttribute("aria-pressed")).toBe("true")

    root.querySelector<HTMLButtonElement>('[data-sort-direction="none"]')?.click()
    expect(readNames(root)).toEqual(["Katherine Johnson", "Ada Lovelace", "Grace Hopper"])
    expect(demo.grid.api.rows.getSnapshot().sortModel).toEqual([])
  })

  it("sorts from a header and combines sort keys with Shift-click", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountSortingDemo(root)
    await demo.grid.ready

    root.querySelector<HTMLElement>('.affino-grid-dom__column-header[data-column-index="0"]')?.click()
    expect(demo.grid.api.rows.getSnapshot().sortModel).toEqual([{ key: "name", direction: "asc" }])
    expect(readNames(root)).toEqual(["Ada Lovelace", "Grace Hopper", "Katherine Johnson"])
    expect(root.querySelector<HTMLElement>('.affino-grid-dom__column-header[data-column-index="0"]')?.getAttribute("aria-sort"))
      .toBe("ascending")

    const teamHeader = root.querySelector<HTMLElement>('.affino-grid-dom__column-header[data-column-index="1"]')!
    teamHeader.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }))
    expect(demo.grid.api.rows.getSnapshot().sortModel).toEqual([
      { key: "name", direction: "asc" },
      { key: "team", direction: "asc" },
    ])
    expect(teamHeader.getAttribute("aria-sort")).toBe("ascending")
  })
})

function readNames(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll(".affino-grid-dom__body [role=row]"))
    .map(row => row.querySelector('[role="gridcell"]')?.textContent ?? "")
}
