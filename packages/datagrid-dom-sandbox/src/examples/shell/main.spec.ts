import { afterEach, describe, expect, it, vi } from "vitest"
import { mountShellDemo, type ShellDemoHandle } from "./main"

describe("DOM shell sandbox example", () => {
  let demo: ShellDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
    vi.restoreAllMocks()
  })

  it("filters through Core and exposes row selection", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountShellDemo(root)
    await demo.grid.ready

    expect(demo.grid.api.rows.getCount()).toBe(180)
    expect(root.querySelector(".shell-demo__stage-badge")?.textContent).toBe("Renewal")
    expect(root.querySelector(".shell-demo__stage-badge--renewal")).not.toBeNull()
    const input = root.querySelector<HTMLInputElement>('[aria-label="Quick filter"]')!
    input.value = "maya emea"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    expect(demo.grid.api.rows.getCount()).toBeGreaterThan(0)
    expect(demo.grid.api.rows.getCount()).toBeLessThan(180)
    expect(demo.grid.api.rows.getSnapshot().filterModel?.quickFilter?.mode).toBe("tokens")
    expect(root.querySelector(".affino-grid-dom__row-selection-checkbox")).not.toBeNull()
  })

  it("renders nested column groups across the pinned and center header panes", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountShellDemo(root)
    await demo.grid.ready

    expect(root.querySelectorAll(".affino-grid-dom__header-center .affino-grid-dom__header-group-row")).toHaveLength(2)
    expect(root.querySelector('.affino-grid-dom__header-left .affino-grid-dom__header-overlay-layer [data-row-selection-select-all]')).not.toBeNull()
    expect(root.querySelector('.affino-grid-dom__header-left .affino-grid-dom__row-selection-header-placeholder')).not.toBeNull()
    expect(root.querySelector('.affino-grid-dom__header-left [data-column-group-id="customer"]')?.textContent).toBe("Customer")
    expect(root.querySelector('.affino-grid-dom__header-center [data-column-group-id="account-coverage"]')?.textContent).toBe("Coverage")
    expect(root.querySelector('.affino-grid-dom__header-center [data-column-group-id="financials"]')?.textContent).toBe("Financials")
    expect(root.querySelector('.affino-grid-dom__header-center [data-column-group-id="revenue"]')?.getAttribute("aria-colspan")).toBe("4")
    expect(root.querySelector('.affino-grid-dom__header-center [data-column-group-id="signals"]')?.getAttribute("aria-colspan")).toBe("3")
  })

  it("applies AND/OR compound filters without replacing the quick filter", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountShellDemo(root)
    await demo.grid.ready

    const quickFilter = root.querySelector<HTMLInputElement>('[aria-label="Quick filter"]')!
    quickFilter.value = "maya"
    quickFilter.dispatchEvent(new Event("input", { bubbles: true }))

    const stage = root.querySelector<HTMLSelectElement>("[data-compound-filter-stage]")!
    const join = root.querySelector<HTMLSelectElement>("[data-compound-filter-join]")!
    const apply = root.querySelector<HTMLButtonElement>("[data-compound-filter-apply]")!
    stage.value = "At risk"
    apply.click()
    const andCount = demo.grid.api.rows.getCount()
    expect(demo.grid.api.rows.getSnapshot().filterModel?.advancedExpression).toMatchObject({
      kind: "group",
      operator: "and",
      children: [
        { kind: "condition", key: "stage", operator: "equals", value: "At risk" },
        { kind: "condition", key: "arr", operator: "gte", value: 100000 },
      ],
    })

    join.value = "or"
    apply.click()
    const filterModel = demo.grid.api.rows.getSnapshot().filterModel
    expect(filterModel?.advancedExpression).toMatchObject({ kind: "group", operator: "or" })
    expect(filterModel?.quickFilter?.query).toBe("maya")
    expect(demo.grid.api.rows.getCount()).toBeGreaterThan(andCount)

    root.querySelector<HTMLButtonElement>("[data-compound-filter-clear]")!.click()
    expect(demo.grid.api.rows.getSnapshot().filterModel?.advancedExpression).toBeUndefined()
    expect(demo.grid.api.rows.getSnapshot().filterModel?.quickFilter?.query).toBe("maya")
  })

  it("opens the column menu and applies Core sorting and value filters", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountShellDemo(root)
    await demo.grid.ready

    const trigger = root.querySelector<HTMLButtonElement>('[data-column-menu-trigger="stage"]')!
    trigger.focus()
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }))
    const menu = document.querySelector<HTMLElement>("[data-datagrid-column-menu-panel]")!
    expect(menu.hidden).toBe(false)
    menu.querySelector<HTMLInputElement>(".affino-grid-dom-column-menu__search")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))
    expect(menu.hidden).toBe(true)
    expect(document.activeElement).toBe(trigger)

    trigger.click()
    expect(menu.hidden).toBe(false)
    menu.querySelector<HTMLButtonElement>('[data-menu-action="sort-asc"]')!.click()
    expect(demo.grid.api.rows.getSnapshot().sortModel).toEqual([{ key: "stage", direction: "asc" }])

    const stageTrigger = root.querySelector<HTMLButtonElement>('[data-column-menu-trigger="stage"]')!
    stageTrigger.click()
    const filterMenu = document.querySelector<HTMLElement>("[data-datagrid-column-menu-panel]")!
    await vi.waitFor(() => expect(filterMenu.querySelectorAll("input[data-filter-token]").length).toBeGreaterThan(0))
    const riskOption = Array.from(filterMenu.querySelectorAll<HTMLLabelElement>(".affino-grid-dom-column-menu__value"))
      .find(option => option.textContent?.includes("At risk"))!
    const riskCheckbox = riskOption.querySelector<HTMLInputElement>("input")!
    expect(riskCheckbox.checked).toBe(true)
    riskCheckbox.checked = false
    riskCheckbox.dispatchEvent(new Event("change", { bubbles: true }))
    filterMenu.querySelector<HTMLButtonElement>('[data-filter-action="apply-filter"]')!.click()
    expect(demo.grid.api.rows.getSnapshot().filterModel?.columnFilters?.stage?.kind).toBe("valueSet")
    expect(demo.grid.api.rows.getCount()).toBeLessThan(180)
  })

  it("applies a typed numeric predicate from the column menu", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountShellDemo(root)
    await demo.grid.ready

    root.querySelector<HTMLButtonElement>('[data-column-menu-trigger="arr"]')!.click()
    const menu = document.querySelector<HTMLElement>("[data-datagrid-column-menu-panel]")!
    const section = menu.querySelector<HTMLElement>(".affino-grid-dom-column-menu__condition")!
    const operator = section.querySelector<HTMLSelectElement>("select")!
    expect(Array.from(operator.options).map(option => option.value)).toContain("gte")
    operator.value = "gte"
    const value = section.querySelector<HTMLInputElement>('input[type="number"]')!
    value.value = "100000"
    section.querySelector<HTMLButtonElement>('[data-filter-action="apply-condition"]')!.click()

    const predicate = demo.grid.api.rows.getSnapshot().filterModel?.columnFilters?.arr
    expect(predicate).toMatchObject({ kind: "predicate", operator: "gte", value: 100000 })
    expect(demo.grid.api.rows.getCount()).toBeGreaterThan(0)
    expect(demo.grid.api.rows.getCount()).toBeLessThan(180)
  })

  it("keeps grouping under the shared column presentation and exposes aggregate and pivot actions", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountShellDemo(root)
    await demo.grid.ready

    const body = root.querySelector<HTMLElement>(".affino-grid-dom__body")!
    body.scrollLeft = 86
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      window.setTimeout(() => callback(0), 0)
      return 1
    })
    root.querySelector<HTMLButtonElement>('[data-column-menu-trigger="region"]')!.click()
    document.querySelector<HTMLButtonElement>('[data-menu-action="group-toggle"]')!.click()
    expect(demo.grid.api.rows.getSnapshot().groupBy?.fields).toEqual(["region"])
    await vi.waitFor(() => expect(body.scrollLeft).toBe(0))
    expect(demo.grid.api.columns.getSnapshot().visibleColumns[0]?.key).toBe("account")

    root.querySelector<HTMLButtonElement>('[data-toolbar-action="aggregate"]')!.click()
    await vi.waitFor(() => expect(demo!.grid.api.rows.getAggregationModel()).not.toBeNull())
    expect(demo.grid.api.rows.get(0)?.kind).toBe("group")
    expect(Number(demo.grid.api.rows.get(0)?.groupMeta?.aggregates?.arr)).toBeGreaterThan(0)

    root.querySelector<HTMLButtonElement>('[data-toolbar-action="pivot-arr"]')!.click()
    await vi.waitFor(() => expect(demo!.grid.api.pivot.getModel()).not.toBeNull())
    expect(demo.grid.api.columns.getSnapshot().visibleColumns.some(column => column.key.startsWith("pivot|"))).toBe(true)
    root.querySelector<HTMLButtonElement>('[data-toolbar-action="clear-analysis"]')!.click()
    await vi.waitFor(() => expect(demo!.grid.api.pivot.getModel()).toBeNull())
  })
})
