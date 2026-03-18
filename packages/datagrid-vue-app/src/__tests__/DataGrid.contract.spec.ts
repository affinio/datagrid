import { nextTick } from "vue"
import { mount } from "@vue/test-utils"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { DataGridRowNodeInput } from "@affino/datagrid-core"
import DataGrid from "../DataGrid"
import {
  clearDataGridSavedViewInStorage,
  parseDataGridSavedView,
  readDataGridSavedViewFromStorage,
  serializeDataGridSavedView,
  writeDataGridSavedViewToStorage,
} from "../config/dataGridSavedView"
import DataGridRuntimeHost from "../host/DataGridRuntimeHost"

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

interface DateRow {
  rowId: string
  createdAt: Date
}

interface DateTimeRow {
  rowId: string
  updatedAt: Date
}

const BASE_ROWS: readonly DemoRow[] = [
  { rowId: "r1", owner: "NOC", region: "eu-west", amount: 10 },
  { rowId: "r2", owner: "NOC", region: "us-east", amount: 20 },
  { rowId: "r3", owner: "Payments", region: "eu-west", amount: 30 },
]

const PIVOT_HEADER_ROWS = [
  { rowId: "p1", owner: "NOC", month: "2026-01", channel: "Web", amount: 10 },
  { rowId: "p2", owner: "NOC", month: "2026-01", channel: "Email", amount: 15 },
  { rowId: "p3", owner: "NOC", month: "2026-02", channel: "Web", amount: 20 },
  { rowId: "p4", owner: "Payments", month: "2026-02", channel: "Email", amount: 25 },
] as const

const PIVOT_HEADER_COLUMNS = [
  { key: "owner", label: "Owner", width: 180 },
  { key: "month", label: "Month", width: 140 },
  { key: "channel", label: "Channel", width: 140 },
  { key: "amount", label: "Amount", width: 140 },
] as const

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

const FLEX_COLUMNS = [
  { key: "owner", label: "Owner", flex: 1, initialState: { width: 180 } },
  { key: "region", label: "Region", initialState: { width: 160 } },
  { key: "amount", label: "Amount", initialState: { width: 140 } },
] as const

const PINNED_FLEX_COLUMNS = [
  { key: "owner", label: "Owner", flex: 1, initialState: { width: 180, pin: "left" } },
  { key: "region", label: "Region", initialState: { width: 160 } },
  { key: "amount", label: "Amount", initialState: { width: 140 } },
] as const

const PINNED_BOTTOM_SELECTION_COLUMNS = [
  { key: "project", label: "Project", width: 180 },
  { key: "monday", label: "Monday", width: 120 },
  { key: "tuesday", label: "Tuesday", width: 120 },
] as const

const PINNED_BOTTOM_SELECTION_ROWS: readonly DataGridRowNodeInput<Record<string, unknown>>[] = [
  {
    kind: "leaf",
    rowId: "pb1",
    rowKey: "pb1",
    sourceIndex: 0,
    originalIndex: 0,
    displayIndex: 0,
    state: { selected: false, group: false, pinned: "none", expanded: false },
    data: { project: "Alpha", monday: 4, tuesday: 6 },
    row: { project: "Alpha", monday: 4, tuesday: 6 },
  },
  {
    kind: "leaf",
    rowId: "pb2",
    rowKey: "pb2",
    sourceIndex: 1,
    originalIndex: 1,
    displayIndex: 1,
    state: { selected: false, group: false, pinned: "none", expanded: false },
    data: { project: "Beta", monday: 8, tuesday: 9 },
    row: { project: "Beta", monday: 8, tuesday: 9 },
  },
  {
    kind: "leaf",
    rowId: "pb3",
    rowKey: "pb3",
    sourceIndex: 2,
    originalIndex: 2,
    displayIndex: 2,
    state: { selected: false, group: false, pinned: "none", expanded: false },
    data: { project: "Gamma", monday: 1, tuesday: 2 },
    row: { project: "Gamma", monday: 1, tuesday: 2 },
  },
  {
    kind: "leaf",
    rowId: "pb-total",
    rowKey: "pb-total",
    sourceIndex: 3,
    originalIndex: 3,
    displayIndex: 3,
    state: { selected: false, group: false, pinned: "bottom", expanded: false },
    data: { project: "Total", monday: 100, tuesday: 200 },
    row: { project: "Total", monday: 100, tuesday: 200 },
  },
]

const EDITABLE_COLUMNS = [
  { key: "owner", label: "Owner", width: 180, capabilities: { editable: true } },
  { key: "region", label: "Region", width: 160 },
  { key: "amount", label: "Amount", width: 140 },
] as const

const READONLY_OWNER_COLUMNS = [
  { key: "owner", label: "Owner", width: 180, capabilities: { editable: false } },
  { key: "region", label: "Region", width: 160 },
  { key: "amount", label: "Amount", width: 140 },
] as const

const CHECKBOX_COLUMNS = [
  { key: "approved", label: "Approved", width: 140, cellType: "checkbox", capabilities: { editable: true } },
] as const

const CHECKBOX_ROWS = [
  { rowId: "c1", approved: true },
] as const

const SELECT_COLUMNS = [
  {
    key: "stage",
    label: "Stage",
    width: 160,
    cellType: "select",
    capabilities: { editable: true },
    presentation: {
      options: [
        { value: "backlog", label: "Backlog" },
        { value: "planned", label: "Planned" },
        { value: "done", label: "Done" },
      ],
    },
  },
] as const

const SELECT_ROWS = [
  { rowId: "s1", stage: "backlog" },
] as const

const DATE_COLUMNS = [
  { key: "createdAt", label: "Created", dataType: "date", capabilities: { editable: true } },
] as const

const DATE_ROWS: readonly DateRow[] = [
  { rowId: "d1", createdAt: new Date("2026-03-10T00:00:00.000Z") },
] as const

const DATETIME_COLUMNS = [
  {
    key: "updatedAt",
    label: "Updated",
    dataType: "datetime",
    capabilities: { editable: true },
    presentation: {
      format: {
        dateTime: {
          locale: "en-GB",
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        },
      },
    },
  },
] as const

