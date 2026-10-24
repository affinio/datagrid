import { afterEach, describe, expect, it } from "vitest"
import { mountDataUpdatesDemo, type DataUpdatesDemoHandle } from "./main"

describe("data updates sandbox example", () => {
  let demo: DataUpdatesDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("adds, removes, and restores rows through the Core API", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountDataUpdatesDemo(root)
    await demo.grid.ready

    expect(readNames(root)).toEqual(["Ada Lovelace", "Grace Hopper", "Katherine Johnson"])

    root.querySelector<HTMLButtonElement>('[data-action="add"]')?.click()
    expect(readNames(root)).toEqual([
      "Ada Lovelace",
      "Grace Hopper",
      "Katherine Johnson",
      "New teammate 4",
    ])
    expect(demo.grid.api.rows.getCount()).toBe(4)

    root.querySelector<HTMLButtonElement>('[data-action="remove"]')?.click()
    expect(readNames(root)).toEqual(["Ada Lovelace", "Grace Hopper", "Katherine Johnson"])

    root.querySelector<HTMLButtonElement>('[data-action="add"]')?.click()
    root.querySelector<HTMLButtonElement>('[data-action="reset"]')?.click()
    expect(readNames(root)).toEqual(["Ada Lovelace", "Grace Hopper", "Katherine Johnson"])
    expect(demo.grid.api.rows.getCount()).toBe(3)
    expect(root.querySelector("output")?.textContent).toBe("3 rows · Core API ready")
  })
})

function readNames(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll(".affino-grid-dom__body [role=row]"))
    .map(row => row.querySelector('[role="gridcell"]')?.textContent ?? "")
}
