import { afterEach, describe, expect, it } from "vitest"
import { mountFilteringDemo, type FilteringDemoHandle } from "./main"

describe("filtering sandbox example", () => {
  let demo: FilteringDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("applies and clears a value-set filter through Core", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountFilteringDemo(root)
    await demo.grid.ready

    expect(readNames(root)).toHaveLength(5)
    const filter = root.querySelector<HTMLSelectElement>("[data-filter-team]")!
    filter.value = "Engine"
    filter.dispatchEvent(new Event("change"))
    expect(readNames(root)).toEqual(["Ada Lovelace", "Margaret Hamilton"])
    expect(demo.grid.api.rows.getSnapshot().filterModel).toEqual({
      columnFilters: { team: { kind: "valueSet", tokens: ["string:Engine"] } },
    })

    filter.value = ""
    filter.dispatchEvent(new Event("change"))
    expect(readNames(root)).toHaveLength(5)
    expect(demo.grid.api.rows.getSnapshot().filterModel).toBeNull()
  })
})

function readNames(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll(".affino-grid-dom__body [role=row]"))
    .map(row => row.querySelector('[role="gridcell"]')?.textContent ?? "")
}
