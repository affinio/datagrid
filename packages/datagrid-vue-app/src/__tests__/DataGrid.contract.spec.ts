import { nextTick } from "vue"
import { mount } from "@vue/test-utils"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import DataGrid from "../DataGrid"
import DataGridRuntimeHost from "../DataGridRuntimeHost"

interface DemoRow {
  rowId: string
  owner: string
  region: string
  amount: number
}

interface FormulaRow {
  id: number
  price: number
  qty: number
  subtotal?: number
}

const BASE_ROWS: readonly DemoRow[] = [
  { rowId: "r1", owner: "NOC", region: "eu-west", amount: 10 },
  { rowId: "r2", owner: "NOC", region: "us-east", amount: 20 },
  { rowId: "r3", owner: "Payments", region: "eu-west", amount: 30 },
]

const MANY_FILTER_ROWS: readonly DemoRow[] = Array.from({ length: 500 }, (_unused, index) => ({
  rowId: `m${index + 1}`,
  owner: index === 0 ? "NOC" : "Payments",
  region: index % 2 === 0 ? "eu-west" : "us-east",
  amount: index + 1,
}))

const SEARCH_FILTER_ROWS: readonly DemoRow[] = [
  { rowId: "s1", owner: "Alpha", region: "eu-west", amount: 10 },
  { rowId: "s2", owner: "Alpine", region: "us-east", amount: 20 },
  { rowId: "s3", owner: "Beta", region: "eu-west", amount: 30 },
  { rowId: "s4", owner: "Gamma", region: "us-east", amount: 40 },
]

const COLUMNS = [
  { key: "owner", label: "Owner", width: 180 },
  { key: "region", label: "Region", width: 160 },
  { key: "amount", label: "Amount", width: 140 },
] as const

const FORMULA_ROWS: readonly FormulaRow[] = [
  { id: 1, price: 12, qty: 3 },
  { id: 2, price: 5, qty: 4 },
]

const FORMULA_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "price", label: "Price" },
  { key: "qty", label: "Qty" },
  { key: "subtotal", label: "Subtotal" },
] as const

const GANTT_ROWS = [
  {
    rowId: "g1",
    id: "g1",
    task: "Discovery",
    start: new Date("2026-03-10T00:00:00.000Z"),
    end: new Date("2026-03-14T00:00:00.000Z"),
    progress: 0.5,
  },
  {
    rowId: "g2",
    id: "g2",
    task: "Delivery",
    start: new Date("2026-03-14T00:00:00.000Z"),
    end: new Date("2026-03-20T00:00:00.000Z"),
    progress: 0.2,
    dependencies: ["g1"],
  },
] as const

const GANTT_COLUMNS = [
  { key: "task", label: "Task", width: 220 },
  { key: "start", label: "Start", width: 140 },
  { key: "end", label: "End", width: 140 },
  { key: "progress", label: "Progress", width: 120 },
] as const

async function flushRuntimeTasks() {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

function resolveRowModel(wrapper: ReturnType<typeof mount>) {
  const vm = wrapper.vm as unknown as {
    rowModel?: { value?: { getSnapshot: () => unknown }; getSnapshot?: () => unknown }
  }
  return vm.rowModel && "value" in vm.rowModel
    ? vm.rowModel.value
    : vm.rowModel
}

function resolveVm(wrapper: ReturnType<typeof mount>) {
  return wrapper.vm as unknown as {
    getApi?: () => {
      rows: {
        getAggregationModel?: () => unknown
      }
    } | null
    getView?: () => "table" | "gantt"
    setView?: (mode: "table" | "gantt") => void
    getState?: () => unknown
    getColumnSnapshot?: () => { order: readonly string[]; columns: readonly Array<{
      key: string
      visible: boolean
      pin: string
      width: number | null
    }> } | null
  }
}

function queryColumnMenuRoot(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>("[data-affino-menu-root]")
}

function queryColumnMenuAction(action: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`[data-datagrid-column-menu-action="${action}"]`)
}

function queryAdvancedFilterRoot(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(".datagrid-advanced-filter")
}

function queryColumnLayoutRoot(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(".datagrid-column-layout")
}

function queryAggregationsRoot(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(".datagrid-aggregations")
}

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  HTMLElement.prototype.getBoundingClientRect = vi.fn(() => DOMRect.fromRect({
    x: 0,
    y: 0,
    width: 120,
    height: 32,
  }))
})

afterAll(() => {
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
})

