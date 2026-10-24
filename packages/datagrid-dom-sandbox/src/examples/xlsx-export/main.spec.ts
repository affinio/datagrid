import { afterEach, describe, expect, it, vi } from "vitest"
import { mountXlsxExportDemo, type XlsxExportDemoHandle } from "./main"

describe("XLSX export sandbox example", () => {
  let demo: XlsxExportDemoHandle | undefined

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it("shows a virtualized 2,000-row grid with a declarative export action", async () => {
    const root = document.createElement("section")
    document.body.append(root)
    demo = mountXlsxExportDemo(root)
    await demo.grid.ready

    expect(root.querySelector("[data-xlsx-export]")?.textContent).toBe("Export XLSX")
    expect(demo.grid.api.rows.getCount()).toBe(2_000)
    expect(demo.grid.api.rows.getFormulaFields().map(field => field.field)).toContain("total")
    expect(root.querySelector('[role="grid"]')?.getAttribute("aria-rowcount")).toBe("2001")
    const totalCell = root.querySelector<HTMLElement>('[role="gridcell"][data-column-index="5"]')
    expect(totalCell?.style.backgroundColor).toBe("rgb(234, 242, 251)")
    expect(totalCell?.style.fontWeight).toBe("700")

    root.querySelector<HTMLButtonElement>("[data-xlsx-group]")!.click()
    expect(demo.grid.api.rows.getAggregationModel()?.columns[0]).toMatchObject({ key: "total", op: "sum" })
    expect(root.querySelector<HTMLButtonElement>("[data-xlsx-group]")?.textContent).toBe("Clear grouping")
  })
})
