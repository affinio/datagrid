import { afterEach, describe, expect, it } from "vitest"
import { mountAggregationDemo, type AggregationDemoHandle } from "./main"

describe("aggregation sandbox example", () => {
  let demo: AggregationDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("recomputes group values for the selected operation and basis", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountAggregationDemo(root)
    await demo.grid.ready

    const getTeamGroup = (team: string) => Array.from(
      { length: demo!.grid.api.rows.getCount() },
      (_, index) => demo!.grid.api.rows.get(index),
    ).find(row => row?.kind === "group" && row.groupMeta?.groupValue === team)!

    expect(getTeamGroup("Platform").groupMeta?.aggregates).toMatchObject({ spend: 52_800, hours: 358 })
    expect(root.querySelectorAll('.affino-grid-dom__row[data-row-id^="group:"]')).toHaveLength(3)

    const quarter = root.querySelector<HTMLSelectElement>("[data-aggregation-quarter]")!
    quarter.value = "Q1"
    quarter.dispatchEvent(new Event("change", { bubbles: true }))
    expect(getTeamGroup("Platform").groupMeta?.aggregates?.spend).toBe(31_000)
    const basis = root.querySelector<HTMLSelectElement>("[data-aggregation-basis]")!
    basis.value = "source"
    basis.dispatchEvent(new Event("change", { bubbles: true }))
    expect(getTeamGroup("Platform").groupMeta?.aggregates?.spend).toBe(52_800)
    basis.value = "filtered"
    basis.dispatchEvent(new Event("change", { bubbles: true }))
    expect(getTeamGroup("Platform").groupMeta?.aggregates?.spend).toBe(31_000)

    const operation = root.querySelector<HTMLSelectElement>("[data-aggregation-operation]")!
    operation.value = "avg"
    operation.dispatchEvent(new Event("change", { bubbles: true }))
    expect(getTeamGroup("Platform").groupMeta?.aggregates?.spend).toBe(15_500)

    operation.value = "count"
    operation.dispatchEvent(new Event("change", { bubbles: true }))
    expect(getTeamGroup("Platform").groupMeta?.aggregates?.spend).toBe(2)
    expect(root.querySelector("output")?.textContent).toContain("Count spend")

    root.querySelector<HTMLButtonElement>('[data-aggregation-action="collapse"]')!.click()
    expect(root.querySelectorAll('.affino-grid-dom__row[data-row-id^="group:"] [data-group-toggle][aria-expanded="false"]')).toHaveLength(3)
  })
})
