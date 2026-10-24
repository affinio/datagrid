import { afterEach, describe, expect, it } from "vitest"
import { mountQuickFilterDemo, type QuickFilterDemoHandle } from "./main"

describe("quick-filter sandbox example", () => {
  let demo: QuickFilterDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("filters across configured columns and supports all-word matching", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountQuickFilterDemo(root)
    await demo.grid.ready

    expect(readNames(root)).toHaveLength(6)
    const input = root.querySelector<HTMLInputElement>("[data-quick-filter]")!
    const mode = root.querySelector<HTMLSelectElement>("[data-quick-filter-mode]")!

    input.value = "Hampton"
    input.dispatchEvent(new Event("input"))
    expect(readNames(root)).toEqual(["Katherine Johnson", "Dorothy Vaughan", "Mary Jackson"])

    mode.value = "tokens"
    input.value = "Mary Flight"
    input.dispatchEvent(new Event("input"))
    expect(readNames(root)).toEqual(["Mary Jackson"])
    expect(demo.grid.api.rows.getSnapshot().filterModel).toEqual({
      columnFilters: {},
      quickFilter: { query: "Mary Flight", columns: ["name", "team", "location"], mode: "tokens" },
    })

    input.value = "   "
    input.dispatchEvent(new Event("input"))
    expect(readNames(root)).toHaveLength(6)
    expect(demo.grid.api.rows.getSnapshot().filterModel).toBeNull()
  })
})

function readNames(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll(".affino-grid-dom__body [role=row]"))
    .map(row => row.querySelector('[role="gridcell"]')?.textContent ?? "")
}
