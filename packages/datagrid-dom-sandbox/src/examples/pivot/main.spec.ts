import { afterEach, describe, expect, it } from "vitest"
import { mountPivotDemo, type PivotDemoHandle } from "./main"

describe("pivot sandbox example", () => {
  let demo: PivotDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("projects and renders generated pivot columns and totals, then clears back to source", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountPivotDemo(root)
    await demo.grid.ready

    const actions = root.querySelector<HTMLElement>(".pivot-demo__actions")!
    expect(Array.from(actions.children).map(child => child.className)).toEqual([
      "demo-panel__sort-status",
      "pivot-demo__buttons",
    ])
    expect(actions.querySelectorAll("button")).toHaveLength(3)
    expect(root.querySelector<HTMLButtonElement>('[data-pivot-action="export"]')?.disabled).toBe(true)

    root.querySelector<HTMLButtonElement>('[data-pivot-action="apply"]')!.click()
    expect(root.querySelector<HTMLButtonElement>('[data-pivot-action="export"]')?.disabled).toBe(false)

    expect(demo.grid.api.rows.getSnapshot().pivotColumns?.length).toBeGreaterThan(0)
    const pivotColumns = demo.grid.api.columns.getSnapshot().visibleColumns
      .filter(column => column.key.startsWith("pivot|"))
    expect(pivotColumns.length).toBeGreaterThanOrEqual(3)
    const visibleColumns = demo.grid.api.columns.getSnapshot().visibleColumns
    expect(visibleColumns.map(column => column.key)).toEqual([
      "team",
      ...pivotColumns.map(column => column.key),
    ])
    expect(root.querySelectorAll('.affino-grid-dom__header [role="columnheader"]')).toHaveLength(visibleColumns.length)
    expect(demo.grid.api.rows.getSnapshot().pivotModel).toMatchObject({
      rows: ["team"],
      columns: ["quarter"],
      values: [{ field: "revenue", agg: "sum" }],
    })
    expect(demo.grid.api.rows.getCount()).toBeGreaterThan(3)
    const pivotCellValues = Array.from(root.querySelectorAll<HTMLElement>('[role="gridcell"]'))
      .map(cell => cell.textContent?.trim() ?? "")
    expect(pivotCellValues).toEqual(expect.arrayContaining([
      "Operations", "Platform", "Research",
      "120", "145", "80", "110", "95", "105",
    ]))
    expect(root.querySelector("output")?.textContent).toContain("Pivot active")

    root.querySelector<HTMLButtonElement>('[data-pivot-action="clear"]')!.click()
    expect(root.querySelector<HTMLButtonElement>('[data-pivot-action="export"]')?.disabled).toBe(true)
    expect(demo.grid.api.rows.getSnapshot().pivotModel ?? null).toBeNull()
    expect(demo.grid.api.columns.getSnapshot().visibleColumns.some(column => column.key.startsWith("pivot|"))).toBe(false)
    expect(demo.grid.api.rows.getCount()).toBe(rowsCount)
    expect(root.querySelector("output")?.textContent).toBe("Source rows · choose Show pivot")
  })
})

const rowsCount = 6