describe("DataGrid app facade contract", () => {
  it("does not expose enterprise-only props on the community facade", () => {
    const publicProps = Object.keys((DataGrid as unknown as { props?: Record<string, unknown> }).props ?? {})

    expect(publicProps).not.toContain("licenseKey")
    expect(publicProps).not.toContain("diagnostics")
    expect(publicProps).not.toContain("formulaRuntime")
    expect(publicProps).not.toContain("formulaPacks")
    expect(publicProps).not.toContain("performance")
  })

  it("switches between table and gantt view modes through the public facade", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: GANTT_ROWS,
        columns: GANTT_COLUMNS,
        viewMode: "gantt",
        gantt: {
          startKey: "start",
          endKey: "end",
          progressKey: "progress",
          dependencyKey: "dependencies",
          labelKey: "task",
          idKey: "id",
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    expect(wrapper.find(".datagrid-gantt-stage").exists()).toBe(true)
    expect(resolveVm(wrapper).getView?.()).toBe("gantt")

    resolveVm(wrapper).setView?.("table")
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getView?.()).toBe("table")
    expect(wrapper.find(".datagrid-gantt-stage").exists()).toBe(false)
    expect(wrapper.find(".grid-stage").exists()).toBe(true)

    wrapper.unmount()
  })

  it("opens declarative columnMenu from package triggers and applies sort and pin actions", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: true,
      },
    })

    await flushRuntimeTasks()

    const ownerHeader = wrapper.find('.grid-cell--header[data-column-key="owner"]')

    expect(ownerHeader.exists()).toBe(true)

    await ownerHeader.trigger("click")
    await flushRuntimeTasks()
    expect(queryColumnMenuRoot()).toBeTruthy()

    document.body.querySelector<HTMLElement>("[data-affino-menu-root]")?.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    }))
    await flushRuntimeTasks()

    await ownerHeader.trigger("contextmenu", { button: 2, clientX: 140, clientY: 64 })
    await flushRuntimeTasks()
    expect(queryColumnMenuRoot()).toBeTruthy()

    queryColumnMenuAction("sort-desc")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveRowModel(wrapper)?.getSnapshot()).toMatchObject({
      sortModel: [{ key: "owner", direction: "desc" }],
    })

    await ownerHeader.trigger("click")
    await flushRuntimeTasks()
    queryColumnMenuAction("pin-submenu")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()
    queryColumnMenuAction("pin-right")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getColumnSnapshot?.()?.columns).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "owner", pin: "right" }),
    ]))

    wrapper.unmount()
  })

  it("applies value-set filter from declarative columnMenu", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: true,
      },
    })

    await flushRuntimeTasks()

    const ownerHeader = wrapper.find('.grid-cell--header[data-column-key="owner"]')
    await ownerHeader.trigger("click")
    await flushRuntimeTasks()

    const valueRows = Array.from(document.body.querySelectorAll<HTMLElement>(".datagrid-column-menu__value"))
    const paymentsRow = valueRows.find(row => row.textContent?.includes("Payments"))
    expect(paymentsRow).toBeTruthy()

    const paymentsCheckbox = paymentsRow!.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(paymentsCheckbox).toBeTruthy()
    paymentsCheckbox!.checked = false
    paymentsCheckbox!.dispatchEvent(new Event("change", { bubbles: true }))
    queryColumnMenuAction("apply-filter")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getState?.()).toMatchObject({
      rows: expect.objectContaining({
        snapshot: expect.objectContaining({
          filterModel: expect.objectContaining({
            columnFilters: expect.objectContaining({
              owner: expect.objectContaining({
                kind: "valueSet",
                tokens: expect.arrayContaining(["string:noc"]),
              }),
            }),
          }),
          rowCount: 2,
        }),
      }),
    })

    wrapper.unmount()
  })

  it("recomputes viewport spacers after declarative columnMenu filter shrinks the row set", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: MANY_FILTER_ROWS,
        columns: COLUMNS,
        columnMenu: true,
      },
    })

    await flushRuntimeTasks()

    const viewport = wrapper.find(".grid-body-viewport").element as HTMLElement
    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      value: 120,
    })
    viewport.scrollTop = 0
    await wrapper.find(".grid-body-viewport").trigger("scroll")
    await flushRuntimeTasks()

    expect(wrapper.findAll(".grid-body-viewport .grid-spacer").length).toBeGreaterThan(0)

    const ownerHeader = wrapper.find('.grid-cell--header[data-column-key="owner"]')
    await ownerHeader.trigger("click")
    await flushRuntimeTasks()

    const valueRows = Array.from(document.body.querySelectorAll<HTMLElement>(".datagrid-column-menu__value"))
    const paymentsRow = valueRows.find(row => row.textContent?.includes("Payments"))
    expect(paymentsRow).toBeTruthy()

    const paymentsCheckbox = paymentsRow!.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(paymentsCheckbox).toBeTruthy()
    paymentsCheckbox!.checked = false
    paymentsCheckbox!.dispatchEvent(new Event("change", { bubbles: true }))
    queryColumnMenuAction("apply-filter")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getState?.()).toMatchObject({
      rows: expect.objectContaining({
        snapshot: expect.objectContaining({
          rowCount: 1,
        }),
      }),
    })
    expect(wrapper.findAll(".grid-body-viewport .grid-spacer")).toHaveLength(0)

    wrapper.unmount()
  })

  it("applies searched value-set filter only from visible checked values", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: SEARCH_FILTER_ROWS,
        columns: COLUMNS,
        columnMenu: true,
      },
    })

    await flushRuntimeTasks()

    const ownerHeader = wrapper.find('.grid-cell--header[data-column-key="owner"]')
    await ownerHeader.trigger("click")
    await flushRuntimeTasks()

    const search = document.body.querySelector<HTMLInputElement>(".datagrid-column-menu__search")
    expect(search).toBeTruthy()
    search!.value = "alp"
    search!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushRuntimeTasks()

    const valueRows = Array.from(document.body.querySelectorAll<HTMLElement>(".datagrid-column-menu__value"))
    expect(valueRows).toHaveLength(2)

    const alpineRow = valueRows.find(row => row.textContent?.includes("Alpine"))
    expect(alpineRow).toBeTruthy()
    const alpineCheckbox = alpineRow!.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(alpineCheckbox).toBeTruthy()
    alpineCheckbox!.checked = false
    alpineCheckbox!.dispatchEvent(new Event("change", { bubbles: true }))
    await flushRuntimeTasks()

    queryColumnMenuAction("apply-filter")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getState?.()).toMatchObject({
      rows: expect.objectContaining({
        snapshot: expect.objectContaining({
          filterModel: expect.objectContaining({
            columnFilters: expect.objectContaining({
              owner: expect.objectContaining({
                kind: "valueSet",
                tokens: ["string:alpha"],
              }),
            }),
          }),
          rowCount: 1,
        }),
      }),
    })

    wrapper.unmount()
  })

  it("adds searched visible selection to the existing value-set filter when requested", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: SEARCH_FILTER_ROWS,
        columns: COLUMNS,
        columnMenu: true,
      },
    })

    await flushRuntimeTasks()

    const ownerHeader = wrapper.find('.grid-cell--header[data-column-key="owner"]')
    await ownerHeader.trigger("click")
    await flushRuntimeTasks()

    let search = document.body.querySelector<HTMLInputElement>(".datagrid-column-menu__search")
    expect(search).toBeTruthy()
    search!.value = "bet"
    search!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushRuntimeTasks()

    queryColumnMenuAction("apply-filter")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getState?.()).toMatchObject({
      rows: expect.objectContaining({
        snapshot: expect.objectContaining({
          filterModel: expect.objectContaining({
            columnFilters: expect.objectContaining({
              owner: expect.objectContaining({
                kind: "valueSet",
                tokens: ["string:beta"],
              }),
            }),
          }),
          rowCount: 1,
        }),
      }),
    })

    await ownerHeader.trigger("click")
    await flushRuntimeTasks()

    search = document.body.querySelector<HTMLInputElement>(".datagrid-column-menu__search")
    expect(search).toBeTruthy()
    search!.value = "alp"
    search!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushRuntimeTasks()

    const addCurrentSelection = queryColumnMenuAction("add-current-selection")?.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(addCurrentSelection).toBeTruthy()
    addCurrentSelection!.checked = true
    addCurrentSelection!.dispatchEvent(new Event("change", { bubbles: true }))
    await flushRuntimeTasks()

    const valueRows = Array.from(document.body.querySelectorAll<HTMLElement>(".datagrid-column-menu__value"))
    const alphaRow = valueRows.find(row => row.textContent?.includes("Alpha"))
    expect(alphaRow).toBeTruthy()
    const alphaCheckbox = alphaRow!.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(alphaCheckbox).toBeTruthy()
    alphaCheckbox!.checked = true
    alphaCheckbox!.dispatchEvent(new Event("change", { bubbles: true }))
    await flushRuntimeTasks()

    queryColumnMenuAction("apply-filter")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getState?.()).toMatchObject({
      rows: expect.objectContaining({
        snapshot: expect.objectContaining({
          filterModel: expect.objectContaining({
            columnFilters: expect.objectContaining({
              owner: expect.objectContaining({
                kind: "valueSet",
                tokens: expect.arrayContaining(["string:alpha", "string:beta"]),
              }),
            }),
          }),
          rowCount: 2,
        }),
      }),
    })

    wrapper.unmount()
  })

  it("opens declarative advancedFilter and applies the built-in clause expression", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        advancedFilter: true,
      },
    })

    await flushRuntimeTasks()

    const trigger = wrapper.findAll(".datagrid-app-toolbar__button").find(candidate => (
      candidate.text().includes("Advanced filter")
    ))
    expect(trigger).toBeTruthy()
    await trigger!.trigger("click")
    await flushRuntimeTasks()

    const popover = queryAdvancedFilterRoot()
    expect(popover).toBeTruthy()

    const valueInput = popover!.querySelector<HTMLInputElement>('input[type="text"]')
    expect(valueInput).toBeTruthy()
    valueInput!.value = "NOC"
    valueInput!.dispatchEvent(new Event("input", { bubbles: true }))

    popover!.querySelector<HTMLElement>(".datagrid-advanced-filter__primary")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getState?.()).toMatchObject({
      rows: expect.objectContaining({
        snapshot: expect.objectContaining({
          filterModel: expect.objectContaining({
            advancedExpression: expect.objectContaining({
              kind: "condition",
              key: "owner",
              operator: "contains",
              value: "NOC",
            }),
          }),
          rowCount: 2,
        }),
      }),
    })

    wrapper.unmount()
  })

  it("renders applied filter summary and resets all filters from one action", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: true,
        advancedFilter: true,
        filterModel: {
          columnFilters: {
            owner: {
              kind: "predicate",
              operator: "contains",
              value: "NOC",
              caseSensitive: false,
            },
          },
          advancedFilters: {
            region: {
              type: "text",
              clauses: [
                {
                  operator: "equals",
                  value: "eu-west",
                },
              ],
            },
          },
          advancedExpression: null,
        },
      },
    })

    await flushRuntimeTasks()

    const trigger = wrapper.findAll(".datagrid-app-toolbar__button").find(candidate => (
      candidate.text().includes("Advanced filter")
    ))
    expect(trigger).toBeTruthy()
    await trigger!.trigger("click")
    await flushRuntimeTasks()

    const popover = queryAdvancedFilterRoot()
    expect(popover).toBeTruthy()
    expect(popover?.textContent).toContain('Owner contains "NOC"')
    expect(popover?.textContent).toContain('Advanced: Region = "eu-west"')

    popover?.querySelector<HTMLElement>('[data-datagrid-advanced-filter-action="reset-all"]')?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getState?.()).toMatchObject({
      rows: expect.objectContaining({
        snapshot: expect.objectContaining({
          filterModel: null,
          rowCount: 3,
        }),
      }),
    })

    const reopenedTrigger = wrapper.findAll(".datagrid-app-toolbar__button").find(candidate => (
      candidate.text().includes("Advanced filter")
    ))
    await reopenedTrigger!.trigger("click")
    await flushRuntimeTasks()
    expect(queryAdvancedFilterRoot()?.textContent).toContain("No filters applied")

    wrapper.unmount()
  })

  it("opens declarative columnLayout and applies visibility and order changes", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnLayout: true,
      },
    })

    await flushRuntimeTasks()

    const trigger = wrapper.find(".datagrid-app-toolbar__button")
    expect(trigger.exists()).toBe(true)

    await trigger.trigger("click")
    await flushRuntimeTasks()

    const popover = queryColumnLayoutRoot()
    expect(popover).toBeTruthy()

    const rows = Array.from(popover!.querySelectorAll<HTMLElement>(".datagrid-column-layout__row"))
    const ownerRow = rows.find(row => row.textContent?.includes("Owner"))
    const regionRow = rows.find(row => row.textContent?.includes("Region"))
    expect(ownerRow).toBeTruthy()
    expect(regionRow).toBeTruthy()

    const regionUp = regionRow!.querySelectorAll<HTMLButtonElement>(".datagrid-column-layout__icon-button")[0]
    expect(regionUp).toBeTruthy()
    regionUp!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    const ownerCheckbox = ownerRow!.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(ownerCheckbox).toBeTruthy()
    ownerCheckbox!.checked = false
    ownerCheckbox!.dispatchEvent(new Event("change", { bubbles: true }))
    await flushRuntimeTasks()

    popover!.querySelector<HTMLElement>(".datagrid-column-layout__primary")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getColumnSnapshot?.()).toMatchObject({
      order: ["region", "owner", "amount"],
      columns: expect.arrayContaining([
        expect.objectContaining({ key: "owner", visible: false }),
        expect.objectContaining({ key: "region", visible: true }),
      ]),
    })

    wrapper.unmount()
  })

  it("opens declarative aggregations and applies the runtime aggregation model", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: [
          { key: "owner", label: "Owner" },
          { key: "amount", label: "Amount", dataType: "number", capabilities: { aggregatable: true } },
        ],
        aggregations: true,
      },
    })

    await flushRuntimeTasks()

    const trigger = wrapper.find(".datagrid-app-toolbar__button")
    expect(trigger.exists()).toBe(true)

    await trigger.trigger("click")
    await flushRuntimeTasks()

    const popover = queryAggregationsRoot()
    expect(popover).toBeTruthy()

    const amountCheckbox = popover?.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(amountCheckbox).toBeTruthy()
    amountCheckbox!.checked = true
    amountCheckbox!.dispatchEvent(new Event("change", { bubbles: true }))
    await flushRuntimeTasks()

    const amountOp = popover?.querySelector<HTMLSelectElement>(".datagrid-aggregations__op")
    expect(amountOp).toBeTruthy()
    amountOp!.value = "sum"
    amountOp!.dispatchEvent(new Event("change", { bubbles: true }))
    await flushRuntimeTasks()

    popover!.querySelector<HTMLElement>(".datagrid-aggregations__primary")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getApi?.()?.rows.getAggregationModel?.()).toMatchObject({
      basis: "filtered",
      columns: [{ key: "amount", op: "sum" }],
    })

    wrapper.unmount()
  })

  it("applies declarative groupBy to the internal client row model", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        groupBy: {
          fields: ["owner"],
          expandedByDefault: true,
        },
      },
    })

    await flushRuntimeTasks()

    const rowModel = resolveRowModel(wrapper)
    expect(rowModel?.getSnapshot()).toMatchObject({
      groupBy: {
        fields: ["owner"],
        expandedByDefault: true,
      },
    })

    wrapper.unmount()
  })

  it("applies declarative aggregationModel to the internal client row model", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        aggregationModel: {
          columns: [{ key: "amount", op: "sum" }],
          basis: "filtered",
        },
      },
    })

    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getApi?.()?.rows.getAggregationModel?.()).toMatchObject({
      basis: "filtered",
      columns: [{ key: "amount", op: "sum" }],
    })

    wrapper.unmount()
  })

  it("accepts groupBy shorthand as a single field string", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        groupBy: "owner",
      },
    })

    await flushRuntimeTasks()

    const rowModel = resolveRowModel(wrapper)
    expect(rowModel?.getSnapshot()).toMatchObject({
      groupBy: {
        fields: ["owner"],
        expandedByDefault: true,
      },
    })

    wrapper.unmount()
  })

  it("applies declarative pivotModel to the internal client row model", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        pivotModel: {
          rows: ["owner"],
          columns: ["region"],
          values: [{ field: "amount", agg: "sum" }],
        },
      },
    })

    await flushRuntimeTasks()

    const rowModel = resolveRowModel(wrapper)
    expect(rowModel?.getSnapshot()).toMatchObject({
      pivotModel: {
        rows: ["owner"],
        columns: ["region"],
        values: [{ field: "amount", agg: "sum" }],
      },
    })

    wrapper.unmount()
  })

  it("applies declarative columnState to the internal column model", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnState: {
          order: ["amount", "owner", "region"],
          visibility: {
            owner: true,
            region: false,
            amount: true,
          },
          widths: {
            owner: 240,
            region: 180,
            amount: 150,
          },
          pins: {
            owner: "left",
            region: "center",
            amount: "right",
          },
        },
      },
    })

    await flushRuntimeTasks()

    const columnSnapshot = resolveVm(wrapper).getColumnSnapshot?.()
    expect(columnSnapshot).toMatchObject({
      order: ["amount", "owner", "region"],
    })
    expect(columnSnapshot?.columns).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "owner", visible: true, width: 240, pin: "left" }),
      expect.objectContaining({ key: "region", visible: false, width: 180, pin: "none" }),
      expect.objectContaining({ key: "amount", visible: true, width: 150, pin: "right" }),
    ]))

    wrapper.unmount()
  })

  it("round-trips supported unified runtime state through the facade helpers", async () => {
    const source = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        sortModel: [{ key: "amount", direction: "desc" }],
        rowHeightMode: "auto",
        baseRowHeight: 44,
      },
    })

    await flushRuntimeTasks()

    const state = resolveVm(source).getState?.()
    expect(state).toBeTruthy()

    const target = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        state: state as Record<string, unknown>,
      },
    })

    await flushRuntimeTasks()

    expect(resolveVm(target).getState?.()).toMatchObject({
      rows: expect.objectContaining({
        snapshot: expect.objectContaining({
          sortModel: [{ key: "amount", direction: "desc" }],
        }),
      }),
    })

    source.unmount()
    target.unmount()
  })

  it("emits unified state updates when declarative props mutate runtime state", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const updates = wrapper.emitted("update:state") ?? []
    expect(updates.length).toBeGreaterThan(0)

    wrapper.unmount()
  })

  it("does not emit unified state updates for selection-only changes", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const initialUpdateCount = (wrapper.emitted("update:state") ?? []).length
    const runtimeHost = wrapper.findComponent(DataGridRuntimeHost)

    runtimeHost.vm.$emit("selection-change", {
      snapshot: {
        activeCell: { rowIndex: 0, columnIndex: 0 },
        anchorCell: { rowIndex: 0, columnIndex: 0 },
        ranges: [{ startRow: 0, endRow: 2, startCol: 0, endCol: 2 }],
      },
    })

    await flushRuntimeTasks()

    expect((wrapper.emitted("update:state") ?? []).length).toBe(initialUpdateCount)
    expect((wrapper.emitted("selection-change") ?? []).length).toBe(1)

    wrapper.unmount()
  })

  it("accepts pagination shorthand with pageSize and currentPage props", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        pagination: true,
        pageSize: 50,
        currentPage: 2,
      },
    })

    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getState?.()).toMatchObject({
      rows: expect.objectContaining({
        snapshot: expect.objectContaining({
          pagination: expect.objectContaining({
            enabled: true,
            pageSize: 50,
            currentPage: 0,
          }),
        }),
      }),
    })

    wrapper.unmount()
  })

  it("builds embedded column formulas declaratively on the owned client row model", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: FORMULA_ROWS,
        columns: FORMULA_COLUMNS.map(column => (
          column.key === "subtotal"
            ? { ...column, formula: "price * qty" }
            : column
        )),
        clientRowModelOptions: {
          resolveRowId: (row: FormulaRow) => row.id,
        },
      },
    })

    await flushRuntimeTasks()

    const rowModel = resolveRowModel(wrapper) as {
      getRow?: (index: number) => { row?: FormulaRow } | undefined
      getFormulaFields?: () => readonly Array<{ name: string }>
    } | null

    expect(rowModel?.getFormulaFields?.()).toEqual([
      expect.objectContaining({ name: "subtotal" }),
    ])
    expect(rowModel?.getRow?.(0)?.row).toMatchObject({
      subtotal: 36,
    })

    wrapper.unmount()
  })

  it("applies declarative theme tokens to the app root element", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: true,
        theme: {
          tokens: {
            gridAccentStrong: "#b45309",
            gridHeaderCellBackgroundColor: "#f4e8d5",
            gridColumnMenuBackgroundColor: "#fff8ef",
          },
        },
      },
    })

    await flushRuntimeTasks()

    const rootElement = wrapper.find(".affino-datagrid-app-root").element as HTMLElement
    expect(rootElement.style.getPropertyValue("--datagrid-accent-strong")).toBe("#b45309")
    expect(rootElement.style.getPropertyValue("--datagrid-header-cell-bg")).toBe("#f4e8d5")
    expect(rootElement.style.getPropertyValue("--datagrid-column-menu-bg")).toBe("#fff8ef")

    await wrapper.find('.grid-cell--header[data-column-key="owner"]').trigger("click")
    await flushRuntimeTasks()

    const menuRoot = queryColumnMenuRoot()
    expect(menuRoot?.style.getPropertyValue("--datagrid-column-menu-bg")).toBe("#fff8ef")

    wrapper.unmount()
  })
})
