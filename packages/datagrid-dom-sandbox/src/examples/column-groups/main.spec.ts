import { afterEach, describe, expect, it } from "vitest"
import { mountColumnGroupsDemo, type ColumnGroupsDemoHandle } from "./main"

describe("column groups sandbox example", () => {
  let demo: ColumnGroupsDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("renders nested group headers and keeps the leaf header row aligned with body columns", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountColumnGroupsDemo(root)
    await demo.grid.ready

    const groupRows = Array.from(root.querySelectorAll<HTMLElement>(
      ".affino-grid-dom__header-center .affino-grid-dom__header-group-row",
    ))
    expect(groupRows).toHaveLength(2)
    expect(groupRows[0]?.getAttribute("aria-rowindex")).toBe("1")
    expect(groupRows[1]?.getAttribute("aria-rowindex")).toBe("2")
    const performance = root.querySelector<HTMLElement>(
      ".affino-grid-dom__header-center [data-column-group-id=performance]",
    )!
    const financial = root.querySelector<HTMLElement>(
      ".affino-grid-dom__header-center [data-column-group-id=financial]",
    )!
    expect(performance.getAttribute("aria-colspan")).toBe("3")
    expect(performance.style.gridColumn).toBe("2 / span 3")
    expect(financial.getAttribute("aria-colspan")).toBe("2")
    expect(financial.style.gridColumn).toBe("2 / span 2")
    const organizationFragments = root.querySelectorAll<HTMLElement>('[data-column-group-id="organization"]')
    expect(organizationFragments).toHaveLength(2)
    expect(organizationFragments[0]?.textContent).toBe("Organization")
    expect(organizationFragments[1]?.classList.contains("affino-grid-dom__column-group-header--continuation")).toBe(true)
    expect(organizationFragments[1]?.textContent).toBe("")
    expect(root.querySelector('[data-column-group-empty="true"][data-column-group-depth="1"]')?.getAttribute("aria-hidden"))
      .toBe("true")

    const visibleColumns = demo.grid.api.columns.getSnapshot().visibleColumns
    expect(root.querySelectorAll('.affino-grid-dom__header [role="columnheader"][data-column-index]'))
      .toHaveLength(visibleColumns.length)
    const regionHeader = root.querySelector<HTMLElement>('.affino-grid-dom__header [data-column-index="0"]')!
    const quarterHeader = root.querySelector<HTMLElement>('.affino-grid-dom__header [data-column-index="5"]')!
    expect(regionHeader.textContent).toBe("Region")
    expect(regionHeader.classList.contains("affino-grid-dom__column-header--merged")).toBe(true)
    expect(quarterHeader.textContent).toBe("Quarter")
    expect(quarterHeader.classList.contains("affino-grid-dom__column-header--merged")).toBe(true)
    expect(root.querySelector('.affino-grid-dom__body [role="row"]')?.getAttribute("aria-rowindex")).toBe("4")
    expect(demo.grid.api.rows.getSnapshot().groupBy).toBeNull()
  })
})
