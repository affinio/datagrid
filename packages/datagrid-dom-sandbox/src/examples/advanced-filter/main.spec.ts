import { afterEach, describe, expect, it } from "vitest"
import { mountAdvancedFilterDemo, type AdvancedFilterDemoHandle } from "./main"

describe("advanced-filter sandbox example", () => {
  let demo: AdvancedFilterDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("combines typed conditions using AND and OR groups in Core", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountAdvancedFilterDemo(root)
    await demo.grid.ready

    const join = root.querySelector<HTMLSelectElement>("[data-advanced-filter-join]")!
    expect(readOrders(root)).toEqual(["SO-1044"])
    expect(demo.grid.api.rows.getSnapshot().filterModel?.advancedExpression).toMatchObject({
      kind: "group",
      operator: "and",
      children: [
        { kind: "condition", key: "status", value: "Open" },
        { kind: "condition", key: "amount", operator: "gte", value: 500 },
      ],
    })

    join.value = "or"
    join.dispatchEvent(new Event("change"))
    expect(readOrders(root)).toEqual(["SO-1042", "SO-1044", "SO-1045", "SO-1046"])
  })
})

function readOrders(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll(".affino-grid-dom__body [role=row]"))
    .map(row => row.querySelector('[role="gridcell"]')?.textContent ?? "")
}
