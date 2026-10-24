import { afterEach, describe, expect, it } from "vitest"
import { mountPaginationDemo, type PaginationDemoHandle } from "./main"

describe("pagination sandbox example", () => {
  let demo: PaginationDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("moves across Core pages and resets to page one when page size changes", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountPaginationDemo(root)
    await demo.grid.ready

    expect(readNames(root)).toEqual(["Ada Lovelace", "Grace Hopper", "Katherine Johnson"])
    expect(root.querySelector("output")?.textContent).toBe("Page 1 of 4 · 11 people")

    root.querySelector<HTMLButtonElement>('[data-page-action="next"]')?.click()
    expect(readNames(root)).toEqual(["Margaret Hamilton", "Dorothy Vaughan", "Mary Jackson"])
    expect(root.querySelector("output")?.textContent).toBe("Page 2 of 4 · 11 people")

    const pageSize = root.querySelector<HTMLSelectElement>("[data-page-size]")!
    pageSize.value = "5"
    pageSize.dispatchEvent(new Event("change"))
    expect(readNames(root)).toEqual(["Ada Lovelace", "Grace Hopper", "Katherine Johnson", "Margaret Hamilton", "Dorothy Vaughan"])
    expect(root.querySelector("output")?.textContent).toBe("Page 1 of 3 · 11 people")
    expect(root.querySelector<HTMLButtonElement>('[data-page-action="previous"]')?.disabled).toBe(true)
  })
})

function readNames(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll(".affino-grid-dom__body [role=row]"))
    .map(row => row.querySelector('[role="gridcell"]')?.textContent ?? "")
}
