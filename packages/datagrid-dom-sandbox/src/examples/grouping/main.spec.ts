import { afterEach, describe, expect, it } from "vitest"
import { mountGroupingDemo, type GroupingDemoHandle } from "./main"

describe("grouping sandbox example", () => {
  let demo: GroupingDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("renders Core group rows and toggles expansion through row identity", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountGroupingDemo(root)
    await demo.grid.ready

    const groupRow = root.querySelector<HTMLElement>('.affino-grid-dom__row[data-row-id^="group:"]')
    expect(groupRow).not.toBeNull()
    const toggle = groupRow!.querySelector<HTMLButtonElement>("[data-group-toggle]")!
    const aggregateCell = groupRow!.querySelectorAll<HTMLElement>("[role=gridcell]")[2]!
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    expect(groupRow!.textContent).toContain("Platform")
    expect(aggregateCell.textContent).toBe("16")
    expect(aggregateCell.classList.contains("affino-grid-dom__cell--group-aggregate")).toBe(true)
    expect(root.querySelectorAll('.affino-grid-dom__row[data-row-id^="group:"]')).toHaveLength(2)
    expect(Array.from(root.querySelectorAll(".affino-grid-dom__header-center [role=columnheader]"))
      .map(cell => cell.textContent)).toEqual(["Work item", "Status", "Points"])
    expect(groupRow!.querySelector("[role=gridcell]")?.textContent).toContain("Team: Platform")

    groupRow!.querySelector<HTMLElement>("[role=gridcell]")!.click()
    const selectedGroupCell = root.querySelector<HTMLElement>(
      '.affino-grid-dom__row[data-row-id^="group:"] [role=gridcell]',
    )!
    expect(selectedGroupCell.getAttribute("aria-selected")).toBe("true")
    expect(selectedGroupCell.classList.contains("affino-grid-dom__cell--range-frame")).toBe(true)
    const gridElement = root.querySelector<HTMLElement>("[role=grid]")!
    gridElement.dispatchEvent(new KeyboardEvent("keydown", {
      key: "ArrowDown",
      code: "ArrowDown",
      bubbles: true,
      shiftKey: true,
    }))
    expect(demo.grid.api.selection.getSnapshot()?.activeCell).toMatchObject({ rowIndex: 1, colIndex: 0 })
    expect(root.querySelector('.affino-grid-dom__row[data-row-id^="group:"] [role=gridcell]')
      ?.classList.contains("affino-grid-dom__cell--range-top")).toBe(true)

    toggle.click()
    expect(root.querySelectorAll('.affino-grid-dom__row[data-row-id^="group:"]')).toHaveLength(2)
    expect(root.querySelectorAll(".affino-grid-dom__group-toggle[aria-expanded='true']")).toHaveLength(1)
    expect(demo.grid.api.rows.getCount()).toBe(4)

    root.querySelector<HTMLButtonElement>('[data-group-action="expand-all"]')?.click()
    expect(demo.grid.api.rows.getCount()).toBe(7)
    root.querySelector<HTMLButtonElement>('[data-group-action="collapse-all"]')?.click()
    expect(demo.grid.api.rows.getCount()).toBe(2)

    const select = root.querySelector<HTMLSelectElement>("[data-group-by]")!
    select.value = "team-status"
    select.dispatchEvent(new Event("change", { bubbles: true }))
    expect(demo.grid.api.rows.getSnapshot().groupBy?.fields).toEqual(["team", "status"])
    expect(root.querySelectorAll('.affino-grid-dom__row[aria-level="2"]')).toHaveLength(5)
    expect(root.querySelector('.affino-grid-dom__row[aria-level="2"] [role=gridcell]')?.textContent)
      .toContain("Status:")
    expect(root.querySelector('.affino-grid-dom__row[aria-level="2"] .affino-grid-dom__group-label')?.getAttribute("style"))
      .toContain("padding-inline-start: 16px")
    expect(root.querySelector(".affino-grid-dom__group-leaf-label")?.getAttribute("style"))
      .toContain("padding-inline-start: 32px")
  })

  it("switches grouping fields and clears grouping via the native control", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountGroupingDemo(root)
    await demo.grid.ready

    const select = root.querySelector<HTMLSelectElement>("[data-group-by]")!
    select.value = "status"
    select.dispatchEvent(new Event("change", { bubbles: true }))
    expect(demo.grid.api.rows.getSnapshot().groupBy?.fields).toEqual(["status"])
    expect(root.querySelectorAll(".affino-grid-dom__group-toggle")).toHaveLength(4)
    expect(Array.from(root.querySelectorAll(".affino-grid-dom__header-center [role=columnheader]"))
      .map(cell => cell.textContent)).toEqual(["Work item", "Team", "Points"])

    const titleHeader = root.querySelector<HTMLElement>('.affino-grid-dom__column-header[data-column-index="0"]')!
    const resizeHandle = titleHeader.querySelector<HTMLElement>("[data-column-resize-handle]")!
    titleHeader.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, right: 286, top: 0, bottom: 32, width: 286, height: 32,
      toJSON: () => ({}),
    })
    resizeHandle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 100, pointerId: 1 }))
    document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 112, pointerId: 1 }))
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }))
    expect(demo.grid.api.columns.get("title")?.width).toBe(298)

    select.value = ""
    select.dispatchEvent(new Event("change", { bubbles: true }))
    expect(demo.grid.api.rows.getSnapshot().groupBy).toBeNull()
    expect(root.querySelectorAll(".affino-grid-dom__group-toggle")).toHaveLength(0)
    expect(demo.grid.api.rows.getCount()).toBe(5)
  })

  it("toggles the active group row with Space", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountGroupingDemo(root)
    await demo.grid.ready

    const firstGroupCell = root.querySelector<HTMLElement>(
      '.affino-grid-dom__row[data-row-id^="group:"] [role=gridcell]',
    )!
    firstGroupCell.click()
    expect(demo.grid.api.rows.get(demo.grid.api.selection.getSnapshot()!.activeCell!.rowIndex)?.kind).toBe("group")
    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    const collapse = new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true })
    grid.dispatchEvent(collapse)
    expect(collapse.defaultPrevented).toBe(true)
    expect(demo.grid.api.rows.getCount()).toBe(4)
    expect(root.querySelector('.affino-grid-dom__row[data-row-id^="group:"] [role=gridcell]')
      ?.classList.contains("affino-grid-dom__cell--range-frame")).toBe(true)
    expect(demo.grid.api.selection.getSnapshot()?.activeCell).toMatchObject({ rowIndex: 0, colIndex: 0 })
    expect(root.querySelector('.affino-grid-dom__row[data-row-id^="group:"] [role=gridcell]')
      ?.classList.contains("affino-grid-dom__cell--range-frame")).toBe(true)

    const expand = new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true })
    grid.dispatchEvent(expand)
    expect(expand.defaultPrevented).toBe(true)
    expect(demo.grid.api.rows.getCount()).toBe(7)

    const disclosure = root.querySelector<HTMLButtonElement>("[data-group-toggle]")!
    disclosure.focus()
    const buttonSpace = new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true })
    disclosure.dispatchEvent(buttonSpace)
    expect(buttonSpace.defaultPrevented).toBe(true)
    expect(demo.grid.api.rows.getCount()).toBe(4)
  })

  it("keeps the cell selection visible on a collapsed group when its child was selected", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountGroupingDemo(root)
    await demo.grid.ready

    const rows = root.querySelectorAll<HTMLElement>('.affino-grid-dom__row[role="row"]')
    rows[1]!.querySelector<HTMLElement>("[role=gridcell]")!.click()
    const groupKey = demo.grid.api.rows.get(0)?.groupMeta?.groupKey
    expect(groupKey).toBeTruthy()
    root.querySelector<HTMLButtonElement>("[data-group-toggle]")!.click()

    expect(demo.grid.api.selection.getSnapshot()?.activeCell).toMatchObject({ rowIndex: 0, colIndex: 0 })
    const collapsedGroupCell = root.querySelector<HTMLElement>(
      '.affino-grid-dom__row[data-row-id^="group:"] [role=gridcell]',
    )!
    expect(collapsedGroupCell.getAttribute("aria-selected")).toBe("true")
    expect(collapsedGroupCell.classList.contains("affino-grid-dom__cell--range-frame")).toBe(true)
  })
})