const DATETIME_ROWS: readonly DateTimeRow[] = [
  { rowId: "dt1", updatedAt: new Date("2026-03-10T08:30:00.000Z") },
] as const

const RANKED_SELECT_COLUMNS = [
  {
    key: "stage",
    label: "Stage",
    width: 180,
    cellType: "select",
    capabilities: { editable: true },
    presentation: {
      options: [
        { value: "planned", label: "Planned" },
        { value: "plan-review", label: "Plan Review" },
        { value: "backplanned", label: "Backplanned" },
      ],
    },
  },
] as const

const ASYNC_SELECT_ROWS = [
  { rowId: "a1", stage: "review" },
] as const

const CURRENCY_EDIT_COLUMNS = [
  {
    key: "amount",
    label: "Amount",
    width: 160,
    cellType: "currency",
    capabilities: { editable: true },
    presentation: {
      format: {
        number: {
          locale: "en-GB",
          style: "currency",
          currency: "GBP",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      },
    },
  },
] as const

const CURRENCY_EDIT_ROWS = [
  { rowId: "money-1", amount: 10 },
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
      selection?: {
        setSnapshot?: (snapshot: unknown) => void
      }
      rowSelection: {
        getSnapshot?: () => unknown
      }
      rows: {
        getAggregationModel?: () => unknown
      }
    } | null
    getSelectionAggregatesLabel?: () => string
    getView?: () => "table" | "gantt"
    setView?: (mode: "table" | "gantt") => void
    getSavedView?: () => { state: unknown; viewMode?: "table" | "gantt" } | null
    migrateSavedView?: (savedView: unknown) => { state: unknown; viewMode?: "table" | "gantt" } | null
    applySavedView?: (savedView: { state: unknown; viewMode?: "table" | "gantt" }) => boolean
    getState?: () => unknown
    getColumnSnapshot?: () => { order: readonly string[]; columns: readonly Array<{
      key: string
      visible: boolean
      pin: string
      width: number | null
    }> } | null
  }
}

function resolveRowAt<TValue extends Record<string, unknown>>(wrapper: ReturnType<typeof mount>, index: number): TValue | null {
  const rowModel = resolveRowModel(wrapper) as {
    getRow?: (rowIndex: number) => { row?: TValue } | undefined
  } | null
  return rowModel?.getRow?.(index)?.row ?? null
}

function queryColumnMenuRoot(): HTMLElement | null {
  const roots = Array.from(document.body.querySelectorAll<HTMLElement>("[data-affino-menu-root]"))
  return roots.findLast(root => getComputedStyle(root).display !== "none") ?? null
}

function queryColumnMenuAction(action: string): HTMLElement | null {
  const selector = `[data-datagrid-column-menu-action="${action}"]`
  const rootMatch = queryColumnMenuRoot()?.querySelector<HTMLElement>(selector)
  if (rootMatch) {
    return rootMatch
  }
  const matches = Array.from(document.body.querySelectorAll<HTMLElement>(selector))
  return matches.findLast(match => getComputedStyle(match).display !== "none") ?? null
}

function queryColumnMenuActionTitle(action: string): string | null {
  const element = queryColumnMenuAction(action)
  if (!element) {
    return null
  }
  const dataReason = element.getAttribute("data-disabled-reason")
  if (dataReason) {
    return dataReason
  }
  const ownTitle = element.getAttribute("title")
  if (ownTitle) {
    return ownTitle
  }
  return element.querySelector<HTMLElement>("[title]")?.getAttribute("title") ?? null
}

function queryColumnMenuButton(columnKey: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`[data-datagrid-column-menu-button="true"][data-column-key="${columnKey}"]`)
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

function queryVisibleComboboxPanel(): HTMLElement | null {
  const panels = Array.from(document.body.querySelectorAll<HTMLElement>(".datagrid-cell-combobox__panel"))
  return panels.findLast(panel => getComputedStyle(panel).display !== "none") ?? null
}

function queryBodyCell(wrapper: ReturnType<typeof mount>, rowIndex: number, columnIndex: number) {
  const hasRowSelectionColumn = wrapper.find(".grid-body-pane--left .grid-cell--row-selection").exists()
  const resolvedColumnIndex = hasRowSelectionColumn ? columnIndex + 1 : columnIndex
  return wrapper.find(`.grid-body-viewport .grid-cell[data-row-index="${rowIndex}"][data-column-index="${resolvedColumnIndex}"]`)
}

function queryPinnedBottomCell(wrapper: ReturnType<typeof mount>, rowIndex: number, columnIndex: number) {
  const hasRowSelectionColumn = wrapper.find(".grid-body-pane--left .grid-cell--row-selection").exists()
  const resolvedColumnIndex = hasRowSelectionColumn ? columnIndex + 1 : columnIndex
  return wrapper.find(`.grid-body-viewport--pinned-bottom .grid-cell[data-row-index="${rowIndex}"][data-column-index="${resolvedColumnIndex}"]`)
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

function setElementClientWidth(element: HTMLElement, width: number): void {
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: width,
  })
}

