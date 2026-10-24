import { afterEach, describe, expect, it } from "vitest"
import { mountHistogramDemo, type HistogramDemoHandle } from "./main"

describe("histogram sandbox example", () => {
  let demo: HistogramDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("renders Core value counts and composes facet and value filters", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountHistogramDemo(root)
    await demo.grid.ready
    await flush()

    expect(readTeamCounts(root)).toEqual({ Engine: "2", Flight: "1", Platform: "1", Research: "2" })
    const region = root.querySelector<HTMLSelectElement>("[data-histogram-region]")!
    region.value = "East"
    region.dispatchEvent(new Event("change"))
    await flush()
    expect(readTeamCounts(root)).toEqual({ Engine: "1", Platform: "1", Research: "1" })

    root.querySelector<HTMLButtonElement>('[data-histogram-token="string:Research"]')!.click()
    await flush()
    expect(readNames(root)).toEqual(["Dorothy Vaughan"])
    expect(demo.grid.api.rows.getSnapshot().filterModel?.columnFilters).toEqual({
      region: { kind: "valueSet", tokens: ["string:East"] },
      team: { kind: "valueSet", tokens: ["string:Research"] },
    })
  })
})

function readTeamCounts(root: HTMLElement): Record<string, string> {
  return Object.fromEntries(Array.from(root.querySelectorAll<HTMLButtonElement>("[data-histogram-token]"))
    .map(button => [button.querySelector("span")?.textContent ?? "", button.querySelector(".histogram-demo__count")?.textContent ?? ""]))
}

function readNames(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll(".affino-grid-dom__body [role=row]"))
    .map(row => row.querySelector('[role="gridcell"]')?.textContent ?? "")
}

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}
