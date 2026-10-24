import { afterEach, describe, expect, it } from "vitest"
import { mountConditionFilterDemo, type ConditionFilterDemoHandle } from "./main"

describe("condition-filter sandbox example", () => {
  let demo: ConditionFilterDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("applies numeric comparison and range predicates through Core", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountConditionFilterDemo(root)
    await demo.grid.ready

    const operator = root.querySelector<HTMLSelectElement>("[data-condition-filter-operator]")!
    const value = root.querySelector<HTMLInputElement>("[data-condition-filter-value]")!
    const upper = root.querySelector<HTMLInputElement>("[data-condition-filter-upper]")!

    expect(readOrders(root)).toEqual(["SO-1042", "SO-1044", "SO-1045", "SO-1046"])
    value.value = "400"
    value.dispatchEvent(new Event("input"))
    expect(readOrders(root)).toEqual(["SO-1042", "SO-1044", "SO-1046"])
    expect(demo.grid.api.rows.getSnapshot().filterModel?.columnFilters.amount).toEqual({
      kind: "predicate",
      operator: "gte",
      value: 400,
    })

    operator.value = "between"
    upper.value = "800"
    operator.dispatchEvent(new Event("change"))
    expect(readOrders(root)).toEqual(["SO-1042", "SO-1046"])
    expect(root.querySelector<HTMLElement>("[data-condition-filter-upper-label]")?.hidden).toBe(false)
  })
})

function readOrders(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll(".affino-grid-dom__body [role=row]"))
    .map(row => row.querySelector('[role="gridcell"]')?.textContent ?? "")
}