describe("DataGrid app facade contract", () => {
  it("does not expose enterprise-only props on the community facade", () => {
    const publicProps = Object.keys((DataGrid as unknown as { props?: Record<string, unknown> }).props ?? {})

    expect(publicProps).not.toContain("licenseKey")
    expect(publicProps).not.toContain("diagnostics")
    expect(publicProps).not.toContain("formulaRuntime")
    expect(publicProps).not.toContain("formulaPacks")
    expect(publicProps).not.toContain("performance")
    expect(publicProps).toContain("isCellEditable")
  })

  it("keeps a column editable cell read-only when the public predicate returns false", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: EDITABLE_COLUMNS,
        isCellEditable: ({ rowId }: { rowId: string }) => rowId !== "r1",
      },
    })

    await flushRuntimeTasks()

    const cell = queryBodyCell(wrapper, 0, 0)
    expect(cell.exists()).toBe(true)

    await cell.trigger("dblclick")
    await flushRuntimeTasks()

    expect(wrapper.find(".cell-editor-input").exists()).toBe(false)

    wrapper.unmount()
  })

  it("opens inline editing when the column is editable and the public predicate returns true", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: EDITABLE_COLUMNS,
        isCellEditable: () => true,
      },
    })

    await flushRuntimeTasks()

    const cell = queryBodyCell(wrapper, 0, 0)
    await cell.trigger("dblclick")
    await flushRuntimeTasks()

    expect(wrapper.find(".cell-editor-input").exists()).toBe(true)

    wrapper.unmount()
  })

  it("hides row numbers and checkbox selection when the public toggles are disabled", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: EDITABLE_COLUMNS,
        showRowIndex: false,
        rowSelection: false,
      },
    })

    await flushRuntimeTasks()

    expect(wrapper.find(".grid-cell--index-number").exists()).toBe(false)
    expect(wrapper.find(".grid-cell--row-selection").exists()).toBe(false)

    wrapper.unmount()
  })

  it("keeps a cell read-only when the column is explicitly non-editable even if the predicate returns true", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: READONLY_OWNER_COLUMNS,
        isCellEditable: () => true,
      },
    })

    await flushRuntimeTasks()

    const cell = queryBodyCell(wrapper, 0, 0)
    await cell.trigger("dblclick")
    await flushRuntimeTasks()

    expect(wrapper.find(".cell-editor-input").exists()).toBe(false)

    wrapper.unmount()
  })

  it("does not start keyboard editing for a blocked cell through the public predicate", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: EDITABLE_COLUMNS,
        isCellEditable: ({ rowId }: { rowId: string }) => rowId !== "r1",
      },
    })

    await flushRuntimeTasks()

    const cell = queryBodyCell(wrapper, 0, 0)
    await cell.trigger("mousedown", {
      button: 0,
      clientX: 10,
      clientY: 10,
    })
    await flushRuntimeTasks()
    await cell.trigger("keydown", {
      key: "Enter",
    })
    await flushRuntimeTasks()

    expect(wrapper.find(".cell-editor-input").exists()).toBe(false)

    wrapper.unmount()
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
    expect(wrapper.find(".datagrid-gantt-stage__splitter").exists()).toBe(true)
    expect((wrapper.find(".datagrid-gantt-stage__timeline-header").element as HTMLElement).style.height).not.toBe("")
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
    const ownerMenuButton = ownerHeader.find('[data-datagrid-column-menu-button="true"]')

    expect(ownerHeader.exists()).toBe(true)
    expect(ownerMenuButton.exists()).toBe(true)

    await ownerHeader.trigger("click")
    await flushRuntimeTasks()
    expect(queryColumnMenuRoot()).toBeFalsy()

    await ownerMenuButton.trigger("click")
    await flushRuntimeTasks()
    expect(queryColumnMenuRoot()).toBeTruthy()
    expect(queryColumnMenuAction("sort-asc")?.textContent).toContain("Sort A to Z")

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

    await ownerMenuButton.trigger("click")
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

  it("supports declarative columnMenu section selection at the app level", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: {
          items: ["group", "pin"],
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    await wrapper.find('.grid-cell--header[data-column-key="owner"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    expect(queryColumnMenuAction("toggle-group")).toBeTruthy()
    expect(queryColumnMenuAction("pin-submenu")).toBeTruthy()
    expect(queryColumnMenuAction("sort-asc")).toBeNull()
    expect(queryColumnMenuAction("clear-filter")).toBeNull()

    wrapper.unmount()
  })

  it("supports declarative per-column columnMenu overrides", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: {
          items: ["sort", "group", "pin", "filter"],
          columns: {
            owner: {
              hide: ["group", "pin"],
            },
          },
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    await wrapper.find('.grid-cell--header[data-column-key="owner"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    expect(queryColumnMenuAction("sort-asc")).toBeTruthy()
    expect(queryColumnMenuAction("toggle-group")).toBeNull()
    expect(queryColumnMenuAction("pin-submenu")).toBeNull()
    expect(queryColumnMenuAction("clear-filter")).toBeTruthy()

    document.body.querySelector<HTMLElement>("[data-affino-menu-root]")?.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    }))
    await flushRuntimeTasks()

    await wrapper.find('.grid-cell--header[data-column-key="region"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    expect(queryColumnMenuAction("toggle-group")).toBeTruthy()
    expect(queryColumnMenuAction("pin-submenu")).toBeTruthy()

    wrapper.unmount()
  })

  it("supports declarative columnMenu labels", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: {
          labels: {
            group: "Toggle grouping",
            pin: "Pinning",
          },
          columns: {
            owner: {
              labels: {
                filter: "Owner filters",
              },
            },
          },
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    await wrapper.find('.grid-cell--header[data-column-key="owner"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    expect(queryColumnMenuAction("toggle-group")?.textContent).toContain("Toggle grouping")
    expect(queryColumnMenuAction("pin-submenu")?.textContent).toContain("Pinning")
    expect(queryColumnMenuAction("clear-filter")?.closest("section")?.textContent).toContain("Owner filters")

    wrapper.unmount()
  })

  it("supports declarative disabled columnMenu sections", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: {
          disabled: ["pin"],
          disabledReasons: {
            pin: "Pinning is locked for this view",
          },
          columns: {
            owner: {
              disabled: ["group", "filter"],
              disabledReasons: {
                group: "Grouping is managed by the saved view",
                filter: "Owner filtering is unavailable in this mode",
              },
            },
          },
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    await wrapper.find('.grid-cell--header[data-column-key="owner"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    const before = resolveRowModel(wrapper)?.getSnapshot()
    expect(queryColumnMenuAction("toggle-group")?.getAttribute("aria-disabled")).toBe("true")
    expect(queryColumnMenuActionTitle("toggle-group")).toBe("Grouping is managed by the saved view")
    expect(queryColumnMenuAction("pin-submenu")?.getAttribute("aria-disabled")).toBe("true")
    expect(queryColumnMenuActionTitle("pin-submenu")).toBe("Pinning is locked for this view")
    expect(queryColumnMenuAction("clear-filter")?.getAttribute("disabled")).not.toBeNull()
    expect(queryColumnMenuActionTitle("clear-filter")).toBe("Owner filtering is unavailable in this mode")

    queryColumnMenuAction("toggle-group")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveRowModel(wrapper)?.getSnapshot()).toEqual(before)

    wrapper.unmount()
  })

  it("supports declarative columnMenu action overrides", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: {
          actions: {
            sortAsc: { label: "Ascending order" },
            clearSort: { hidden: true },
            pinMenu: { disabled: true, disabledReason: "Pinning is locked at the workspace level" },
          },
          columns: {
            owner: {
              actions: {
                toggleGroup: {
                  label: "Owner grouping",
                  disabled: true,
                  disabledReason: "Owner grouping is managed by the active view",
                },
                clearFilter: { hidden: true },
              },
            },
          },
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    await wrapper.find('.grid-cell--header[data-column-key="owner"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    const before = resolveRowModel(wrapper)?.getSnapshot()

    expect(queryColumnMenuAction("sort-asc")?.textContent).toContain("Ascending order")
    expect(queryColumnMenuAction("sort-clear")).toBeNull()
    expect(queryColumnMenuAction("toggle-group")?.textContent).toContain("Owner grouping")
    expect(queryColumnMenuAction("toggle-group")?.getAttribute("aria-disabled")).toBe("true")
    expect(queryColumnMenuActionTitle("toggle-group")).toBe("Owner grouping is managed by the active view")
    expect(queryColumnMenuAction("pin-submenu")?.getAttribute("aria-disabled")).toBe("true")
    expect(queryColumnMenuActionTitle("pin-submenu")).toBe("Pinning is locked at the workspace level")
    expect(queryColumnMenuAction("clear-filter")).toBeNull()

    queryColumnMenuAction("toggle-group")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveRowModel(wrapper)?.getSnapshot()).toEqual(before)

    wrapper.unmount()
  })

  it("groups a column from declarative columnMenu and emits update:groupBy", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    await wrapper.find('.grid-cell--header[data-column-key="owner"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    queryColumnMenuAction("toggle-group")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveRowModel(wrapper)?.getSnapshot()).toMatchObject({
      groupBy: {
        fields: ["owner"],
        expandedByDefault: true,
      },
    })
    expect(wrapper.emitted("update:groupBy")).toEqual(expect.arrayContaining([
      [{ fields: ["owner"], expandedByDefault: true }],
    ]))
    expect(wrapper.find('.grid-cell--header[data-column-key="owner"] .col-head__group-badge').text()).toBe("G1")

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

    await wrapper.find('.grid-cell--header[data-column-key="owner"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    const valueRows = Array.from(queryColumnMenuRoot()?.querySelectorAll<HTMLElement>(".datagrid-column-menu__value") ?? [])
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

    await wrapper.find('.grid-cell--header[data-column-key="owner"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    const valueRows = Array.from(queryColumnMenuRoot()?.querySelectorAll<HTMLElement>(".datagrid-column-menu__value") ?? [])
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

    await wrapper.find('.grid-cell--header[data-column-key="owner"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    const searchInputs = Array.from(queryColumnMenuRoot()?.querySelectorAll<HTMLInputElement>(".datagrid-column-menu__search") ?? [])
    expect(searchInputs).toHaveLength(1)
    expect(searchInputs[0]?.placeholder).toBe("Search values")
    const search = searchInputs.at(-1) ?? null
    expect(search).toBeTruthy()
    search!.value = "alp"
    search!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushRuntimeTasks()

    const valueRows = Array.from(queryColumnMenuRoot()?.querySelectorAll<HTMLElement>(".datagrid-column-menu__value") ?? [])
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

    await wrapper.find('.grid-cell--header[data-column-key="owner"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    let search = Array.from(queryColumnMenuRoot()?.querySelectorAll<HTMLInputElement>(".datagrid-column-menu__search") ?? []).at(-1) ?? null
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

    await wrapper.find('.grid-cell--header[data-column-key="owner"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    search = Array.from(queryColumnMenuRoot()?.querySelectorAll<HTMLInputElement>(".datagrid-column-menu__search") ?? []).at(-1) ?? null
    expect(search).toBeTruthy()
    search!.value = "alp"
    search!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushRuntimeTasks()

    const addCurrentSelection = queryColumnMenuAction("add-current-selection")?.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(addCurrentSelection).toBeTruthy()
    addCurrentSelection!.checked = true
    addCurrentSelection!.dispatchEvent(new Event("change", { bubbles: true }))
    await flushRuntimeTasks()

    const valueRows = Array.from(queryColumnMenuRoot()?.querySelectorAll<HTMLElement>(".datagrid-column-menu__value") ?? [])
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
    expect(queryVisibleComboboxPanel()).toBeNull()

    const valueInput = popover!.querySelector<HTMLInputElement>('.datagrid-advanced-filter__field--value input[type="text"]')
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
        groupBy: "owner",
      },
    })

    await flushRuntimeTasks()

    const trigger = wrapper.find(".datagrid-app-toolbar__button")
    expect(trigger.exists()).toBe(true)

    await trigger.trigger("click")
    await flushRuntimeTasks()

    const popover = queryAggregationsRoot()
    expect(popover).toBeTruthy()
    expect(queryVisibleComboboxPanel()).toBeNull()

    const amountCheckbox = popover?.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(amountCheckbox).toBeTruthy()
    amountCheckbox!.checked = true
    amountCheckbox!.dispatchEvent(new Event("change", { bubbles: true }))
    await flushRuntimeTasks()

    const amountOp = popover?.querySelector<HTMLInputElement>(".datagrid-aggregations__op")
    expect(amountOp).toBeTruthy()
    amountOp!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    const optionPanel = queryVisibleComboboxPanel()
    expect(optionPanel).toBeTruthy()
    expect(popover?.contains(optionPanel!)).toBe(false)

    const sumOption = Array.from(optionPanel!.querySelectorAll<HTMLButtonElement>(".datagrid-cell-combobox__option")).find(
      option => option.textContent?.includes("Sum"),
    )
    expect(sumOption).toBeTruthy()
    sumOption!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(queryAggregationsRoot()).toBeTruthy()

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

  it("disables declarative aggregations when no groupBy model is active", async () => {
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
    expect((trigger.element as HTMLButtonElement).disabled).toBe(true)
    expect(trigger.attributes("title")).toContain("require an active group-by model")

    await trigger.trigger("click")
    await flushRuntimeTasks()

    expect(queryAggregationsRoot()).toBeNull()
    expect(resolveVm(wrapper).getApi?.()?.rows.getAggregationModel?.()).toBeNull()

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

  it("keeps row focus independent from checkbox row selection", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const bodyRows = wrapper.findAll(".grid-body-viewport .grid-row")
    expect(bodyRows).toHaveLength(3)

    await bodyRows[1]!.trigger("click")
    await flushRuntimeTasks()

    const leftPaneRows = wrapper.findAll(".grid-body-pane--left .grid-row")
    expect(leftPaneRows).toHaveLength(3)

    const firstRowCheckbox = leftPaneRows[0]!.find('.grid-cell--row-selection[role="checkbox"]')
    expect(firstRowCheckbox.exists()).toBe(true)
    expect(firstRowCheckbox.attributes("aria-checked")).toBe("false")
    await firstRowCheckbox.trigger("click")
    await flushRuntimeTasks()

    const refreshedBodyRows = wrapper.findAll(".grid-body-viewport .grid-row")
    expect(refreshedBodyRows[0]!.classes()).toContain("grid-row--checkbox-selected")
    expect(refreshedBodyRows[0]!.classes()).not.toContain("grid-row--focused")
    expect(refreshedBodyRows[1]!.classes()).toContain("grid-row--focused")
    expect(refreshedBodyRows[1]!.classes()).not.toContain("grid-row--checkbox-selected")

    expect(resolveVm(wrapper).getApi?.()?.rowSelection.getSnapshot?.()).toEqual({
      focusedRow: "r2",
      selectedRows: ["r1"],
    })

    wrapper.unmount()
  })

  it("composes user selection lifecycle hooks with grid and row-selection capabilities", async () => {
    const log: string[] = []
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        services: {
          selection: {
            name: "selection",
            init: () => {
              log.push("init:user-selection")
            },
            start: () => {
              log.push("start:user-selection")
            },
            stop: () => {
              log.push("stop:user-selection")
            },
            dispose: () => {
              log.push("dispose:user-selection")
            },
          },
        },
      },
    })

    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      selection?: {
        hasSupport?: () => boolean
        getSnapshot?: () => unknown
        setSnapshot?: (snapshot: unknown) => void
      }
      rowSelection?: {
        hasSupport?: () => boolean
        getSnapshot?: () => unknown
        setFocusedRow?: (rowId: string | number | null) => void
      }
    } | null

    expect(log).toContain("init:user-selection")
    expect(log).toContain("start:user-selection")
    expect(api?.selection?.hasSupport?.()).toBe(true)
    expect(api?.rowSelection?.hasSupport?.()).toBe(true)

    api?.selection?.setSnapshot?.({
      ranges: [
        {
          startRow: 0,
          endRow: 0,
          startCol: 0,
          endCol: 0,
          startRowId: "r1",
          endRowId: "r1",
          anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
          focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
    })

    const leftPaneRows = wrapper.findAll(".grid-body-pane--left .grid-row")
    const firstRowCheckbox = leftPaneRows[0]!.find('.grid-cell--row-selection[role="checkbox"]')
    await firstRowCheckbox.trigger("click")
    await flushRuntimeTasks()

    expect(api?.selection?.getSnapshot?.()).not.toBeNull()
    expect(api?.rowSelection?.getSnapshot?.()).toEqual({
      focusedRow: null,
      selectedRows: ["r1"],
    })

    api?.rowSelection?.setFocusedRow?.("r1")

    expect(api?.rowSelection?.getSnapshot?.()).toEqual({
      focusedRow: "r1",
      selectedRows: ["r1"],
    })

    wrapper.unmount()

    expect(log).toContain("stop:user-selection")
  })

  it("keeps selection aggregate labels aligned when row selection adds a leading checkbox column", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowSelection: true,
      },
    })

    await flushRuntimeTasks()

    resolveVm(wrapper).getApi?.()?.selection?.setSnapshot?.({
      ranges: [
        {
          startRow: 0,
          endRow: 1,
          startCol: 3,
          endCol: 3,
          startRowId: "r1",
          endRowId: "r2",
          anchor: { rowIndex: 0, colIndex: 3, rowId: "r1" },
          focus: { rowIndex: 1, colIndex: 3, rowId: "r2" },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 3, rowId: "r2" },
    })

    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getSelectionAggregatesLabel?.()).toBe(
      "Selection: count 2 · sum 30 · min 10 · max 20 · avg 15",
    )

    wrapper.unmount()
  })

  it("keeps selection aggregate labels aligned for pinned bottom rows", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: PINNED_BOTTOM_SELECTION_ROWS,
        columns: PINNED_BOTTOM_SELECTION_COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const mondayCell = queryPinnedBottomCell(wrapper, 3, 1)
    const tuesdayCell = queryPinnedBottomCell(wrapper, 3, 2)

    expect(mondayCell.exists()).toBe(true)
    expect(tuesdayCell.exists()).toBe(true)

    await mondayCell.trigger("mousedown", { button: 0, clientX: 8, clientY: 8 })
    await mondayCell.trigger("click", { clientX: 8, clientY: 8 })
    await tuesdayCell.trigger("mousedown", { button: 0, shiftKey: true, clientX: 16, clientY: 8 })
    await tuesdayCell.trigger("click", { shiftKey: true, clientX: 16, clientY: 8 })

    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getSelectionAggregatesLabel?.()).toBe(
      "Selection: count 2 · sum 300 · min 100 · max 200 · avg 150",
    )

    wrapper.unmount()
  })

  it("renders checkbox cell types and toggles them on click without entering edit mode", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: CHECKBOX_ROWS,
        columns: CHECKBOX_COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const cell = wrapper.find('.grid-body-viewport .grid-cell--checkbox[role="checkbox"]')
    expect(cell.find(".grid-checkbox-indicator--checked").exists()).toBe(true)

    await cell.trigger("click")
    await flushRuntimeTasks()

    expect(wrapper.find(".cell-editor-input").exists()).toBe(false)
    expect(resolveRowAt<{ approved: boolean }>(wrapper, 0)).toMatchObject({ approved: false })
    const uncheckedCell = wrapper.find('.grid-body-viewport .grid-cell--checkbox[role="checkbox"]')
    expect(uncheckedCell.find(".grid-checkbox-indicator").exists()).toBe(true)
    expect(uncheckedCell.find(".grid-checkbox-indicator--checked").exists()).toBe(false)

    wrapper.unmount()
  })

  it("keeps select cells closed on single click and opens them on double click", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: SELECT_ROWS,
        columns: SELECT_COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const cell = queryBodyCell(wrapper, 0, 0)
    expect(cell.text()).toContain("Backlog")

    await cell.trigger("click")
    await flushRuntimeTasks()

    expect(wrapper.find(".datagrid-cell-combobox__input").exists()).toBe(false)

    await cell.trigger("dblclick")
    await flushRuntimeTasks()

    const editor = wrapper.find<HTMLInputElement>(".datagrid-cell-combobox__input")
    expect(editor.exists()).toBe(true)
    expect(wrapper.find(".cell-editor-input").exists()).toBe(false)
    expect(document.body.querySelector(".cell-editor-select")).toBeNull()

    const inputElement = editor.element as HTMLInputElement
    inputElement.value = "pla"
    inputElement.dispatchEvent(new Event("input", { bubbles: true }))
    await flushRuntimeTasks()

    const options = [...document.body.querySelectorAll<HTMLButtonElement>(".datagrid-cell-combobox__option")]
    expect(options).toHaveLength(1)
    expect(options[0]?.textContent).toContain("Planned")
    expect(resolveRowAt<{ stage: string }>(wrapper, 0)).toMatchObject({ stage: "backlog" })

    options[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(queryBodyCell(wrapper, 0, 0).text()).toContain("Planned")
    expect(resolveRowAt<{ stage: string }>(wrapper, 0)).toMatchObject({ stage: "planned" })

    wrapper.unmount()
  })

  it("opens a select cell from the trailing chevron hit zone on single click", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: SELECT_ROWS,
        columns: SELECT_COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const cell = queryBodyCell(wrapper, 0, 0)
    await cell.trigger("click", { clientX: 118, clientY: 16 })
    await flushRuntimeTasks()

    const editor = wrapper.find<HTMLInputElement>(".datagrid-cell-combobox__input")
    expect(editor.exists()).toBe(true)

    wrapper.unmount()
  })

  it("opens a focused select cell on Enter", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: SELECT_ROWS,
        columns: SELECT_COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const cell = queryBodyCell(wrapper, 0, 0)
    await cell.trigger("click")
    await flushRuntimeTasks()

    expect(wrapper.find(".datagrid-cell-combobox__input").exists()).toBe(false)

    await cell.trigger("keydown", { key: "Enter" })
    await flushRuntimeTasks()

    expect(wrapper.find(".datagrid-cell-combobox__input").exists()).toBe(true)

    wrapper.unmount()
  })

  it("opens a date cell from the trailing calendar hit zone and commits a picked date", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: DATE_ROWS,
        columns: DATE_COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const cell = queryBodyCell(wrapper, 0, 0)
    await cell.trigger("click", { clientX: 118, clientY: 16 })
    await flushRuntimeTasks()

    const editor = wrapper.find<HTMLInputElement>(".cell-editor-input--date")
    expect(editor.exists()).toBe(true)

    const inputElement = editor.element as HTMLInputElement
    inputElement.value = "2026-03-22"
    inputElement.dispatchEvent(new Event("input", { bubbles: true }))
    inputElement.dispatchEvent(new Event("change", { bubbles: true }))
    await flushRuntimeTasks()

    const updatedRow = resolveRowAt<{ createdAt: Date }>(wrapper, 0)
    expect(updatedRow.createdAt).toBeInstanceOf(Date)
    expect(updatedRow.createdAt.toISOString()).toBe("2026-03-22T00:00:00.000Z")

    wrapper.unmount()
  })

  it("opens a datetime cell from the trailing calendar hit zone and commits a picked date-time", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: DATETIME_ROWS,
        columns: DATETIME_COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const cell = queryBodyCell(wrapper, 0, 0)
    await cell.trigger("click", { clientX: 118, clientY: 16 })
    await flushRuntimeTasks()

    const editor = wrapper.find<HTMLInputElement>(".cell-editor-input--date")
    expect(editor.exists()).toBe(true)
    expect((editor.element as HTMLInputElement).type).toBe("datetime-local")

    const inputElement = editor.element as HTMLInputElement
    inputElement.value = "2026-03-22T03:07"
    inputElement.dispatchEvent(new Event("input", { bubbles: true }))
    inputElement.dispatchEvent(new Event("change", { bubbles: true }))
    await flushRuntimeTasks()

    const updatedRow = resolveRowAt<{ updatedAt: Date }>(wrapper, 0)
    expect(updatedRow.updatedAt).toBeInstanceOf(Date)
    expect(updatedRow.updatedAt.getTime()).toBe(new Date(2026, 2, 22, 3, 7).getTime())

    wrapper.unmount()
  })

  it("ranks select matches as exact and prefix matches before contains matches", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: SELECT_ROWS,
        columns: RANKED_SELECT_COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const cell = queryBodyCell(wrapper, 0, 0)
    await cell.trigger("dblclick")
    await flushRuntimeTasks()

    const editor = wrapper.find<HTMLInputElement>(".datagrid-cell-combobox__input")
    const inputElement = editor.element as HTMLInputElement
    inputElement.value = "pla"
    inputElement.dispatchEvent(new Event("input", { bubbles: true }))
    await flushRuntimeTasks()

    const options = [...document.body.querySelectorAll<HTMLButtonElement>(".datagrid-cell-combobox__option")]
    expect(options.map(option => option.textContent?.replace(/\s+Selected\s*/g, "").trim())).toEqual([
      "Planned",
      "Plan Review",
      "Backplanned",
    ])

    wrapper.unmount()
  })

  it("starts select filtering from the first typed character and commits on option selection", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: SELECT_ROWS,
        columns: SELECT_COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const cell = queryBodyCell(wrapper, 0, 0)
    await cell.trigger("click")
    await flushRuntimeTasks()

    await cell.trigger("keydown", { key: "p" })
    await flushRuntimeTasks()

    const editor = wrapper.find<HTMLInputElement>(".datagrid-cell-combobox__input")
    expect(editor.exists()).toBe(true)
    expect((editor.element as HTMLInputElement).value).toBe("p")

    const options = [...document.body.querySelectorAll<HTMLButtonElement>(".datagrid-cell-combobox__option")]
    expect(options[0]?.textContent).toContain("Planned")

    options[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveRowAt<{ stage: string }>(wrapper, 0)).toMatchObject({ stage: "planned" })

    wrapper.unmount()
  })

  it("loads async select options and commits the active option on Tab", async () => {
    const asyncOptions = vi.fn(async () => {
      await Promise.resolve()
      return [
        { value: "backlog", label: "Backlog" },
        { value: "review", label: "Review" },
        { value: "done", label: "Done" },
      ]
    })

    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: ASYNC_SELECT_ROWS,
        columns: [
          {
            key: "stage",
            label: "Stage",
            width: 160,
            cellType: "select",
            capabilities: { editable: true },
            presentation: {
              options: asyncOptions,
            },
          },
        ],
      },
    })

    await flushRuntimeTasks()

    const cell = queryBodyCell(wrapper, 0, 0)
    expect(cell.text()).toContain("review")

    await cell.trigger("click")
    await flushRuntimeTasks()

    expect(wrapper.find(".datagrid-cell-combobox__input").exists()).toBe(false)

    await cell.trigger("keydown", { key: "Enter" })
    await flushRuntimeTasks()

    const editor = wrapper.find<HTMLInputElement>(".datagrid-cell-combobox__input")
    expect(editor.exists()).toBe(true)
    expect(asyncOptions).toHaveBeenCalled()

    const inputElement = editor.element as HTMLInputElement
    inputElement.value = "rev"
    inputElement.dispatchEvent(new Event("input", { bubbles: true }))
    await flushRuntimeTasks()

    const options = [...document.body.querySelectorAll<HTMLButtonElement>(".datagrid-cell-combobox__option")]
    expect(options).toHaveLength(1)
    expect(options[0]?.textContent).toContain("Review")

    inputElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveRowAt<{ stage: string }>(wrapper, 0)).toMatchObject({ stage: "review" })
    expect(queryBodyCell(wrapper, 0, 0).text()).toContain("Review")

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

  it("renders grouped two-row headers for pivot columns with repeated prefixes", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        pivotModel: {
          rows: ["owner"],
          columns: ["region"],
          values: [
            { field: "amount", agg: "sum" },
            { field: "amount", agg: "count" },
          ],
        },
      },
    })

    await flushRuntimeTasks()

    const pivotGroupLabels = wrapper
      .findAll("[data-datagrid-pivot-group-label]")
      .map(node => node.attributes("data-datagrid-pivot-group-label"))
      .filter((value): value is string => typeof value === "string" && value.length > 0)

    expect(pivotGroupLabels).toContain("eu-west")
    expect(pivotGroupLabels).toContain("us-east")

    const pivotLeafLabels = wrapper
      .findAll('.grid-cell--header[data-column-key^="pivot|"] .col-head__label')
      .map(node => node.text())

    expect(pivotLeafLabels).toContain("Amount")
    expect(pivotLeafLabels).toContain("COUNT Amount")

    wrapper.unmount()
  })

  it("renders nested grouped headers for multi-level pivot columns", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: PIVOT_HEADER_ROWS,
        columns: PIVOT_HEADER_COLUMNS,
        pivotModel: {
          rows: ["owner"],
          columns: ["month", "channel"],
          values: [
            { field: "amount", agg: "sum" },
            { field: "amount", agg: "count" },
          ],
        },
      },
    })

    await flushRuntimeTasks()

    const topGroupLabels = wrapper
      .findAll('[data-datagrid-pivot-group-depth="0"]')
      .map(node => node.attributes("data-datagrid-pivot-group-label"))
      .filter((value): value is string => typeof value === "string" && value.length > 0)

    const nestedGroupLabels = wrapper
      .findAll('[data-datagrid-pivot-group-depth="1"]')
      .map(node => node.attributes("data-datagrid-pivot-group-label"))
      .filter((value): value is string => typeof value === "string" && value.length > 0)

    expect(topGroupLabels).toContain("2026-01")
    expect(topGroupLabels).toContain("2026-02")
    expect(nestedGroupLabels).toContain("Web")
    expect(nestedGroupLabels).toContain("Email")

    const pivotLeafLabels = wrapper
      .findAll('.grid-cell--header[data-column-key^="pivot|"] .col-head__label')
      .map(node => node.text())

    expect(pivotLeafLabels).toContain("Amount")
    expect(pivotLeafLabels).toContain("COUNT Amount")

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

  it("expands flex columns to fill the remaining center viewport width", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: FLEX_COLUMNS,
        rowSelection: false,
      },
    })

    await flushRuntimeTasks()

    const bodyViewport = wrapper.find(".grid-body-viewport")
    expect(bodyViewport.exists()).toBe(true)
    const bodyShell = bodyViewport.element.parentElement as HTMLElement | null
    expect(bodyShell).toBeTruthy()
    setElementClientWidth(bodyViewport.element as HTMLElement, 720)
    if (bodyShell) {
      setElementClientWidth(bodyShell, 792)
    }
    await bodyViewport.trigger("scroll")
    await flushRuntimeTasks()

    const ownerHeaderCell = wrapper.find('.grid-header-viewport .grid-cell--header[data-column-key="owner"]')
    const regionHeaderCell = wrapper.find('.grid-header-viewport .grid-cell--header[data-column-key="region"]')
    const amountHeaderCell = wrapper.find('.grid-header-viewport .grid-cell--header[data-column-key="amount"]')

    expect(ownerHeaderCell.attributes("style")).toContain("width: 420px")
    expect(regionHeaderCell.attributes("style")).toContain("width: 160px")
    expect(amountHeaderCell.attributes("style")).toContain("width: 140px")

    wrapper.unmount()
  })

  it("expands pinned flex columns from the full stage shell width", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: PINNED_FLEX_COLUMNS,
        rowSelection: false,
      },
    })

    await flushRuntimeTasks()

    const bodyViewport = wrapper.find(".grid-body-viewport")
    expect(bodyViewport.exists()).toBe(true)
    const bodyShell = bodyViewport.element.parentElement as HTMLElement | null
    expect(bodyShell).toBeTruthy()
    setElementClientWidth(bodyViewport.element as HTMLElement, 300)
    if (bodyShell) {
      setElementClientWidth(bodyShell, 720)
    }
    await bodyViewport.trigger("scroll")
    await flushRuntimeTasks()

    const ownerHeaderCell = wrapper.find('.grid-header-pane--left .grid-cell--header[data-column-key="owner"]')
    const regionHeaderCell = wrapper.find('.grid-header-viewport .grid-cell--header[data-column-key="region"]')
    const amountHeaderCell = wrapper.find('.grid-header-viewport .grid-cell--header[data-column-key="amount"]')

    expect(ownerHeaderCell.attributes("style")).toContain("width: 348px")
    expect(regionHeaderCell.attributes("style")).toContain("width: 160px")
    expect(amountHeaderCell.attributes("style")).toContain("width: 140px")

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

  it("round-trips saved views through facade helpers including view mode", async () => {
    const source = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        sortModel: [{ key: "amount", direction: "desc" }],
        viewMode: "gantt",
      },
    })

    await flushRuntimeTasks()

    const savedView = resolveVm(source).getSavedView?.()
    expect(savedView).toMatchObject({
      viewMode: "gantt",
      state: expect.objectContaining({
        rows: expect.objectContaining({
          snapshot: expect.objectContaining({
            sortModel: [{ key: "amount", direction: "desc" }],
          }),
        }),
      }),
    })

    const target = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const migrated = resolveVm(target).migrateSavedView?.(savedView as Record<string, unknown>)
    expect(migrated).toBeTruthy()
    expect(resolveVm(target).applySavedView?.(migrated as { state: unknown; viewMode?: "table" | "gantt" })).toBe(true)
    await flushRuntimeTasks()

    expect(resolveVm(target).getView?.()).toBe("gantt")
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

  it("serializes and restores saved views through storage helpers", async () => {
    const source = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        sortModel: [{ key: "amount", direction: "desc" }],
        viewMode: "gantt",
      },
    })

    await flushRuntimeTasks()

    const savedView = resolveVm(source).getSavedView?.()
    expect(savedView).toBeTruthy()

    const storageData = new Map<string, string>()
    const storage = {
      getItem: (key: string) => storageData.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storageData.set(key, value)
      },
      removeItem: (key: string) => {
        storageData.delete(key)
      },
    }

    const serialized = serializeDataGridSavedView(savedView as NonNullable<typeof savedView>)
    expect(parseDataGridSavedView(serialized, value => resolveVm(source).migrateState?.(value) ?? null)).toMatchObject({
      viewMode: "gantt",
    })
    expect(writeDataGridSavedViewToStorage(storage, "demo", savedView as NonNullable<typeof savedView>)).toBe(true)

    const target = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const restored = readDataGridSavedViewFromStorage(
      storage,
      "demo",
      value => resolveVm(target).migrateState?.(value) ?? null,
    )
    expect(restored).toBeTruthy()
    expect(resolveVm(target).applySavedView?.(restored as NonNullable<typeof restored>)).toBe(true)
    await flushRuntimeTasks()

    expect(resolveVm(target).getView?.()).toBe("gantt")
    expect(clearDataGridSavedViewInStorage(storage, "demo")).toBe(true)
    expect(storage.getItem("demo")).toBeNull()

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

    queryColumnMenuButton("owner")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    const menuRoot = queryColumnMenuRoot()
    expect(menuRoot?.style.getPropertyValue("--datagrid-column-menu-bg")).toBe("#fff8ef")

    wrapper.unmount()
  })

  it("uses data-type specific sort labels in the declarative columnMenu", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: [
          { rowId: "t1", owner: "NOC", createdAt: "2026-03-01", amount: 20 },
          { rowId: "t2", owner: "Payments", createdAt: "2026-02-01", amount: 10 },
        ],
        columns: [
          { key: "owner", label: "Owner", dataType: "string" },
          { key: "createdAt", label: "Created", dataType: "date" },
          { key: "amount", label: "Amount", dataType: "number" },
        ],
        columnMenu: true,
      },
    })

    await flushRuntimeTasks()

    await wrapper.find('.grid-cell--header[data-column-key="createdAt"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()
    expect(queryColumnMenuAction("sort-asc")?.textContent).toContain("Sort oldest to newest")

    document.body.querySelector<HTMLElement>("[data-affino-menu-root]")?.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    }))
    await flushRuntimeTasks()

    await wrapper.find('.grid-cell--header[data-column-key="amount"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()
    expect(queryColumnMenuAction("sort-asc")?.textContent).toContain("Sort smallest to largest")

    wrapper.unmount()
  })

  it("parses typed currency edits before committing them to the row model", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: CURRENCY_EDIT_ROWS,
        columns: CURRENCY_EDIT_COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const cell = queryBodyCell(wrapper, 0, 0)
    await cell.trigger("dblclick")
    await flushRuntimeTasks()

    const editor = wrapper.find(".cell-editor-input")
    expect(editor.exists()).toBe(true)

    await editor.setValue("£1,200.50")
    await editor.trigger("blur")
    await flushRuntimeTasks()

    expect(queryBodyCell(wrapper, 0, 0).text()).toContain("£1,200.50")
    expect(resolveRowAt<{ amount: number }>(wrapper, 0)).toMatchObject({ amount: 1200.5 })

    wrapper.unmount()
  })
})
