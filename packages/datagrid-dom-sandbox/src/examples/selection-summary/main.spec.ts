import { afterEach, describe, expect, it } from "vitest"
import { mountSelectionSummaryDemo, type SelectionSummaryDemoHandle } from "./main"

describe("selection summary sandbox example", () => {
  let demo: SelectionSummaryDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("presents Core summary metrics for the selected range", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountSelectionSummaryDemo(root)
    await demo.grid.ready

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="2"]')?.click()
    root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="3"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }))

    expect(demo.grid.api.selection.summarize({
      columns: [
        { key: "hours", aggregations: ["sum", "avg"] },
        { key: "cost", aggregations: ["sum"] },
      ],
    })).toMatchObject({
      selectedCells: 4,
      selectedRows: 2,
      columns: {
        hours: { metrics: { sum: 14, avg: 7 } },
        cost: { metrics: { sum: 2600 } },
      },
    })
    expect(root.querySelector("output")?.textContent)
      .toBe("4 selected cells across 2 rows · Hours sum 14, average 7 · Cost sum 2,600")

    await demo.grid.api.rows.applyEdits([{
      rowId: "l1",
      data: { hours: 10 },
      previousData: { hours: 6 },
    }])
    expect(root.querySelector("output")?.textContent)
      .toBe("4 selected cells across 2 rows · Hours sum 18, average 9 · Cost sum 2,600")
  })
})
