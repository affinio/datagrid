import { defineComponent, h, nextTick, ref } from "vue"
import { flushPromises, mount } from "@vue/test-utils"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type {
  DataGridRowNode,
  DataGridRowNodeInput,
  DataGridRowSelectionSnapshot,
  DataGridUnifiedState,
} from "@affino/datagrid-vue"
import DataGrid from "../DataGrid"
import {
  defineDataGridComponent,
  defineDataGridFilterCellReader,
  DataGridModuleHost,
  defineDataGridColumns,
  defineDataGridSelectionCellReader,
  useDataGridRef,
  type DataGridAppToolbarModule,
  type DataGridSavedViewSnapshot,
  type DataGridTableStageHistoryAdapter,
} from "../index"
import type {
  DataGridAppCellRendererContext,
} from "../index"
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

interface EffectiveSelectionRow {
  rowId: string
  formula: string
  effectiveAmount: number
}

interface EffectiveFilterRow {
  rowId: string
  statusCode: string
}

const EffectiveFilterGrid = defineDataGridComponent<EffectiveFilterRow>()
const EffectiveSelectionGrid = defineDataGridComponent<EffectiveSelectionRow>()

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

const EFFECTIVE_FILTER_ROWS: readonly EffectiveFilterRow[] = [
  { rowId: "ef1", statusCode: "a" },
  { rowId: "ef2", statusCode: "b" },
  { rowId: "ef3", statusCode: "a" },
]

const COLUMNS = [
  { key: "owner", label: "Owner", width: 180 },
  { key: "region", label: "Region", width: 160 },
  { key: "amount", label: "Amount", width: 140 },
] as const

const EFFECTIVE_FILTER_COLUMNS = defineDataGridColumns<EffectiveFilterRow>()([
  {
    key: "status",
    field: "statusCode",
    label: "Status",
    width: 180,
    valueGetter: (row: EffectiveFilterRow) => row.statusCode === "a" ? "Active" : "Blocked",
  },
] as const)

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
  await flushPromises()
  await nextTick()
}

async function flushAnimationFrame() {
  if (typeof window === "undefined") {
    return
  }
  await new Promise<void>(resolve => {
    window.requestAnimationFrame(() => resolve())
  })
}

async function preloadAdvancedFilterPopover(): Promise<void> {
  await import("../overlays/DataGridAdvancedFilterPopover.vue")
}

async function preloadFindReplacePopover(): Promise<void> {
  await import("../overlays/DataGridFindReplacePopover.vue")
}

async function findAdvancedFilterTrigger(wrapper: ReturnType<typeof mount>) {
  await flushRuntimeTasks()
  await flushRuntimeTasks()
  return wrapper.find('[data-datagrid-toolbar-action="advanced-filter"]')
}

function findToolbarAction(wrapper: ReturnType<typeof mount>, action: string) {
  return wrapper.find(`[data-datagrid-toolbar-action="${action}"]`)
}

type ResolvedRowModelSnapshot = Record<string, unknown> & {
  rowCount?: number
}

type ResolvedRowModel<TValue extends Record<string, unknown> = Record<string, unknown>> = {
  getSnapshot: () => ResolvedRowModelSnapshot
  getRow?: (rowIndex: number) => { row?: TValue } | undefined
}

function resolveRowModel(wrapper: ReturnType<typeof mount>) {
  const vm = wrapper.vm as unknown as {
    rowModel?: { value?: unknown } | unknown
  }
  const resolved = vm.rowModel && typeof vm.rowModel === "object" && "value" in vm.rowModel
    ? vm.rowModel.value
    : vm.rowModel
  if (!resolved || typeof resolved !== "object" || typeof (resolved as { getSnapshot?: unknown }).getSnapshot !== "function") {
    return null
  }
  return resolved as ResolvedRowModel
}

function resolveVm(wrapper: ReturnType<typeof mount>) {
  return wrapper.vm as unknown as {
    history?: {
      canUndo?: () => boolean
      canRedo?: () => boolean
      runHistoryAction?: (direction: "undo" | "redo") => Promise<string | null>
    }
    getApi?: () => {
      selection?: {
        setSnapshot?: (snapshot: unknown) => void
      }
      rowSelection: {
        getSnapshot?: () => unknown
      }
      rows: {
        getCount?: () => number
        get?: (index: number) => { rowId?: string | number; data?: Record<string, unknown> } | undefined
        getAggregationModel?: () => unknown
      }
    } | null
    getSelectionAggregatesLabel?: () => string
    getView?: () => "table" | "gantt"
    setView?: (mode: "table" | "gantt") => void
    getSavedView?: () => DataGridSavedViewSnapshot<Record<string, unknown>> | null
    migrateSavedView?: (savedView: unknown) => DataGridSavedViewSnapshot<Record<string, unknown>> | null
    applySavedView?: (savedView: DataGridSavedViewSnapshot<Record<string, unknown>>) => boolean
    migrateState?: (state: unknown) => DataGridUnifiedState<Record<string, unknown>> | null
    getState?: () => DataGridUnifiedState<Record<string, unknown>> | null
    getColumnSnapshot?: () => { order: readonly string[]; columns: ReadonlyArray<{
      key: string
      visible: boolean
      pin: string
      width: number | null
    }> } | null
  }
}

function resolveRowAt<TValue extends Record<string, unknown>>(wrapper: ReturnType<typeof mount>, index: number): TValue | null {
  const rowModel = resolveRowModel(wrapper) as ResolvedRowModel<TValue> | null
  return rowModel?.getRow?.(index)?.row ?? null
}

function resolveApiRowCount(wrapper: ReturnType<typeof mount>): number {
  return resolveVm(wrapper).getApi?.()?.rows.getCount?.() ?? 0
}

function queryColumnMenuRoot(): HTMLElement | null {
  const roots = Array.from(document.body.querySelectorAll<HTMLElement>("[data-datagrid-column-menu-panel=\"true\"]"))
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

function queryContextMenuRoot(): HTMLElement | null {
  const menus = Array.from(document.body.querySelectorAll<HTMLElement>(".datagrid-context-menu"))
  return menus.findLast(menu => getComputedStyle(menu).display !== "none") ?? null
}

function queryContextMenuAction(action: string): HTMLButtonElement | null {
  return queryContextMenuRoot()?.querySelector<HTMLButtonElement>(`[data-datagrid-menu-action="${action}"]`) ?? null
}

function queryAdvancedFilterRoot(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(".datagrid-advanced-filter")
}

function queryFindReplaceRoot(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(".datagrid-find-replace")
}

function queryColumnLayoutRoot(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(".datagrid-column-layout")
}

function queryAggregationsRoot(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(".datagrid-aggregations")
}

function queryOverlayDragHandle(root: HTMLElement | null): HTMLElement | null {
  return root?.querySelector<HTMLElement>('[data-datagrid-overlay-drag-handle="true"]') ?? null
}

function readOverlayPosition(root: HTMLElement | null): { left: number; top: number } | null {
  if (!root) {
    return null
  }
  const left = Number.parseFloat(root.style.left)
  const top = Number.parseFloat(root.style.top)
  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    return null
  }
  return { left, top }
}

function createPointerLikeEvent(
  type: string,
  init: MouseEventInit & { pointerId?: number } = {},
): PointerEvent {
  const event = typeof PointerEvent !== "undefined"
    ? new PointerEvent(type, { bubbles: true, cancelable: true, ...init })
    : new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
  if (typeof PointerEvent === "undefined" && init.pointerId != null) {
    Object.defineProperty(event, "pointerId", {
      configurable: true,
      value: init.pointerId,
    })
  }
  return event as PointerEvent
}

function createDragDataTransfer() {
  const store = new Map<string, string>()
  return {
    effectAllowed: "all",
    dropEffect: "move",
    setData(type: string, value: string) {
      store.set(type, value)
    },
    getData(type: string) {
      return store.get(type) ?? ""
    },
    clearData(type?: string) {
      if (type) {
        store.delete(type)
        return
      }
      store.clear()
    },
  }
}

function createDragLikeEvent(
  type: string,
  init: MouseEventInit & { dataTransfer?: ReturnType<typeof createDragDataTransfer> } = {},
): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent
  Object.defineProperty(event, "clientX", {
    configurable: true,
    value: init.clientX ?? 0,
  })
  Object.defineProperty(event, "clientY", {
    configurable: true,
    value: init.clientY ?? 0,
  })
  Object.defineProperty(event, "dataTransfer", {
    configurable: true,
    value: init.dataTransfer ?? createDragDataTransfer(),
  })
  return event
}

async function dragDropElement(
  source: HTMLElement,
  target: HTMLElement,
  options: { targetClientX?: number; targetClientY?: number } = {},
): Promise<void> {
  const dataTransfer = createDragDataTransfer()
  source.dispatchEvent(createDragLikeEvent("dragstart", { dataTransfer, clientY: 8 }))
  target.dispatchEvent(createDragLikeEvent("dragover", {
    dataTransfer,
    clientX: options.targetClientX ?? 24,
    clientY: options.targetClientY ?? 24,
  }))
  target.dispatchEvent(createDragLikeEvent("drop", {
    dataTransfer,
    clientX: options.targetClientX ?? 24,
    clientY: options.targetClientY ?? 24,
  }))
  source.dispatchEvent(createDragLikeEvent("dragend", {
    dataTransfer,
    clientX: options.targetClientX ?? 24,
    clientY: options.targetClientY ?? 24,
  }))
  await flushRuntimeTasks()
}

async function dragOverlaySurface(
  root: HTMLElement,
  delta: { x: number; y: number },
): Promise<void> {
  const handle = queryOverlayDragHandle(root)
  expect(handle).toBeTruthy()

  handle!.dispatchEvent(createPointerLikeEvent("pointerdown", {
    button: 0,
    buttons: 1,
    clientX: 48,
    clientY: 40,
    pointerId: 1,
  }))
  window.dispatchEvent(createPointerLikeEvent("pointermove", {
    buttons: 1,
    clientX: 48 + delta.x,
    clientY: 40 + delta.y,
    pointerId: 1,
  }))
  window.dispatchEvent(createPointerLikeEvent("pointerup", {
    button: 0,
    clientX: 48 + delta.x,
    clientY: 40 + delta.y,
    pointerId: 1,
  }))
  await flushRuntimeTasks()
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

afterEach(() => {
  document.body.innerHTML = ""
})

function setElementClientWidth(element: HTMLElement, width: number): void {
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: width,
  })
}

function setElementClientHeight(element: HTMLElement, height: number): void {
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: height,
  })
}

function setGridBodyShellGeometry(
  wrapper: ReturnType<typeof mount>,
  options: { left?: number; top?: number; width?: number; height?: number } = {},
): void {
  const viewport = wrapper.find(".grid-body-viewport").element as HTMLElement
  const bodyShell = viewport.closest(".grid-body-shell") as HTMLElement | null
  const left = options.left ?? 0
  const top = options.top ?? 0
  const width = options.width ?? 420
  const height = options.height ?? 220

  setElementClientWidth(viewport, width)
  setElementClientHeight(viewport, height)
  viewport.getBoundingClientRect = () => DOMRect.fromRect({
    x: left,
    y: top,
    width,
    height,
  })

  if (!bodyShell) {
    return
  }
  setElementClientWidth(bodyShell, width)
  setElementClientHeight(bodyShell, height)
  bodyShell.getBoundingClientRect = () => DOMRect.fromRect({
    x: left,
    y: top,
    width,
    height,
  })
}

async function dragMoveSelectedBodyCell(
  wrapper: ReturnType<typeof mount>,
  source: { rowIndex: number; columnIndex: number; clientX: number; clientY: number },
  target: { clientX: number; clientY: number },
): Promise<void> {
  const sourceCell = queryBodyCell(wrapper, source.rowIndex, source.columnIndex)
  expect(sourceCell.exists()).toBe(true)

  await sourceCell.trigger("mousedown", {
    button: 0,
    clientX: source.clientX,
    clientY: source.clientY,
  })
  window.dispatchEvent(new MouseEvent("mousemove", {
    bubbles: true,
    buttons: 1,
    clientX: target.clientX,
    clientY: target.clientY,
  }))
  await flushRuntimeTasks()

  window.dispatchEvent(new MouseEvent("mouseup", {
    bubbles: true,
    button: 0,
    clientX: target.clientX,
    clientY: target.clientY,
  }))
  await flushRuntimeTasks()
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
    expect(publicProps).toContain("toolbarModules")
    expect(publicProps).toContain("findReplace")
    expect(publicProps).toContain("gridLines")
    expect(publicProps).toContain("history")
    expect(publicProps).toContain("chrome")
    expect(publicProps).toContain("columnReorder")
    expect(publicProps).toContain("rowReorder")
    expect(publicProps).toContain("placeholderRows")
  })

  it("renders declarative history controls and exposes a stable history controller", async () => {
    const runHistoryAction = vi.fn(async (direction: "undo" | "redo") => (
      direction === "undo" ? "intent-edit-1" : null
    ))
    const historyAdapter: DataGridTableStageHistoryAdapter = {
      captureSnapshot: () => null,
      recordIntentTransaction: () => undefined,
      canUndo: () => true,
      canRedo: () => false,
      runHistoryAction,
    }

    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        history: {
          adapter: historyAdapter,
          controls: true,
          shortcuts: false,
        },
      },
    })

    await flushRuntimeTasks()

    const undoButton = findToolbarAction(wrapper, "undo")
    const redoButton = findToolbarAction(wrapper, "redo")

    expect(undoButton.exists()).toBe(true)
    expect(redoButton.exists()).toBe(true)
    expect((undoButton.element as HTMLButtonElement).disabled).toBe(false)
    expect((redoButton.element as HTMLButtonElement).disabled).toBe(true)

    await undoButton.trigger("click")
    expect(runHistoryAction).toHaveBeenCalledWith("undo")

    expect(resolveVm(wrapper).history?.canUndo?.()).toBe(true)
    expect(resolveVm(wrapper).history?.canRedo?.()).toBe(false)
    await resolveVm(wrapper).history?.runHistoryAction?.("undo")
    expect(runHistoryAction).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })

  it("routes window-level history shortcuts through the declarative controller", async () => {
    const runHistoryAction = vi.fn(async (_direction: "undo" | "redo") => "intent-edit-2")
    const historyAdapter: DataGridTableStageHistoryAdapter = {
      captureSnapshot: () => null,
      recordIntentTransaction: () => undefined,
      canUndo: () => true,
      canRedo: () => true,
      runHistoryAction,
    }

    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        history: {
          adapter: historyAdapter,
          shortcuts: "window",
        },
      },
    })

    await flushRuntimeTasks()

    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }))
    await flushRuntimeTasks()

    expect(runHistoryAction).toHaveBeenCalledWith("undo")

    wrapper.unmount()
  })

  it("renders custom toolbar modules passed through the public toolbarModules prop", async () => {
    const onTrigger = vi.fn()
    const CustomToolbarButton = defineComponent({
      name: "CustomToolbarButton",
      props: {
        label: {
          type: String,
          required: true,
        },
        onTrigger: {
          type: Function,
          required: true,
        },
      },
      setup(componentProps) {
        return () => h("button", {
          type: "button",
          class: "datagrid-app-toolbar__button",
          "data-datagrid-toolbar-action": "custom-summary",
          onClick: () => componentProps.onTrigger(),
        }, componentProps.label)
      },
    })

    const toolbarModules: readonly DataGridAppToolbarModule[] = [
      {
        key: "custom-summary",
        component: CustomToolbarButton,
        props: {
          label: "Summary",
          onTrigger,
        },
      },
    ]

    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        toolbarModules,
      },
    })

    await flushRuntimeTasks()

    const trigger = findToolbarAction(wrapper, "custom-summary")
    expect(trigger.exists()).toBe(true)
    expect(trigger.text()).toBe("Summary")

    await trigger.trigger("click")
    expect(onTrigger).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it("supports integrated chrome placement with compact density and configurable gaps", async () => {
    const historyAdapter: DataGridTableStageHistoryAdapter = {
      captureSnapshot: () => null,
      recordIntentTransaction: () => undefined,
      canUndo: () => true,
      canRedo: () => false,
      runHistoryAction: async direction => direction === "undo" ? "intent-integrated" : null,
    }

    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        history: {
          adapter: historyAdapter,
          controls: true,
          shortcuts: false,
        },
        chrome: {
          density: "compact",
          toolbarPlacement: "integrated",
          toolbarGap: 0,
          workspaceGap: 8,
        },
      },
    })

    await flushRuntimeTasks()

    const layoutElement = wrapper.find(".datagrid-app-layout")
    const layoutStyle = layoutElement.element as HTMLElement

    expect(layoutElement.classes()).toContain("datagrid-app-layout--toolbar-integrated")
    expect(layoutElement.classes()).toContain("datagrid-app-layout--density-compact")
    expect(layoutStyle.style.getPropertyValue("--datagrid-app-layout-gap")).toBe("0px")
    expect(layoutStyle.style.getPropertyValue("--datagrid-app-workspace-gap")).toBe("8px")
    expect(layoutStyle.style.getPropertyValue("--datagrid-app-toolbar-button-height")).toBe("28px")
    expect(wrapper.find(".datagrid-app-stage-surface--integrated .datagrid-app-toolbar--integrated").exists()).toBe(true)
    expect(wrapper.findAll(".datagrid-app-layout > .datagrid-app-toolbar")).toHaveLength(0)

    wrapper.unmount()
  })

  it("publishes built-in toolbar modules for external chrome hosts when internal toolbar is hidden", async () => {
    const runHistoryAction = vi.fn(async (direction: "undo" | "redo") => (
      direction === "undo" ? "intent-external" : null
    ))
    const historyAdapter: DataGridTableStageHistoryAdapter = {
      captureSnapshot: () => null,
      recordIntentTransaction: () => undefined,
      canUndo: () => true,
      canRedo: () => true,
      runHistoryAction,
    }

    let publishedModules: readonly DataGridAppToolbarModule[] = []
    const gridWrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        history: {
          adapter: historyAdapter,
          controls: true,
          shortcuts: false,
        },
        chrome: {
          toolbarPlacement: "hidden",
        },
        onToolbarModulesChange: (modules: readonly DataGridAppToolbarModule[]) => {
          publishedModules = modules
        },
      },
    })

    await flushRuntimeTasks()
    await Promise.resolve()

    expect(gridWrapper.find(".datagrid-app-layout .datagrid-app-toolbar").exists()).toBe(false)
    expect(publishedModules).toHaveLength(2)

    const hostWrapper = mount(DataGridModuleHost, {
      props: {
        modules: publishedModules,
      },
    })

    expect(hostWrapper.find('[data-datagrid-toolbar-action="undo"]').exists()).toBe(true)
    expect(hostWrapper.find('[data-datagrid-toolbar-action="redo"]').exists()).toBe(true)

    await hostWrapper.find('[data-datagrid-toolbar-action="undo"]').trigger("click")
  expect(runHistoryAction).toHaveBeenCalledWith("undo")

    hostWrapper.unmount()
    gridWrapper.unmount()
  })

  it("keeps a column editable cell read-only when the public predicate returns false", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: EDITABLE_COLUMNS,
        isCellEditable: ({ rowId }) => rowId !== "r1",
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

    const editor = wrapper.find<HTMLInputElement>(".cell-editor-input")
    expect(editor.exists()).toBe(true)
    const editorElement = editor.element as HTMLInputElement
    expect(document.activeElement).toBe(editorElement)
    expect(editorElement.selectionStart).toBe(editorElement.value.length)
    expect(editorElement.selectionEnd).toBe(editorElement.value.length)

    wrapper.unmount()
  })

  it("buffers a fast typed word into inline editing on a focused editable cell", async () => {
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
    await cell.trigger("click")
    await flushRuntimeTasks()

    cell.element.dispatchEvent(new KeyboardEvent("keydown", { key: "p", bubbles: true, cancelable: true }))
    cell.element.dispatchEvent(new KeyboardEvent("keydown", { key: "l", bubbles: true, cancelable: true }))
    cell.element.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true }))
    await flushRuntimeTasks()

    const editor = wrapper.find<HTMLInputElement>(".cell-editor-input")
    expect(editor.exists()).toBe(true)
    expect((editor.element as HTMLInputElement).value).toBe("pla")

    wrapper.unmount()
  })

  it("restores the previous value when Escape cancels a fast typed inline edit before the editor takes focus", async () => {
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
    await cell.trigger("click")
    await flushRuntimeTasks()

    cell.element.dispatchEvent(new KeyboardEvent("keydown", { key: "p", bubbles: true, cancelable: true }))
    cell.element.dispatchEvent(new KeyboardEvent("keydown", { key: "l", bubbles: true, cancelable: true }))
    cell.element.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true }))
    cell.element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))
    await flushRuntimeTasks()

    expect(wrapper.find(".cell-editor-input").exists()).toBe(false)
    expect(queryBodyCell(wrapper, 0, 0).text()).toContain("NOC")
    expect(resolveRowAt<{ owner: string }>(wrapper, 0)).toMatchObject({ owner: "NOC" })

    wrapper.unmount()
  })

  it("starts typing in the newly clicked cell after committing a previous inline edit", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: EDITABLE_COLUMNS,
        isCellEditable: () => true,
      },
    })

    await flushRuntimeTasks()

    const firstCell = queryBodyCell(wrapper, 0, 0)
    await firstCell.trigger("dblclick")
    await flushRuntimeTasks()

    const firstEditor = wrapper.find<HTMLInputElement>(".cell-editor-input")
    expect(firstEditor.exists()).toBe(true)
    ;(firstEditor.element as HTMLInputElement).value = "Legacy"
    firstEditor.element.dispatchEvent(new Event("input", { bubbles: true }))

    const nextCell = queryBodyCell(wrapper, 1, 0)
    nextCell.element.dispatchEvent(new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    }))
    nextCell.element.dispatchEvent(new KeyboardEvent("keydown", {
      key: "n",
      bubbles: true,
      cancelable: true,
    }))
    await flushRuntimeTasks()

    const nextEditor = queryBodyCell(wrapper, 1, 0).find<HTMLInputElement>(".cell-editor-input")
    expect(nextEditor.exists()).toBe(true)
    expect((nextEditor.element as HTMLInputElement).value).toBe("n")
    expect(resolveRowAt<{ owner: string }>(wrapper, 0)).toMatchObject({ owner: "Legacy" })

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
        isCellEditable: ({ rowId }) => rowId !== "r1",
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

  it("supports declarative columnMenu trigger modes", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: {
          trigger: "button",
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    expect(queryColumnMenuButton("owner")).toBeTruthy()

    await wrapper.find('.grid-cell--header[data-column-key="owner"]').trigger("contextmenu", {
      button: 2,
      clientX: 120,
      clientY: 48,
    })
    await flushRuntimeTasks()

    expect(queryColumnMenuRoot()).toBeNull()

    await wrapper.find('.grid-cell--header[data-column-key="owner"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    expect(queryColumnMenuRoot()).toBeTruthy()

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

  it("supports declarative custom columnMenu items with placement and per-column overrides", async () => {
    const onInsertLeft = vi.fn()
    const onRename = vi.fn()
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: {
          customItems: [
            {
              key: "insert-left",
              label: "Insert column left",
              placement: "after:group",
              onSelect: onInsertLeft,
            },
          ],
          columns: {
            owner: {
              customItems: [
                {
                  key: "rename",
                  label: "Rename column",
                  placement: "end",
                  onSelect: onRename,
                },
              ],
            },
          },
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    await wrapper.find('.grid-cell--header[data-column-key="owner"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    const toggleGroup = queryColumnMenuAction("toggle-group")
    const insertLeft = queryColumnMenuAction("custom:insert-left")
    const rename = queryColumnMenuAction("custom:rename")

    expect(insertLeft?.textContent).toContain("Insert column left")
    expect(rename?.textContent).toContain("Rename column")
    expect(toggleGroup).toBeTruthy()
    expect(insertLeft).toBeTruthy()
    expect(Boolean(toggleGroup?.compareDocumentPosition(insertLeft as Node) && (toggleGroup!.compareDocumentPosition(insertLeft as Node) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)

    insertLeft?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(onInsertLeft).toHaveBeenCalledWith(expect.objectContaining({
      columnKey: "owner",
      columnLabel: "Owner",
      closeMenu: expect.any(Function),
    }))

    await wrapper.find('.grid-cell--header[data-column-key="owner"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    queryColumnMenuAction("custom:rename")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(onRename).toHaveBeenCalledWith(expect.objectContaining({
      columnKey: "owner",
      columnLabel: "Owner",
      closeMenu: expect.any(Function),
    }))

    await wrapper.find('.grid-cell--header[data-column-key="region"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    expect(queryColumnMenuAction("custom:insert-left")?.textContent).toContain("Insert column left")
    expect(queryColumnMenuAction("custom:rename")).toBeNull()

    wrapper.unmount()
  })

  it("supports nested declarative custom columnMenu submenus", async () => {
    const onDuplicate = vi.fn()
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: {
          customItems: [
            {
              key: "organize",
              label: "Organize",
              kind: "submenu",
              placement: "after:group",
              items: [
                {
                  key: "advanced",
                  label: "Advanced",
                  kind: "submenu",
                  items: [
                    {
                      key: "duplicate",
                      label: "Duplicate column",
                      onSelect: onDuplicate,
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    await wrapper.find('.grid-cell--header[data-column-key="owner"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    const organize = queryColumnMenuAction("custom:organize")
    expect(organize?.textContent).toContain("Organize")

    organize?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    const advanced = queryColumnMenuAction("custom:organize/advanced")
    expect(advanced?.textContent).toContain("Advanced")

    advanced?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    const duplicate = queryColumnMenuAction("custom:organize/advanced/duplicate")
    expect(duplicate?.textContent).toContain("Duplicate column")

    duplicate?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(onDuplicate).toHaveBeenCalledWith(expect.objectContaining({
      columnKey: "owner",
      columnLabel: "Owner",
      closeMenu: expect.any(Function),
    }))

    wrapper.unmount()
  })

  it("supports declarative cellMenu action composition per column", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        cellMenu: {
          items: ["clipboard", "edit"],
          columns: {
            owner: {
              actions: {
                cut: { hidden: true },
                copy: { label: "Copy owner value" },
              },
            },
          },
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const ownerCell = wrapper.find('.grid-body-viewport .datagrid-stage__cell[data-row-id="r1"][data-column-key="owner"]')
    expect(ownerCell.exists()).toBe(true)

    await ownerCell.trigger("contextmenu", { button: 2, clientX: 120, clientY: 48 })
    await flushRuntimeTasks()

    expect(queryContextMenuRoot()).toBeTruthy()
    expect(queryContextMenuAction("cut")).toBeNull()
    expect(queryContextMenuAction("copy")?.textContent).toContain("Copy owner value")
    expect(queryContextMenuAction("paste")).toBeTruthy()
    expect(queryContextMenuAction("clear")?.textContent).toContain("Clear values")

    wrapper.unmount()
  })

  it("clears the targeted cell from declarative cellMenu", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: EDITABLE_COLUMNS,
        cellMenu: {
          items: ["edit"],
          actions: {
            clear: { label: "Clear contents" },
          },
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    resolveVm(wrapper).getApi?.()?.selection?.setSnapshot?.({
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        startRowId: "r1",
        endRowId: "r1",
      }],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
    })
    await flushRuntimeTasks()

    const ownerCell = wrapper.find('.grid-body-viewport .datagrid-stage__cell[data-row-id="r1"][data-column-key="owner"]')
    expect(ownerCell.exists()).toBe(true)

    await ownerCell.trigger("contextmenu", { button: 2, clientX: 120, clientY: 48 })
    await flushRuntimeTasks()

    expect(queryContextMenuAction("clear")?.textContent).toContain("Clear contents")

    queryContextMenuAction("clear")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      rows: {
        get: (rowIndex: number) => { data?: { owner?: string } } | null
      }
    } | null
    expect(api?.rows.get(0)?.data?.owner).toBe("")

    wrapper.unmount()
  })

  it("opens declarative rowIndexMenu and inserts a row below the targeted row", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowIndexMenu: {
          actions: {
            insertBelow: { label: "Insert line below" },
          },
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const beforeRowCount = resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0
    const rowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    expect(rowIndexCell.exists()).toBe(true)

    await rowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 42 })
    await flushRuntimeTasks()

    expect(queryContextMenuAction("insert-row-below")?.textContent).toContain("Insert line below")

    queryContextMenuAction("insert-row-below")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect((resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0)).toBe(beforeRowCount + 1)
    expect(document.activeElement?.classList.contains("grid-body-viewport")).toBe(true)

    wrapper.unmount()
  })

  it("supports Insert and Ctrl+I on the row index to insert a row above", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowIndexMenu: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const beforeRowCount = resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0
    const rowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r2"]')
    expect(rowIndexCell.exists()).toBe(true)

    await rowIndexCell.trigger("click")
    await rowIndexCell.trigger("keydown", { key: "i", ctrlKey: true })
    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      rows: {
        get: (index: number) => { rowId?: string; data?: { owner?: string } } | undefined
      }
    } | null

    expect((resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0)).toBe(beforeRowCount + 1)
    expect(api?.rows.get(1)?.data?.owner).toBe("")
    expect(document.activeElement?.classList.contains("datagrid-stage__row-index-cell")).toBe(true)

    await rowIndexCell.trigger("keydown", { key: "Insert" })
    await flushRuntimeTasks()

    expect((resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0)).toBe(beforeRowCount + 2)

    wrapper.unmount()
  })

  it("opens the row index menu from the keyboard and shows shortcut hints", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowIndexMenu: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const rowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r2"]')
    expect(rowIndexCell.exists()).toBe(true)

    await rowIndexCell.trigger("click")
    await rowIndexCell.trigger("keydown", { key: "F10", shiftKey: true })
    await flushRuntimeTasks()

    expect(queryContextMenuRoot()).toBeTruthy()
    expect(queryContextMenuAction("insert-row-above")?.textContent).toContain("Insert / Ctrl/Cmd+I")
    expect(queryContextMenuAction("copy-row")?.textContent).toContain("Ctrl/Cmd+C")
    expect(queryContextMenuAction("cut-row")?.textContent).toContain("Ctrl/Cmd+X")
    expect(queryContextMenuAction("paste-row")?.textContent).toContain("Ctrl/Cmd+V")

    queryContextMenuRoot()?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    await flushRuntimeTasks()

    await rowIndexCell.trigger("click")
    await rowIndexCell.trigger("keydown", { key: "ContextMenu" })
    await flushRuntimeTasks()

    expect(queryContextMenuRoot()).toBeTruthy()
    expect(queryContextMenuAction("copy-row")?.textContent).toContain("Copy row")

    wrapper.unmount()
  })

  it("reorders rows by dragging the row index and keeps visible labels sequential", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowIndexMenu: true,
        rowReorder: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const firstRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    const lastRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r3"]')
    expect(firstRowIndexCell.exists()).toBe(true)
    expect(lastRowIndexCell.exists()).toBe(true)

    await dragDropElement(firstRowIndexCell.element as HTMLElement, lastRowIndexCell.element as HTMLElement, {
      targetClientY: 28,
    })
    await flushAnimationFrame()
    await flushRuntimeTasks()

    expect(resolveRowAt<Record<string, unknown>>(wrapper, 0)?.rowId).toBe("r2")
    expect(resolveRowAt<Record<string, unknown>>(wrapper, 1)?.rowId).toBe("r3")
    expect(resolveRowAt<Record<string, unknown>>(wrapper, 2)?.rowId).toBe("r1")

    const rowIndexLabels = (Array.from(
      wrapper.element.querySelectorAll('.grid-body-pane--left .datagrid-stage__row-index-cell'),
    ) as HTMLElement[])
      .filter(cell => ["r1", "r2", "r3"].includes(cell.dataset.rowId ?? ""))
      .map(cell => cell.textContent?.trim())

    expect(rowIndexLabels).toEqual(["1", "2", "3"])

    const movedRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    expect(movedRowIndexCell.exists()).toBe(true)
    expect(document.activeElement?.classList.contains("grid-body-viewport")).toBe(true)
    expect((movedRowIndexCell.element as HTMLElement).tabIndex).toBe(0)

    wrapper.unmount()
  })

  it("keeps row index drag disabled unless rowReorder is enabled declaratively", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowIndexMenu: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const firstRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    expect(firstRowIndexCell.exists()).toBe(true)
    expect((firstRowIndexCell.element as HTMLElement).draggable).toBe(false)

    wrapper.unmount()
  })

  it("reorders columns by dragging header cells when columnReorder is enabled", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: false,
        columnReorder: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const ownerHeader = wrapper.find('.grid-header-viewport .grid-cell--header[data-column-key="owner"]')
    const amountHeader = wrapper.find('.grid-header-viewport .grid-cell--header[data-column-key="amount"]')
    expect(ownerHeader.exists()).toBe(true)
    expect(amountHeader.exists()).toBe(true)
    expect((ownerHeader.element as HTMLElement).draggable).toBe(true)

    await dragDropElement(ownerHeader.element as HTMLElement, amountHeader.element as HTMLElement, {
      targetClientX: 96,
    })
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getColumnSnapshot?.()).toMatchObject({
      order: ["region", "amount", "owner"],
    })

    wrapper.unmount()
  })

  it("keeps active-cell continuity after column reorder so keyboard navigation stays on the moved logical column", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: false,
        columnReorder: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      selection?: {
        setSnapshot?: (snapshot: unknown) => void
        getSnapshot?: () => unknown
      }
    } | null

    api?.selection?.setSnapshot?.({
      ranges: [{
        startRow: 1,
        endRow: 1,
        startCol: 0,
        endCol: 0,
        startRowId: "r2",
        endRowId: "r2",
        anchor: { rowIndex: 1, colIndex: 0, rowId: "r2" },
        focus: { rowIndex: 1, colIndex: 0, rowId: "r2" },
      }],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: "r2" },
    })
    await flushRuntimeTasks()

    const ownerHeader = wrapper.find('.grid-header-viewport .grid-cell--header[data-column-key="owner"]')
    const amountHeader = wrapper.find('.grid-header-viewport .grid-cell--header[data-column-key="amount"]')
    expect(ownerHeader.exists()).toBe(true)
    expect(amountHeader.exists()).toBe(true)

    await dragDropElement(ownerHeader.element as HTMLElement, amountHeader.element as HTMLElement, {
      targetClientX: 96,
    })
    await flushAnimationFrame()
    await flushRuntimeTasks()

    expect(api?.selection?.getSnapshot?.()).toMatchObject({
      ranges: [expect.objectContaining({
        startRow: 1,
        endRow: 1,
        startCol: 2,
        endCol: 2,
        anchor: expect.objectContaining({ rowIndex: 1, colIndex: 2, rowId: "r2" }),
        focus: expect.objectContaining({ rowIndex: 1, colIndex: 2, rowId: "r2" }),
      })],
      activeCell: expect.objectContaining({ rowIndex: 1, colIndex: 2, rowId: "r2" }),
    })

    expect(document.activeElement?.classList.contains("grid-body-viewport")).toBe(true)

    const viewport = wrapper.find('.grid-body-viewport')
    expect(viewport.exists()).toBe(true)
    await viewport.trigger("keydown", { key: "ArrowLeft" })
    await flushRuntimeTasks()

    expect(api?.selection?.getSnapshot?.()).toMatchObject({
      activeCell: expect.objectContaining({ rowIndex: 1, colIndex: 1, rowId: "r2" }),
    })

    wrapper.unmount()
  })

  it("moves columns across pin lanes and updates the target pin declaratively", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: false,
        columnReorder: true,
        columnState: {
          order: ["owner", "region", "amount"],
          visibility: {
            owner: true,
            region: true,
            amount: true,
          },
          widths: {},
          pins: {
            owner: "left",
            region: "none",
            amount: "right",
          },
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const ownerHeader = wrapper.find('.grid-header-pane--left .grid-cell--header[data-column-key="owner"]')
    const regionHeader = wrapper.find('.grid-header-viewport .grid-cell--header[data-column-key="region"]')
    expect(ownerHeader.exists()).toBe(true)
    expect(regionHeader.exists()).toBe(true)

    await dragDropElement(ownerHeader.element as HTMLElement, regionHeader.element as HTMLElement, {
      targetClientX: 8,
    })
    await flushAnimationFrame()
    await flushRuntimeTasks()

    const columnSnapshot = resolveVm(wrapper).getColumnSnapshot?.()
    expect(columnSnapshot).toMatchObject({
      order: ["owner", "region", "amount"],
    })
    expect(columnSnapshot?.columns).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "owner", pin: "none" }),
      expect.objectContaining({ key: "region", pin: "none" }),
      expect.objectContaining({ key: "amount", pin: "right" }),
    ]))

    expect(wrapper.find('.grid-header-pane--left .grid-cell--header[data-column-key="owner"]').exists()).toBe(false)
    expect(wrapper.find('.grid-header-viewport .grid-cell--header[data-column-key="owner"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it("keeps header drag disabled unless columnReorder is enabled declaratively", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnMenu: false,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const ownerHeader = wrapper.find('.grid-header-viewport .grid-cell--header[data-column-key="owner"]')
    expect(ownerHeader.exists()).toBe(true)
    expect((ownerHeader.element as HTMLElement).draggable).toBe(false)

    wrapper.unmount()
  })

  it("supports Ctrl+C and Ctrl+V on the row index to paste a copied row", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowIndexMenu: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const beforeRowCount = resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0
    const firstRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    const secondRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r2"]')
    expect(firstRowIndexCell.exists()).toBe(true)
    expect(secondRowIndexCell.exists()).toBe(true)

    await firstRowIndexCell.trigger("click")
    await firstRowIndexCell.trigger("keydown", { key: "c", ctrlKey: true })
    await flushRuntimeTasks()

    expect(wrapper.find('.grid-body-pane--left .grid-row').classes()).toContain("grid-row--clipboard-pending")

    await secondRowIndexCell.trigger("click")
    await secondRowIndexCell.trigger("keydown", { key: "v", ctrlKey: true })
    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      rows: {
        get: (index: number) => { rowId?: string; data?: { owner?: string } } | undefined
      }
    } | null

    expect((resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0)).toBe(beforeRowCount + 1)
    expect(api?.rows.get(2)?.data?.owner).toBe("NOC")

    wrapper.unmount()
  })

  it("supports Ctrl+X and Ctrl+V on the row index to move a cut row", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowIndexMenu: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const beforeRowCount = resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0
    const firstRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    const lastRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r3"]')
    expect(firstRowIndexCell.exists()).toBe(true)
    expect(lastRowIndexCell.exists()).toBe(true)

    await firstRowIndexCell.trigger("click")
    await firstRowIndexCell.trigger("keydown", { key: "x", ctrlKey: true })
    await flushRuntimeTasks()

    expect((resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0)).toBe(beforeRowCount)
    expect(wrapper.find('.grid-body-pane--left .grid-row').classes()).toContain("grid-row--clipboard-pending")

    await lastRowIndexCell.trigger("click")
    await lastRowIndexCell.trigger("keydown", { key: "v", ctrlKey: true })
    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      rows: {
        get: (index: number) => { rowId?: string } | undefined
      }
    } | null

    expect((resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0)).toBe(beforeRowCount)
    expect([
      api?.rows.get(0)?.rowId,
      api?.rows.get(1)?.rowId,
      api?.rows.get(2)?.rowId,
    ]).toEqual(["r2", "r3", "r1"])

    wrapper.unmount()
  })

  it("inserts a row below when source rows are structured row-node inputs", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: PINNED_BOTTOM_SELECTION_ROWS,
        columns: PINNED_BOTTOM_SELECTION_COLUMNS,
        rowIndexMenu: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const beforeRowCount = resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0
    const rowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="pb1"]')
    expect(rowIndexCell.exists()).toBe(true)

    await rowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 42 })
    await flushRuntimeTasks()

    queryContextMenuAction("insert-row-below")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      rows: {
        get: (index: number) => { rowId?: string; data?: { project?: string } } | undefined
      }
    } | null

    expect((resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0)).toBe(beforeRowCount + 1)
    expect(api?.rows.get(1)?.rowId).toBeTruthy()
    expect(api?.rows.get(1)?.data?.project).toBe("")

    wrapper.unmount()
  })

  it("repeats insert-row-above on structured row-node inputs without losing row identity", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: PINNED_BOTTOM_SELECTION_ROWS,
        columns: PINNED_BOTTOM_SELECTION_COLUMNS,
        rowIndexMenu: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      rows: {
        get: (index: number) => { rowId?: string; data?: { project?: string } } | undefined
      }
    } | null

    const firstRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="pb1"]')
    expect(firstRowIndexCell.exists()).toBe(true)

    await firstRowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 42 })
    await flushRuntimeTasks()

    queryContextMenuAction("insert-row-above")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    const insertedRowId = api?.rows.get(0)?.rowId
    expect(insertedRowId).toBeTruthy()

    const insertedRowIndexCell = wrapper.find(`.datagrid-stage__row-index-cell[data-row-id="${insertedRowId}"]`)
    expect(insertedRowIndexCell.exists()).toBe(true)

    await insertedRowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 30 })
    await flushRuntimeTasks()

    queryContextMenuAction("insert-row-above")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(api?.rows.get(0)?.rowId).toBeTruthy()
    expect(api?.rows.get(1)?.rowId).toBe(insertedRowId)
    expect(api?.rows.get(0)?.data?.project).toBe("")
    expect(api?.rows.get(1)?.data?.project).toBe("")

    wrapper.unmount()
  })

  it("pastes a copied row below even when the row carries non-cloneable values", async () => {
    const rowsWithLiveReference = [
      { rowId: "r1", owner: "NOC", region: "eu-west", amount: 10, liveRef: globalThis },
      { rowId: "r2", owner: "Payments", region: "us-east", amount: 20, liveRef: globalThis },
    ] as const

    const wrapper = mount(DataGrid, {
      props: {
        rows: rowsWithLiveReference,
        columns: COLUMNS,
        rowIndexMenu: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const beforeRowCount = resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0
    const firstRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    expect(firstRowIndexCell.exists()).toBe(true)

    await firstRowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 42 })
    await flushRuntimeTasks()

    queryContextMenuAction("copy-row")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()
    expect(wrapper.find('.grid-body-pane--left .grid-row').classes()).toContain("grid-row--clipboard-pending")

    const secondRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r2"]')
    expect(secondRowIndexCell.exists()).toBe(true)

    await secondRowIndexCell.trigger("contextmenu", { button: 2, clientX: 108, clientY: 56 })
    await flushRuntimeTasks()

    queryContextMenuAction("paste-row")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect((resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0)).toBe(beforeRowCount + 1)
    expect(wrapper.find('.grid-body-pane--left .grid-row').classes()).toContain("grid-row--clipboard-pending")

    wrapper.unmount()
  })

  it("clears pending row clipboard outline on Escape", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowIndexMenu: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      selection?: {
        setSnapshot?: (snapshot: unknown) => void
      }
    } | null
    api?.selection?.setSnapshot?.({
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      }],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
    })
    await flushRuntimeTasks()

    const rowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    expect(rowIndexCell.exists()).toBe(true)

    await rowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 42 })
    await flushRuntimeTasks()

    queryContextMenuAction("copy-row")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(wrapper.find('.grid-body-pane--left .grid-row').classes()).toContain("grid-row--clipboard-pending")

    const viewport = wrapper.find(".grid-body-viewport")
    expect(viewport.exists()).toBe(true)
    await viewport.trigger("keydown", { key: "Escape" })
    await flushRuntimeTasks()

    expect(wrapper.find('.grid-body-pane--left .grid-row').classes()).not.toContain("grid-row--clipboard-pending")

    wrapper.unmount()
  })

  it("cuts the targeted row from declarative rowIndexMenu", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowIndexMenu: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const beforeRowCount = resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0
    const rowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    expect(rowIndexCell.exists()).toBe(true)

    await rowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 42 })
    await flushRuntimeTasks()

    expect(queryContextMenuAction("cut-row")?.textContent).toContain("Cut row")

    queryContextMenuAction("cut-row")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect((resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0)).toBe(beforeRowCount)
    expect(wrapper.find('.grid-body-pane--left .grid-row').classes()).toContain("grid-row--clipboard-pending")

    const lastRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r3"]')
    expect(lastRowIndexCell.exists()).toBe(true)

    await lastRowIndexCell.trigger("contextmenu", { button: 2, clientX: 108, clientY: 72 })
    await flushRuntimeTasks()

    queryContextMenuAction("paste-row")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      rows: {
        get: (index: number) => { rowId?: string } | undefined
      }
    } | null
    expect([
      api?.rows.get(0)?.rowId,
      api?.rows.get(1)?.rowId,
      api?.rows.get(2)?.rowId,
    ]).toEqual(["r2", "r3", "r1"])
    expect(wrapper.find('.grid-body-pane--left .grid-row').classes()).not.toContain("grid-row--clipboard-pending")

    wrapper.unmount()
  })

  it("cuts the current row-index selection range from declarative rowIndexMenu", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowIndexMenu: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      selection?: {
        setSnapshot?: (snapshot: unknown) => void
      }
      rows: {
        get: (index: number) => { rowId?: string } | undefined
      }
    } | null

    api?.selection?.setSnapshot?.({
      ranges: [{
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: COLUMNS.length - 1,
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 1, colIndex: 0, rowId: "r2" },
        startRowId: "r1",
        endRowId: "r2",
      }],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: "r2" },
    })
    await flushRuntimeTasks()

    const secondRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r2"]')
    expect(secondRowIndexCell.exists()).toBe(true)

    await secondRowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 56 })
    await flushRuntimeTasks()

    queryContextMenuAction("cut-row")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(wrapper.findAll('.grid-body-pane--left .grid-row').at(0)?.classes()).toContain("grid-row--clipboard-pending")
    expect(wrapper.findAll('.grid-body-pane--left .grid-row').at(1)?.classes()).toContain("grid-row--clipboard-pending")

    const lastRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r3"]')
    expect(lastRowIndexCell.exists()).toBe(true)

    await lastRowIndexCell.trigger("contextmenu", { button: 2, clientX: 108, clientY: 72 })
    await flushRuntimeTasks()

    queryContextMenuAction("paste-row")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect([
      api?.rows.get(0)?.rowId,
      api?.rows.get(1)?.rowId,
      api?.rows.get(2)?.rowId,
    ]).toEqual(["r3", "r1", "r2"])
    expect(wrapper.find('.grid-body-pane--left .grid-row').classes()).not.toContain("grid-row--clipboard-pending")

    wrapper.unmount()
  })

  it("deletes the targeted row from declarative rowIndexMenu when no rows are preselected", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowSelection: true,
        rowIndexMenu: {
          items: ["selection"],
          actions: {
            deleteSelected: { label: "Delete chosen rows" },
          },
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const beforeRowCount = resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0
    const rowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    expect(rowIndexCell.exists()).toBe(true)

    await rowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 42 })
    await flushRuntimeTasks()

    expect(queryContextMenuAction("delete-selected-rows")?.textContent).toContain("Delete chosen rows")

    queryContextMenuAction("delete-selected-rows")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect((resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0)).toBe(beforeRowCount - 1)

    wrapper.unmount()
  })

  it("deletes selected rows from declarative rowIndexMenu", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowSelection: true,
        rowIndexMenu: {
          items: ["selection"],
          actions: {
            deleteSelected: { label: "Delete chosen rows" },
          },
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      rowSelection: {
        selectRows: (rowIds: readonly string[]) => void
        getSnapshot?: () => unknown
      }
    } | null
    api?.rowSelection.selectRows(["r1", "r2"])
    await flushRuntimeTasks()

    const beforeRowCount = resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0
    const rowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    expect(rowIndexCell.exists()).toBe(true)

    await rowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 42 })
    await flushRuntimeTasks()

    expect(queryContextMenuAction("delete-selected-rows")?.textContent).toContain("Delete chosen rows")

    queryContextMenuAction("delete-selected-rows")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect((resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0)).toBe(beforeRowCount - 2)
    expect(resolveVm(wrapper).getApi?.()?.rowSelection.getSnapshot?.()).toBeNull()

    wrapper.unmount()
  })

  it("deletes the current row-index selection range from declarative rowIndexMenu", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowIndexMenu: {
          items: ["selection"],
          actions: {
            deleteSelected: { label: "Delete chosen rows" },
          },
        },
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const firstRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    expect(firstRowIndexCell.exists()).toBe(true)

    const api = resolveVm(wrapper).getApi?.() as {
      selection?: {
        setSnapshot?: (snapshot: unknown) => void
      }
      rows: {
        get: (index: number) => { rowId?: string } | undefined
      }
    } | null

    api?.selection?.setSnapshot?.({
      ranges: [{
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: COLUMNS.length - 1,
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 1, colIndex: 0, rowId: "r2" },
        startRowId: "r1",
        endRowId: "r2",
      }],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: "r2" },
    })
    await flushRuntimeTasks()

    const beforeRowCount = resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0

    await firstRowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 42 })
    await flushRuntimeTasks()

    expect(queryContextMenuAction("delete-selected-rows")?.textContent).toContain("Delete chosen rows")

    queryContextMenuAction("delete-selected-rows")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect((resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0)).toBe(beforeRowCount - 2)
    expect([api?.rows.get(0)?.rowId]).toEqual(["r3"])

    wrapper.unmount()
  })

  it("supports Delete and Backspace on the row index to delete selected rows", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowIndexMenu: true,
      },
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const secondRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r2"]')
    expect(secondRowIndexCell.exists()).toBe(true)

    const api = resolveVm(wrapper).getApi?.() as {
      selection?: {
        setSnapshot?: (snapshot: unknown) => void
      }
      rows: {
        get: (index: number) => { rowId?: string } | undefined
      }
    } | null

    api?.selection?.setSnapshot?.({
      ranges: [{
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: COLUMNS.length - 1,
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 1, colIndex: 0, rowId: "r2" },
        startRowId: "r1",
        endRowId: "r2",
      }],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: "r2" },
    })
    await flushRuntimeTasks()

    await secondRowIndexCell.trigger("keydown", { key: "Delete" })
    await flushRuntimeTasks()

    expect(resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0).toBe(1)
    expect(api?.rows.get(0)?.rowId).toBe("r3")

    const remainingRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r3"]')
    expect(remainingRowIndexCell.exists()).toBe(true)

    await remainingRowIndexCell.trigger("click")
    await remainingRowIndexCell.trigger("keydown", { key: "Backspace" })
    await flushRuntimeTasks()

    expect(resolveRowModel(wrapper)?.getSnapshot().rowCount ?? 0).toBe(0)

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

  it("builds value-set filter choices from effective column values", async () => {
    const wrapper = mount(EffectiveFilterGrid, {
      props: {
        rows: EFFECTIVE_FILTER_ROWS,
        columns: EFFECTIVE_FILTER_COLUMNS,
        columnMenu: true,
        rowSelection: false,
      },
    })

    await flushRuntimeTasks()

    await wrapper.find('.grid-cell--header[data-column-key="status"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    const valueRows = Array.from(queryColumnMenuRoot()?.querySelectorAll<HTMLElement>(".datagrid-column-menu__value") ?? [])
    expect(valueRows.map(row => row.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      expect.stringContaining("Active"),
      expect.stringContaining("Blocked"),
    ])

    const activeRow = valueRows.find(row => row.textContent?.includes("Active"))
    expect(activeRow).toBeTruthy()
    const activeCheckbox = activeRow!.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(activeCheckbox).toBeTruthy()
    activeCheckbox!.checked = false
    activeCheckbox!.dispatchEvent(new Event("change", { bubbles: true }))
    queryColumnMenuAction("apply-filter")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getState?.()).toMatchObject({
      rows: expect.objectContaining({
        snapshot: expect.objectContaining({
          filterModel: expect.objectContaining({
            columnFilters: expect.objectContaining({
              status: expect.objectContaining({
                kind: "valueSet",
                tokens: ["string:blocked"],
              }),
            }),
          }),
          rowCount: 1,
        }),
      }),
    })

    wrapper.unmount()
  })

  it("accepts a typed readFilterCell helper on the public facade", async () => {
    const readFilterCell = defineDataGridFilterCellReader<EffectiveFilterRow>()((row, columnKey) => {
      if (columnKey !== "status") {
        return undefined
      }
      return row.data.statusCode === "a" ? "Active" : "Blocked"
    })

    const wrapper = mount(EffectiveFilterGrid, {
      props: {
        rows: EFFECTIVE_FILTER_ROWS,
        columns: defineDataGridColumns<EffectiveFilterRow>()([
          { key: "status", field: "statusCode", label: "Status", width: 180 },
        ] as const),
        columnMenu: true,
        rowSelection: false,
        readFilterCell,
      },
    })

    await flushRuntimeTasks()

    await wrapper.find('.grid-cell--header[data-column-key="status"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushRuntimeTasks()

    const valueRows = Array.from(queryColumnMenuRoot()?.querySelectorAll<HTMLElement>(".datagrid-column-menu__value") ?? [])
    expect(valueRows.map(row => row.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      expect.stringContaining("Active"),
      expect.stringContaining("Blocked"),
    ])

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
    await preloadAdvancedFilterPopover()

    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        advancedFilter: true,
      },
    })

    const trigger = await findAdvancedFilterTrigger(wrapper)
    expect(trigger.exists()).toBe(true)
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

  it("lets users drag the advanced filter panel and reopens it at the detached position", async () => {
    await preloadAdvancedFilterPopover()

    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        advancedFilter: true,
      },
    })

    const trigger = await findAdvancedFilterTrigger(wrapper)
    await trigger.trigger("click")
    await flushRuntimeTasks()

    const initialRoot = queryAdvancedFilterRoot()
    expect(initialRoot).toBeTruthy()
    const initialPosition = readOverlayPosition(initialRoot)
    expect(initialPosition).toBeTruthy()

    await dragOverlaySurface(initialRoot!, { x: 84, y: 56 })

    const draggedRoot = queryAdvancedFilterRoot()
    const draggedPosition = readOverlayPosition(draggedRoot)
    expect(draggedPosition).toEqual({
      left: initialPosition!.left + 84,
      top: initialPosition!.top + 56,
    })

    draggedRoot?.querySelector<HTMLButtonElement>(".datagrid-advanced-filter__ghost")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushRuntimeTasks()
    expect(queryAdvancedFilterRoot()).toBeNull()

    await trigger.trigger("click")
    await flushRuntimeTasks()

    expect(readOverlayPosition(queryAdvancedFilterRoot())).toEqual(draggedPosition)

    wrapper.unmount()
  })

  it("opens declarative findReplace, selects the next match, and flashes the resolved cell", async () => {
    await preloadFindReplacePopover()

    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: SEARCH_FILTER_ROWS,
        columns: COLUMNS,
        findReplace: true,
      },
    })

    await flushRuntimeTasks()

    const trigger = findToolbarAction(wrapper, "find-replace")
    expect(trigger.exists()).toBe(true)
    await trigger.trigger("click")
    await flushRuntimeTasks()

    const popover = queryFindReplaceRoot()
    expect(popover).toBeTruthy()

    const findInput = popover?.querySelector<HTMLInputElement>('[data-find-replace-autofocus="true"]') ?? null
    expect(findInput).toBeTruthy()
    findInput!.value = "Beta"
    findInput!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushRuntimeTasks()

    const findNextButton = Array.from(popover?.querySelectorAll<HTMLButtonElement>("button") ?? [])
      .find(button => button.textContent?.includes("Find next"))
    expect(findNextButton).toBeTruthy()
    findNextButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(queryFindReplaceRoot()).toBeTruthy()

    const targetCell = queryBodyCell(wrapper, 2, 0)
    expect(targetCell.exists()).toBe(true)
    expect(targetCell.classes()).toContain("grid-cell--selection-anchor")
    expect(targetCell.classes()).toContain("grid-cell--find-match-active")

    wrapper.unmount()
  })

  it("lets users drag the find/replace panel and reopens it at the detached position", async () => {
    await preloadFindReplacePopover()

    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: SEARCH_FILTER_ROWS,
        columns: COLUMNS,
        findReplace: true,
      },
    })

    await flushRuntimeTasks()

    const trigger = findToolbarAction(wrapper, "find-replace")
    await trigger.trigger("click")
    await flushRuntimeTasks()

    const initialRoot = queryFindReplaceRoot()
    expect(initialRoot).toBeTruthy()
    const initialPosition = readOverlayPosition(initialRoot)
    expect(initialPosition).toBeTruthy()

    await dragOverlaySurface(initialRoot!, { x: 72, y: 44 })

    const draggedPosition = readOverlayPosition(queryFindReplaceRoot())
    expect(draggedPosition).toEqual({
      left: initialPosition!.left + 72,
      top: initialPosition!.top + 44,
    })

    queryFindReplaceRoot()?.querySelector<HTMLButtonElement>(".datagrid-find-replace__ghost")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushRuntimeTasks()
    expect(queryFindReplaceRoot()).toBeNull()

    await trigger.trigger("click")
    await flushRuntimeTasks()

    expect(readOverlayPosition(queryFindReplaceRoot())).toEqual(draggedPosition)

    wrapper.unmount()
  })

  it("hydrates advanced filter clauses from column menu filters", async () => {
    await preloadAdvancedFilterPopover()

    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: SEARCH_FILTER_ROWS,
        columns: COLUMNS,
        columnMenu: true,
        advancedFilter: true,
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
            advancedExpression: null,
          }),
          rowCount: 1,
        }),
      }),
    })

    const trigger = await findAdvancedFilterTrigger(wrapper)
    await trigger.trigger("click")
    await flushRuntimeTasks()

    const advancedFilterRows = Array.from(queryAdvancedFilterRoot()?.querySelectorAll<HTMLElement>(".datagrid-advanced-filter__row") ?? [])
    expect(advancedFilterRows).toHaveLength(1)

    const comboboxes = advancedFilterRows[0]?.querySelectorAll<HTMLInputElement>('input[role="combobox"]') ?? []
    expect(comboboxes[1]?.value).toBe("Owner")
    expect(comboboxes[2]?.value).toBe("In")
    expect(
      advancedFilterRows[0]?.querySelector<HTMLInputElement>('.datagrid-advanced-filter__field--value input[type="text"]')?.value,
    ).toBe("beta")

    queryAdvancedFilterRoot()?.querySelector<HTMLElement>(".datagrid-advanced-filter__primary")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getState?.()).toMatchObject({
      rows: expect.objectContaining({
        snapshot: expect.objectContaining({
          filterModel: expect.objectContaining({
            columnFilters: {},
            advancedFilters: {},
            advancedExpression: expect.objectContaining({
              kind: "condition",
              key: "owner",
              operator: "in",
              value: "beta",
            }),
          }),
          rowCount: 1,
        }),
      }),
    })

    wrapper.unmount()
  })

  it("reopens advanced filter builder with the same mixed-join draft clauses after apply", async () => {
    await preloadAdvancedFilterPopover()

    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        advancedFilter: true,
      },
    })

    const selectComboboxOption = async (input: HTMLInputElement, optionLabel: string, query: string = optionLabel): Promise<void> => {
      input.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      input.value = query
      input.dispatchEvent(new Event("input", { bubbles: true }))
      await flushRuntimeTasks()

      const option = [...document.body.querySelectorAll<HTMLButtonElement>(".datagrid-cell-combobox__option")].find(candidate => (
        candidate.textContent?.includes(optionLabel)
      ))
      expect(option).toBeTruthy()
      option?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      await flushRuntimeTasks()
    }

    const trigger = await findAdvancedFilterTrigger(wrapper)
    expect(trigger.exists()).toBe(true)
    await trigger.trigger("click")
    await flushRuntimeTasks()

    let popover = queryAdvancedFilterRoot()
    expect(popover).toBeTruthy()

    let rows = Array.from(popover?.querySelectorAll<HTMLElement>(".datagrid-advanced-filter__row") ?? [])
    expect(rows).toHaveLength(1)

    const firstValueInput = rows[0]?.querySelector<HTMLInputElement>('.datagrid-advanced-filter__field--value input[type="text"]')
    expect(firstValueInput).toBeTruthy()
    firstValueInput!.value = "NOC"
    firstValueInput!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushRuntimeTasks()

    popover?.querySelector<HTMLElement>(".datagrid-advanced-filter__secondary")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushRuntimeTasks()

    popover = queryAdvancedFilterRoot()
    rows = Array.from(popover?.querySelectorAll<HTMLElement>(".datagrid-advanced-filter__row") ?? [])
    expect(rows).toHaveLength(2)

    const secondComboboxes = rows[1]?.querySelectorAll<HTMLInputElement>('input[role="combobox"]')
    expect(secondComboboxes?.length).toBe(3)
    await selectComboboxOption(secondComboboxes![0]!, "OR", "or")
    await selectComboboxOption(secondComboboxes![1]!, "Region", "reg")
    await selectComboboxOption(secondComboboxes![2]!, "Equals", "eq")

    const secondValueInput = rows[1]?.querySelector<HTMLInputElement>('.datagrid-advanced-filter__field--value input[type="text"]')
    expect(secondValueInput).toBeTruthy()
    secondValueInput!.value = "eu-west"
    secondValueInput!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushRuntimeTasks()

    popover?.querySelector<HTMLElement>(".datagrid-advanced-filter__secondary")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushRuntimeTasks()

    popover = queryAdvancedFilterRoot()
    rows = Array.from(popover?.querySelectorAll<HTMLElement>(".datagrid-advanced-filter__row") ?? [])
    expect(rows).toHaveLength(3)

    const thirdComboboxes = rows[2]?.querySelectorAll<HTMLInputElement>('input[role="combobox"]')
    expect(thirdComboboxes?.length).toBe(3)
    await selectComboboxOption(thirdComboboxes![1]!, "Amount", "amo")
    await selectComboboxOption(thirdComboboxes![2]!, ">=", ">")

    const thirdValueInput = rows[2]?.querySelector<HTMLInputElement>('.datagrid-advanced-filter__field--value input[type="text"]')
    expect(thirdValueInput).toBeTruthy()
    thirdValueInput!.value = "10"
    thirdValueInput!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushRuntimeTasks()

    popover?.querySelector<HTMLElement>(".datagrid-advanced-filter__primary")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getState?.()).toMatchObject({
      rows: expect.objectContaining({
        snapshot: expect.objectContaining({
          filterModel: expect.objectContaining({
            advancedExpression: expect.objectContaining({
              kind: "group",
              operator: "and",
            }),
          }),
        }),
      }),
    })

    const reopenedTrigger = await findAdvancedFilterTrigger(wrapper)
    await reopenedTrigger.trigger("click")
    await flushRuntimeTasks()

    popover = queryAdvancedFilterRoot()
    rows = Array.from(popover?.querySelectorAll<HTMLElement>(".datagrid-advanced-filter__row") ?? [])
    expect(rows).toHaveLength(3)

    const readClauseState = (row: HTMLElement) => {
      const comboboxes = row.querySelectorAll<HTMLInputElement>('input[role="combobox"]')
      return {
        join: comboboxes[0]?.value ?? null,
        column: comboboxes[1]?.value ?? null,
        operator: comboboxes[2]?.value ?? null,
        value: row.querySelector<HTMLInputElement>('.datagrid-advanced-filter__field--value input[type="text"]')?.value ?? null,
      }
    }

    expect(readClauseState(rows[0]!)).toEqual({
      join: "AND",
      column: "Owner",
      operator: "Contains",
      value: "NOC",
    })
    expect(readClauseState(rows[1]!)).toEqual({
      join: "OR",
      column: "Region",
      operator: "Equals",
      value: "eu-west",
    })
    expect(readClauseState(rows[2]!)).toEqual({
      join: "AND",
      column: "Amount",
      operator: ">=",
      value: "10",
    })

    wrapper.unmount()
  })

  it("renders applied filter summary and resets all filters from one action", async () => {
    await preloadAdvancedFilterPopover()

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

    const trigger = await findAdvancedFilterTrigger(wrapper)
    expect(trigger.exists()).toBe(true)
    expect(trigger.attributes("data-datagrid-advanced-filter-active")).toBe("true")
    expect(trigger.find('[data-datagrid-advanced-filter-icon="true"]').exists()).toBe(true)
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

    const reopenedTrigger = await findAdvancedFilterTrigger(wrapper)
    await reopenedTrigger!.trigger("click")
    await flushRuntimeTasks()
    expect(queryAdvancedFilterRoot()?.textContent).toContain("No filters applied")
    expect(reopenedTrigger.attributes("data-datagrid-advanced-filter-active")).toBe("false")
    expect(reopenedTrigger.find('[data-datagrid-advanced-filter-icon="true"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it("restores saved views after columns become available and syncs built-in filter UI from runtime state", async () => {
    await preloadAdvancedFilterPopover()

    const source = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
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
            amount: {
              type: "number",
              clauses: [
                {
                  operator: "gte",
                  value: 10,
                },
                {
                  operator: "lte",
                  value: 20,
                  join: "and",
                },
              ],
            },
          },
          advancedExpression: null,
        },
        viewMode: "gantt",
      },
    })

    await flushRuntimeTasks()

    const savedView = resolveVm(source).getSavedView?.()
    expect(savedView).toBeTruthy()

    const controlledColumns = ref<readonly typeof COLUMNS[number][]>([])
    const targetGridRef = ref<{
      applySavedView?: (savedView: DataGridSavedViewSnapshot<Record<string, unknown>>) => boolean
      getView?: () => "table" | "gantt"
      getState?: () => DataGridUnifiedState<Record<string, unknown>> | null
    } | null>(null)

    const target = mount(defineComponent({
      setup() {
        return () => h(DataGrid, {
          ref: targetGridRef,
          rows: BASE_ROWS,
          columns: controlledColumns.value,
          advancedFilter: true,
        })
      },
    }), {
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    expect(targetGridRef.value?.applySavedView?.(savedView as NonNullable<typeof savedView>)).toBe(true)
    expect(targetGridRef.value?.getView?.()).toBe("gantt")

    controlledColumns.value = COLUMNS
    await flushRuntimeTasks()

    expect(targetGridRef.value?.getState?.()).toMatchObject({
      rows: expect.objectContaining({
        snapshot: expect.objectContaining({
          filterModel: expect.objectContaining({
            columnFilters: expect.objectContaining({
              owner: expect.objectContaining({
                operator: "contains",
                value: "NOC",
              }),
            }),
          }),
        }),
      }),
    })

    const trigger = await findAdvancedFilterTrigger(target.findComponent(DataGrid))
    expect(trigger.exists()).toBe(true)
    expect(trigger.attributes("data-datagrid-advanced-filter-active")).toBe("true")

    await trigger.trigger("click")
    await flushRuntimeTasks()

    const advancedFilterRows = Array.from(queryAdvancedFilterRoot()?.querySelectorAll<HTMLElement>(".datagrid-advanced-filter__row") ?? [])
    expect(advancedFilterRows).toHaveLength(4)

    const hydratedValues = advancedFilterRows.map(row => (
      row.querySelector<HTMLInputElement>('.datagrid-advanced-filter__field--value input[type="text"]')?.value ?? null
    ))
    expect(hydratedValues).toEqual(["NOC", "eu-west", "10", "20"])

    source.unmount()
    target.unmount()
  })

  it("exposes typed getApi and getState through useDataGridRef", async () => {
    const gridRef = useDataGridRef<DemoRow>()

    const wrapper = mount(defineComponent({
      setup() {
        return () => h(DataGrid, {
          ref: gridRef,
          rows: BASE_ROWS,
          columns: COLUMNS,
        })
      },
    }))

    await flushRuntimeTasks()

    expect(gridRef.value?.getApi?.()?.rows.get(0)?.data).toMatchObject({
      owner: "NOC",
      region: "eu-west",
      amount: 10,
    })
    expect(gridRef.value?.getState?.()).toMatchObject({
      rows: expect.objectContaining({
        snapshot: expect.objectContaining({
          rowCount: 3,
        }),
      }),
    })

    wrapper.unmount()
  })

  it("supports defineDataGridComponent for typed h-render usage", async () => {
    const TypedDataGrid = defineDataGridComponent<DemoRow>()
    const gridRef = useDataGridRef<DemoRow>()

    const wrapper = mount(defineComponent({
      setup() {
        return () => h(TypedDataGrid, {
          ref: gridRef,
          rows: BASE_ROWS,
          columns: defineDataGridColumns<DemoRow>()([
            { key: "owner", label: "Owner", width: 180 },
            { key: "region", label: "Region", width: 160 },
            { key: "amount", label: "Amount", width: 140 },
          ] as const),
        })
      },
    }))

    await flushRuntimeTasks()

    expect(gridRef.value?.getApi?.()?.rows.get(0)?.data).toMatchObject({
      owner: "NOC",
      region: "eu-west",
      amount: 10,
    })

    wrapper.unmount()
  })

  it("clears the only advanced filter clause instead of blocking removal", async () => {
    await preloadAdvancedFilterPopover()

    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        advancedFilter: true,
      },
    })

    const trigger = await findAdvancedFilterTrigger(wrapper)
    expect(trigger.exists()).toBe(true)
    await trigger!.trigger("click")
    await flushRuntimeTasks()

    const popover = queryAdvancedFilterRoot()
    expect(popover).toBeTruthy()

    const valueInput = popover!.querySelector<HTMLInputElement>('.datagrid-advanced-filter__field--value input[type="text"]')
    expect(valueInput).toBeTruthy()
    valueInput!.value = "NOC"
    valueInput!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushRuntimeTasks()

    const clearButton = Array.from(popover!.querySelectorAll<HTMLButtonElement>("button")).find(candidate => (
      candidate.textContent?.includes("Clear")
    ))
    expect(clearButton).toBeTruthy()
    expect(clearButton?.disabled).toBe(false)

    clearButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    const clearedValueInput = queryAdvancedFilterRoot()?.querySelector<HTMLInputElement>('.datagrid-advanced-filter__field--value input[type="text"]')
    expect(clearedValueInput?.value).toBe("")

    queryAdvancedFilterRoot()?.querySelector<HTMLElement>(".datagrid-advanced-filter__primary")?.dispatchEvent(
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

    const trigger = findToolbarAction(wrapper, "column-layout")
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

  it("reorders columns inside the column layout panel with drag and drop", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnLayout: true,
      },
    })

    await flushRuntimeTasks()

    const trigger = findToolbarAction(wrapper, "column-layout")
    await trigger.trigger("click")
    await flushRuntimeTasks()

    const popover = queryColumnLayoutRoot()
    expect(popover).toBeTruthy()

    const rows = Array.from(popover!.querySelectorAll<HTMLElement>(".datagrid-column-layout__row"))
    const ownerRow = rows.find(row => row.textContent?.includes("Owner"))
    const amountRow = rows.find(row => row.textContent?.includes("Amount"))
    expect(ownerRow).toBeTruthy()
    expect(amountRow).toBeTruthy()

    await dragDropElement(ownerRow!, amountRow!, { targetClientY: 28 })

    popover!.querySelector<HTMLElement>(".datagrid-column-layout__primary")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getColumnSnapshot?.()).toMatchObject({
      order: ["region", "amount", "owner"],
    })

    wrapper.unmount()
  })

  it("lets users drag the column layout panel and reopens it at the detached position", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        columnLayout: true,
      },
    })

    await flushRuntimeTasks()

    const trigger = findToolbarAction(wrapper, "column-layout")
    await trigger.trigger("click")
    await flushRuntimeTasks()

    const initialRoot = queryColumnLayoutRoot()
    expect(initialRoot).toBeTruthy()
    const initialPosition = readOverlayPosition(initialRoot)
    expect(initialPosition).toBeTruthy()

    await dragOverlaySurface(initialRoot!, { x: 64, y: 48 })

    const draggedPosition = readOverlayPosition(queryColumnLayoutRoot())
    expect(draggedPosition).toEqual({
      left: initialPosition!.left + 64,
      top: initialPosition!.top + 48,
    })

    queryColumnLayoutRoot()?.querySelector<HTMLButtonElement>(".datagrid-column-layout__ghost")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushRuntimeTasks()
    expect(queryColumnLayoutRoot()).toBeNull()

    await trigger.trigger("click")
    await flushRuntimeTasks()

    expect(readOverlayPosition(queryColumnLayoutRoot())).toEqual(draggedPosition)

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

    const trigger = findToolbarAction(wrapper, "aggregations")
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

  it("reapplies declarative aggregationModel after owned row-model recreation", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
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

    await wrapper.setProps({
      clientRowModelOptions: {
        resolveRowId: row => (row as DemoRow).rowId,
      },
    })
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getApi?.()?.rows.getAggregationModel?.()).toMatchObject({
      basis: "filtered",
      columns: [{ key: "amount", op: "sum" }],
    })

    wrapper.unmount()
    await flushPromises()

    const consoleMessages = [...consoleError.mock.calls, ...consoleWarn.mock.calls]
      .map(call => call.map(entry => String(entry)).join(" "))

    expect(consoleMessages.some(message => message.includes("ClientRowModel has been disposed"))).toBe(false)
    expect(consoleMessages.some(message => message.includes("Unhandled error during execution of watcher callback"))).toBe(false)

    consoleError.mockRestore()
    consoleWarn.mockRestore()
  })

  it("keeps row focus independent from checkbox row selection", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowSelection: false,
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

  it("toggles all filtered rows from the header row-selection checkbox", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const headerCheckbox = wrapper.find('.grid-header-shell .grid-checkbox-trigger[aria-label="Select all filtered rows"]')
    expect(headerCheckbox.exists()).toBe(true)
    expect(headerCheckbox.attributes("role")).toBe("checkbox")
    expect(headerCheckbox.attributes("aria-checked")).toBe("false")

    await headerCheckbox.trigger("click")
    await flushRuntimeTasks()

    expect(headerCheckbox.attributes("aria-checked")).toBe("true")
    expect(resolveVm(wrapper).getApi?.()?.rowSelection.getSnapshot?.()).toEqual({
      focusedRow: null,
      selectedRows: ["r1", "r2", "r3"],
    })

    await headerCheckbox.trigger("click")
    await flushRuntimeTasks()

    expect(headerCheckbox.attributes("aria-checked")).toBe("false")
    expect(resolveVm(wrapper).getApi?.()?.rowSelection.getSnapshot?.()).toBeNull()

    wrapper.unmount()
  })

  it("propagates row-select and unified state updates after header bulk row selection", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const initialStateUpdateCount = (wrapper.emitted("update:state") ?? []).length
    const initialRowSelectCount = (wrapper.emitted("row-select") ?? []).length
    const headerCheckbox = wrapper.find('.grid-header-shell .grid-checkbox-trigger[aria-label="Select all filtered rows"]')

    expect(headerCheckbox.exists()).toBe(true)
    expect(headerCheckbox.attributes("aria-checked")).toBe("false")

    await headerCheckbox.trigger("click")
    await flushRuntimeTasks()

    expect(headerCheckbox.attributes("aria-checked")).toBe("true")

    const rowSelectEvents = wrapper.emitted("row-select") ?? []
    expect(rowSelectEvents.length).toBeGreaterThan(initialRowSelectCount)
    expect(rowSelectEvents.at(-1)?.[0]).toEqual({
      focusedRow: null,
      selectedRows: ["r1", "r2", "r3"],
    })

    const rowSelectionChangeEvents = wrapper.emitted("row-selection-change") ?? []
    expect(rowSelectionChangeEvents.at(-1)?.[0]).toEqual({
      snapshot: {
        focusedRow: null,
        selectedRows: ["r1", "r2", "r3"],
      },
    })

    const stateUpdates = wrapper.emitted("update:state") ?? []
    expect(stateUpdates.length).toBeGreaterThan(initialStateUpdateCount)
    expect(stateUpdates.at(-1)?.[0]).toMatchObject({
      rowSelection: {
        focusedRow: null,
        selectedRows: ["r1", "r2", "r3"],
      },
    })

    wrapper.unmount()
  })

  it("preserves controlled row selection across header bulk toggle and rows churn with stable row ids", async () => {
    const controlledRows = ref<DemoRow[]>(BASE_ROWS.map(row => ({ ...row })))
    const controlledState = ref<DataGridUnifiedState<Record<string, unknown>> | null>(null)
    const rowSelectEvents: Array<DataGridRowSelectionSnapshot | null> = []

    const wrapper = mount(defineComponent({
      setup() {
        return () => h(DataGrid, {
          rows: controlledRows.value,
          columns: COLUMNS,
          rowSelection: true,
          state: controlledState.value,
          "onUpdate:state": (nextState: DataGridUnifiedState<Record<string, unknown>> | null) => {
            controlledState.value = nextState
          },
          onRowSelect: (snapshot: DataGridRowSelectionSnapshot | null) => {
            rowSelectEvents.push(snapshot)
          },
        })
      },
    }), {
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const headerCheckbox = wrapper.find('.grid-header-shell .grid-checkbox-trigger[aria-label="Select all filtered rows"]')
    expect(headerCheckbox.exists()).toBe(true)
    expect(headerCheckbox.attributes("aria-checked")).toBe("false")

    await headerCheckbox.trigger("click")
    await flushRuntimeTasks()

    expect(rowSelectEvents.at(-1)).toEqual({
      focusedRow: null,
      selectedRows: ["r1", "r2", "r3"],
    })
    expect(controlledState.value).toMatchObject({
      rowSelection: {
        focusedRow: null,
        selectedRows: ["r1", "r2", "r3"],
      },
    })
    expect(headerCheckbox.attributes("aria-checked")).toBe("true")

    controlledRows.value = controlledRows.value.map(row => ({
      ...row,
      amount: row.amount + 100,
    }))
    await nextTick()
    await flushRuntimeTasks()

    const refreshedHeaderCheckbox = wrapper.find('.grid-header-shell .grid-checkbox-trigger[aria-label="Select all filtered rows"]')
    expect(refreshedHeaderCheckbox.attributes("aria-checked")).toBe("true")
    expect(controlledState.value).toMatchObject({
      rowSelection: {
        focusedRow: null,
        selectedRows: ["r1", "r2", "r3"],
      },
    })

    wrapper.unmount()
  })

  it("supports a controlled rowSelectionState contract alongside the legacy row-select event", async () => {
    const controlledRowSelection = ref<DataGridRowSelectionSnapshot | null>({
      focusedRow: "r2",
      selectedRows: ["r2"],
    })
    const rowSelectEvents: Array<DataGridRowSelectionSnapshot | null> = []

    const wrapper = mount(defineComponent({
      setup() {
        return () => h(DataGrid, {
          rows: BASE_ROWS,
          columns: COLUMNS,
          rowSelection: true,
          rowSelectionState: controlledRowSelection.value,
          "onUpdate:rowSelectionState": (nextState: DataGridRowSelectionSnapshot | null) => {
            controlledRowSelection.value = nextState
          },
          onRowSelect: (snapshot: DataGridRowSelectionSnapshot | null) => {
            rowSelectEvents.push(snapshot)
          },
        })
      },
    }), {
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    let leftPaneRows = wrapper.findAll(".grid-body-pane--left .grid-row")
    expect(leftPaneRows[1]?.find('.grid-cell--row-selection[role="checkbox"]').attributes("aria-checked")).toBe("true")
    expect(leftPaneRows[0]?.find('.grid-cell--row-selection[role="checkbox"]').attributes("aria-checked")).toBe("false")

    controlledRowSelection.value = {
      focusedRow: null,
      selectedRows: ["r1", "r3"],
    }
    await flushRuntimeTasks()

    leftPaneRows = wrapper.findAll(".grid-body-pane--left .grid-row")
    expect(leftPaneRows[0]?.find('.grid-cell--row-selection[role="checkbox"]').attributes("aria-checked")).toBe("true")
    expect(leftPaneRows[1]?.find('.grid-cell--row-selection[role="checkbox"]').attributes("aria-checked")).toBe("false")
    expect(leftPaneRows[2]?.find('.grid-cell--row-selection[role="checkbox"]').attributes("aria-checked")).toBe("true")

    const headerCheckbox = wrapper.find('.grid-header-shell .grid-checkbox-trigger[aria-label="Select all filtered rows"]')
    await headerCheckbox.trigger("click")
    await flushRuntimeTasks()

    expect(controlledRowSelection.value?.focusedRow).toBeNull()
    expect([...(controlledRowSelection.value?.selectedRows ?? [])].sort()).toEqual(["r1", "r2", "r3"])
    expect(rowSelectEvents.at(-1)?.focusedRow).toBeNull()
    expect([...(rowSelectEvents.at(-1)?.selectedRows ?? [])].sort()).toEqual(["r1", "r2", "r3"])

    wrapper.unmount()
  })

  it("marks row-index multi-row selections as contiguous top middle bottom segments", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
      },
    })

    await flushRuntimeTasks()

    resolveVm(wrapper).getApi?.()?.selection?.setSnapshot?.({
      ranges: [
        {
          startRow: 0,
          endRow: 2,
          startCol: 0,
          endCol: 999,
          startRowId: "r1",
          endRowId: "r3",
          anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
          focus: { rowIndex: 2, colIndex: 2, rowId: "r3" },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 2, colIndex: 2, rowId: "r3" },
    })
    await flushRuntimeTasks()

    const firstRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    const secondRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r2"]')
    const thirdRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r3"]')

    expect(firstRowIndexCell.classes()).toContain("grid-cell--index-selected")
    expect(firstRowIndexCell.classes()).toContain("grid-cell--index-selected-top")
    expect(secondRowIndexCell.classes()).toContain("grid-cell--index-selected")
    expect(secondRowIndexCell.classes()).toContain("grid-cell--index-selected-middle")
    expect(thirdRowIndexCell.classes()).toContain("grid-cell--index-selected")
    expect(thirdRowIndexCell.classes()).toContain("grid-cell--index-selected-bottom")

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

  it("uses readSelectionCell for aggregate labels and selection summary, and recomputes after edits inside the selection", async () => {
    const rows: readonly EffectiveSelectionRow[] = [
      { rowId: "fx1", formula: "=10+20", effectiveAmount: 30 },
      { rowId: "fx2", formula: "=5+15", effectiveAmount: 20 },
    ]
    const columns = [
      { key: "formula", label: "Formula", width: 180 },
    ] as const

    const wrapper = mount(EffectiveSelectionGrid, {
      attachTo: document.body,
      props: {
        rows,
        columns,
        rowSelection: false,
        readSelectionCell: defineDataGridSelectionCellReader<EffectiveSelectionRow>()((row, columnKey) => {
          if (columnKey !== "formula") {
            return undefined
          }
          return (row.data as EffectiveSelectionRow).effectiveAmount
        }),
      },
    })

    await flushRuntimeTasks()

    const vm = resolveVm(wrapper) as ReturnType<typeof resolveVm> & {
      getSelectionSummary?: () => unknown
      getApi?: () => unknown
    }
    const api = vm.getApi?.() as {
      selection?: { setSnapshot?: (snapshot: unknown) => void }
      rows?: { applyEdits?: (updates: unknown[]) => void }
    } | null

    api?.selection?.setSnapshot?.({
      ranges: [
        {
          startRow: 0,
          endRow: 1,
          startCol: 0,
          endCol: 0,
          startRowId: "fx1",
          endRowId: "fx2",
          anchor: { rowIndex: 0, colIndex: 0, rowId: "fx1" },
          focus: { rowIndex: 1, colIndex: 0, rowId: "fx2" },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: "fx2" },
    })

    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getSelectionAggregatesLabel?.()).toBe(
      "Selection: count 2 · sum 50 · min 20 · max 30 · avg 25",
    )
    expect(vm.getSelectionSummary?.()).toMatchObject({
      selectedCells: 2,
      columns: {
        formula: {
          metrics: {
            sum: 50,
            min: 20,
            max: 30,
            avg: 25,
          },
        },
      },
    })

    api?.rows?.applyEdits?.([
      {
        rowId: "fx2",
        data: {
          effectiveAmount: 40,
        },
      },
    ])

    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getSelectionAggregatesLabel?.()).toBe(
      "Selection: count 2 · sum 70 · min 30 · max 40 · avg 35",
    )
    expect(vm.getSelectionSummary?.()).toMatchObject({
      selectedCells: 2,
      columns: {
        formula: {
          metrics: {
            sum: 70,
            min: 30,
            max: 40,
            avg: 35,
          },
        },
      },
    })

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

  it("uses Enter to move vertically without opening a focused select cell", async () => {
    const selectNavigationRows = [
      { rowId: "s1", stage: "backlog" },
      { rowId: "s2", stage: "planned" },
    ] as const

    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: selectNavigationRows,
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

    expect(wrapper.find(".datagrid-cell-combobox__input").exists()).toBe(false)
    expect(queryBodyCell(wrapper, 1, 0).classes()).toContain("grid-cell--selection-anchor")

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
    expect(updatedRow).toBeTruthy()
    if (!updatedRow) {
      throw new Error("Expected updated date row")
    }
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
    expect(updatedRow).toBeTruthy()
    if (!updatedRow) {
      throw new Error("Expected updated datetime row")
    }
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

    await cell.trigger("keydown", { key: "r" })
    await flushRuntimeTasks()

    const editor = wrapper.find<HTMLInputElement>(".datagrid-cell-combobox__input")
    expect(editor.exists()).toBe(true)
    expect(asyncOptions).toHaveBeenCalled()
    expect((editor.element as HTMLInputElement).value).toBe("r")

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
            region: "none",
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
        state: state as DataGridUnifiedState<Record<string, unknown>>,
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

    const migrated = resolveVm(target).migrateSavedView?.(savedView as DataGridSavedViewSnapshot<Record<string, unknown>>)
    expect(migrated).toBeTruthy()
    expect(resolveVm(target).applySavedView?.(migrated as DataGridSavedViewSnapshot<Record<string, unknown>>)).toBe(true)
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

    const serialized = serializeDataGridSavedView(savedView as DataGridSavedViewSnapshot<Record<string, unknown>>)
    expect(parseDataGridSavedView(serialized, value => resolveVm(source).migrateState?.(value) ?? null)).toMatchObject({
      viewMode: "gantt",
    })
    expect(writeDataGridSavedViewToStorage(storage, "demo", savedView as DataGridSavedViewSnapshot<Record<string, unknown>>)).toBe(true)

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

  it("sanitizes transient transaction snapshots out of saved views", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const currentState = resolveVm(wrapper).getState?.()
    expect(currentState).toBeTruthy()
    if (!currentState) {
      throw new Error("Expected current grid state")
    }

    const migrated = resolveVm(wrapper).migrateSavedView?.({
      state: {
        ...currentState,
        transaction: {
          undoDepth: 2,
          redoDepth: 1,
          pendingBatch: null,
        },
      },
      viewMode: "table",
    })

    expect(migrated).toMatchObject({
      viewMode: "table",
      state: expect.objectContaining({
        transaction: null,
      }),
    })

    const serialized = serializeDataGridSavedView(migrated as DataGridSavedViewSnapshot<Record<string, unknown>>)
    expect(JSON.parse(serialized)).toMatchObject({
      state: expect.objectContaining({
        transaction: null,
      }),
    })

    wrapper.unmount()
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

  it("forwards typed row-selection-change events from the runtime host", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
      },
    })

    await flushRuntimeTasks()

    const runtimeHost = wrapper.findComponent(DataGridRuntimeHost)

    runtimeHost.vm.$emit("row-selection-change", {
      snapshot: {
        focusedRow: "r2",
        selectedRows: ["r1", "r2"],
      },
    })

    await flushRuntimeTasks()

    expect((wrapper.emitted("row-selection-change") ?? []).at(-1)?.[0]).toEqual({
      snapshot: {
        focusedRow: "r2",
        selectedRows: ["r1", "r2"],
      },
    })

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
          resolveRowId: row => (row as FormulaRow).id,
        },
      },
    })

    await flushRuntimeTasks()

    const rowModel = resolveRowModel(wrapper) as {
      getRow?: (index: number) => { row?: FormulaRow } | undefined
      getFormulaFields?: () => ReadonlyArray<{ name: string }>
    } | null

    expect(rowModel?.getFormulaFields?.()).toEqual([
      expect.objectContaining({ name: "subtotal" }),
    ])
    expect(rowModel?.getRow?.(0)?.row).toMatchObject({
      subtotal: 36,
    })

    wrapper.unmount()
  })

  it("applies advanced-filter predicates to declarative formula columns", async () => {
    await preloadAdvancedFilterPopover()

    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: FORMULA_ROWS,
        columns: FORMULA_COLUMNS.map(column => (
          column.key === "subtotal"
            ? { ...column, formula: "price * qty" }
            : column
        )),
        clientRowModelOptions: {
          resolveRowId: row => (row as FormulaRow).id,
        },
        advancedFilter: true,
      },
    })

    const selectComboboxOption = async (
      input: HTMLInputElement,
      optionLabel: string,
      query: string = optionLabel,
    ): Promise<void> => {
      input.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      input.value = query
      input.dispatchEvent(new Event("input", { bubbles: true }))
      await flushRuntimeTasks()

      const option = [...document.body.querySelectorAll<HTMLButtonElement>(".datagrid-cell-combobox__option")].find(candidate => (
        candidate.textContent?.includes(optionLabel)
      ))
      expect(option).toBeTruthy()
      option?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      await flushRuntimeTasks()
    }

    const trigger = await findAdvancedFilterTrigger(wrapper)
    expect(trigger.exists()).toBe(true)
    await trigger.trigger("click")
    await flushRuntimeTasks()

    const popover = queryAdvancedFilterRoot()
    expect(popover).toBeTruthy()

    const row = popover?.querySelector<HTMLElement>(".datagrid-advanced-filter__row") ?? null
    expect(row).toBeTruthy()

    const comboboxes = row?.querySelectorAll<HTMLInputElement>('input[role="combobox"]') ?? []
    expect(comboboxes.length).toBeGreaterThanOrEqual(3)
    await selectComboboxOption(comboboxes[1]!, "Subtotal", "sub")
    await selectComboboxOption(comboboxes[2]!, ">", ">")

    const valueInput = row?.querySelector<HTMLInputElement>('.datagrid-advanced-filter__field--value input[type="text"]')
    expect(valueInput).toBeTruthy()
    valueInput!.value = "20"
    valueInput!.dispatchEvent(new Event("input", { bubbles: true }))

    popover?.querySelector<HTMLElement>(".datagrid-advanced-filter__primary")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushRuntimeTasks()

    expect(resolveVm(wrapper).getState?.()).toMatchObject({
      rows: expect.objectContaining({
        snapshot: expect.objectContaining({
          filterModel: expect.objectContaining({
            advancedExpression: expect.objectContaining({
              key: "subtotal",
              kind: "condition",
              operator: "gt",
              type: "number",
              value: 20,
            }),
          }),
          rowCount: 1,
        }),
      }),
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

  it("applies declarative grid line presets to layout chrome vars", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        gridLines: "rows",
        theme: "sugar",
      },
    })

    await flushRuntimeTasks()

    const rootElement = wrapper.find(".affino-datagrid-app-root")
    const layoutElement = wrapper.find(".datagrid-app-layout").element as HTMLElement

    expect(rootElement.classes()).toContain("affino-datagrid-app-root--theme-sugar")
    expect(layoutElement.style.getPropertyValue("--datagrid-row-divider-size")).toBe("1px")
    expect(layoutElement.style.getPropertyValue("--datagrid-column-divider-size")).toBe("0px")
    expect(layoutElement.style.getPropertyValue("--datagrid-header-column-divider-size")).toBe("0px")
    expect(layoutElement.style.getPropertyValue("--datagrid-pinned-pane-separator-size")).toBe("2px")

    wrapper.unmount()
  })

  it("supports auto-height layout mode with row-based body sizing", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        layoutMode: "auto-height",
        maxRows: 2,
        baseRowHeight: 31,
      },
    })

    await flushRuntimeTasks()

    expect(wrapper.find(".affino-datagrid-app-root").classes()).toContain("affino-datagrid-app-root--auto-height")
    expect(wrapper.find(".datagrid-app-layout").classes()).toContain("datagrid-app-layout--auto-height")
    expect(wrapper.find(".grid-stage").classes()).toContain("grid-stage--layout-auto-height")
    expect(wrapper.find(".grid-body-shell:not(.grid-body-shell--pinned-bottom)").attributes("style")).toContain("height: 62px")

    wrapper.unmount()
  })

  it("respects auto-height minRows when the body has fewer rows", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: BASE_ROWS.slice(0, 2),
        columns: COLUMNS,
        layoutMode: "auto-height",
        minRows: 4,
        baseRowHeight: 31,
      },
    })

    await flushRuntimeTasks()

    expect(wrapper.find(".grid-body-shell:not(.grid-body-shell--pinned-bottom)").attributes("style")).toContain("height: 124px")

    wrapper.unmount()
  })

  it("renders placeholderRows as visual tail without materializing them into the row model", async () => {
    let nextRowId = 2
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 1),
        columns: EDITABLE_COLUMNS,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 2,
          createRowAt: () => ({
            rowId: `ph-${nextRowId++}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(1)
    expect(queryBodyCell(wrapper, 1, 0).exists()).toBe(true)
    expect(queryBodyCell(wrapper, 2, 0).exists()).toBe(true)
    expect(queryBodyCell(wrapper, 1, 0).text()).toBe("")

    wrapper.unmount()
  })

  it("exposes placeholder surface metadata to authored cell renderers", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 1),
        columns: [
          {
            key: "owner",
            label: "Owner",
            width: 180,
            capabilities: { editable: true },
            cellRenderer: ({ displayValue, surface }: DataGridAppCellRendererContext<Record<string, unknown>>) => h("span", {
              class: `test-surface-${surface.kind}`,
            }, surface.kind === "placeholder" ? "placeholder-row" : displayValue),
          },
          { key: "region", label: "Region", width: 160 },
          { key: "amount", label: "Amount", width: 140 },
        ] as unknown as readonly typeof EDITABLE_COLUMNS[number][],
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 1,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    expect(queryBodyCell(wrapper, 0, 0).text()).toBe("NOC")
    expect(queryBodyCell(wrapper, 1, 0).text()).toBe("placeholder-row")
    expect(wrapper.findAll(".test-surface-real")).toHaveLength(1)
    expect(wrapper.findAll(".test-surface-placeholder")).toHaveLength(1)

    wrapper.unmount()
  })

  it("materializes a placeholder row on first inline edit", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 1),
        columns: EDITABLE_COLUMNS,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 1,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(1)

    const placeholderCell = queryBodyCell(wrapper, 1, 0)
    await placeholderCell.trigger("dblclick")
    await flushRuntimeTasks()

    const editor = wrapper.find(".cell-editor-input")
    expect(editor.exists()).toBe(true)

    await editor.setValue("Created row")
    await editor.trigger("blur")
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(2)
    expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 1)).toMatchObject({
      rowId: "ph-1",
      owner: "Created row",
    })

    wrapper.unmount()
  })

  it("undoes placeholder materialization back to visual tail state", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 1),
        columns: EDITABLE_COLUMNS,
        renderMode: "pagination",
        layoutMode: "auto-height",
        history: true,
        placeholderRows: {
          count: 1,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    await queryBodyCell(wrapper, 1, 0).trigger("dblclick")
    await flushRuntimeTasks()

    const editor = wrapper.find(".cell-editor-input")
    await editor.setValue("Undo me")
    await editor.trigger("blur")
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(2)

    await resolveVm(wrapper).history?.runHistoryAction?.("undo")
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(1)
    expect(queryBodyCell(wrapper, 1, 0).exists()).toBe(true)
    expect(queryBodyCell(wrapper, 1, 0).text()).toBe("")

    wrapper.unmount()
  })

  it("materializes intermediate placeholder rows when editing a deeper placeholder row", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: [],
        columns: EDITABLE_COLUMNS,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 3,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(0)

    const placeholderCell = queryBodyCell(wrapper, 2, 0)
    expect(placeholderCell.exists()).toBe(true)

    await placeholderCell.trigger("dblclick")
    await flushRuntimeTasks()

    const editor = wrapper.find(".cell-editor-input")
    expect(editor.exists()).toBe(true)

    await editor.setValue("Deep placeholder")
    await editor.trigger("blur")
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(3)
    expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 0)).toMatchObject({
      rowId: "ph-0",
      owner: "",
    })
    expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 1)).toMatchObject({
      rowId: "ph-1",
      owner: "",
    })
    expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 2)).toMatchObject({
      rowId: "ph-2",
      owner: "Deep placeholder",
    })

    wrapper.unmount()
  })

  it("materializes placeholder rows when pasting into an empty grid", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: [],
        columns: EDITABLE_COLUMNS,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 2,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    const originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn<(_: string) => Promise<void>>().mockResolvedValue(undefined),
        readText: vi.fn<() => Promise<string>>().mockResolvedValue("Alpha\teu-west\t101\nBeta\tus-east\t202"),
      },
    })

    try {
      await flushRuntimeTasks()

      const firstPlaceholderCell = queryBodyCell(wrapper, 0, 0)
      expect(firstPlaceholderCell.exists()).toBe(true)

      await firstPlaceholderCell.trigger("click")
      await flushRuntimeTasks()

      await firstPlaceholderCell.trigger("keydown", { key: "v", ctrlKey: true })
      await flushRuntimeTasks()

      expect(resolveApiRowCount(wrapper)).toBe(2)
      expect(resolveRowAt<{ rowId: string; owner: string; region: string; amount: number | string }>(wrapper, 0)).toMatchObject({
        rowId: "ph-0",
        owner: "Alpha",
        region: "eu-west",
        amount: "101",
      })
      expect(resolveRowAt<{ rowId: string; owner: string; region: string; amount: number | string }>(wrapper, 1)).toMatchObject({
        rowId: "ph-1",
        owner: "Beta",
        region: "us-east",
        amount: "202",
      })
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard,
      })
    }

    wrapper.unmount()
  })

  it("moves a selected cell into an empty placeholder row with drag move", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 1),
        columns: EDITABLE_COLUMNS,
        renderMode: "pagination",
        layoutMode: "auto-height",
        rangeMove: true,
        placeholderRows: {
          count: 1,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()
    setGridBodyShellGeometry(wrapper)

    const sourceCell = queryBodyCell(wrapper, 0, 0)
    await sourceCell.trigger("mousedown", {
      button: 0,
      clientX: 270,
      clientY: 16,
    })
    window.dispatchEvent(new MouseEvent("mouseup", {
      bubbles: true,
      button: 0,
      clientX: 270,
      clientY: 16,
    }))
    await flushRuntimeTasks()

    await dragMoveSelectedBodyCell(wrapper, {
      rowIndex: 0,
      columnIndex: 0,
      clientX: 270,
      clientY: 16,
    }, {
      clientX: 270,
      clientY: 48,
    })

    expect(resolveApiRowCount(wrapper)).toBe(2)
    expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 0)).toMatchObject({
      rowId: "r1",
      owner: "",
    })
    expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 1)).toMatchObject({
      rowId: "ph-1",
      owner: "NOC",
    })
    expect(queryBodyCell(wrapper, 0, 0).text()).toBe("")
    expect(queryBodyCell(wrapper, 1, 0).text()).toBe("NOC")

    wrapper.unmount()
  })

  it("materializes a placeholder row on checkbox toggle even when the grid starts empty", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: [],
        columns: CHECKBOX_COLUMNS,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 1,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            approved: false,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(0)

    const cell = wrapper.find('.grid-body-viewport .grid-cell--checkbox[role="checkbox"]')
    expect(cell.exists()).toBe(true)

    await cell.trigger("click")
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(1)
    expect(resolveRowAt<{ rowId: string; approved: boolean }>(wrapper, 0)).toMatchObject({
      rowId: "ph-0",
      approved: true,
    })

    wrapper.unmount()
  })

  it("navigates into the placeholder tail on Enter without materializing a row", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 1),
        columns: EDITABLE_COLUMNS,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 1,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    const cell = queryBodyCell(wrapper, 0, 0)
    expect(cell.exists()).toBe(true)

    await cell.trigger("click")
    await flushRuntimeTasks()

    await cell.trigger("keydown", { key: "Enter" })
    await flushRuntimeTasks()

    expect(wrapper.find(".cell-editor-input").exists()).toBe(false)
    expect(resolveApiRowCount(wrapper)).toBe(1)
    expect(queryBodyCell(wrapper, 1, 0).classes()).toContain("grid-cell--selection-anchor")
    expect(queryBodyCell(wrapper, 1, 0).text()).toBe("")

    wrapper.unmount()
  })

  it("inserts above a placeholder row from rowIndexMenu and disables unsupported placeholder row actions", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 1),
        columns: EDITABLE_COLUMNS,
        rowIndexMenu: true,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 2,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(1)

    const placeholderRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="__datagrid_placeholder__:1"]')
    expect(placeholderRowIndexCell.exists()).toBe(true)

    await placeholderRowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 56 })
    await flushRuntimeTasks()

    expect(queryContextMenuAction("insert-row-above")?.hasAttribute("disabled")).toBe(false)
    expect(queryContextMenuAction("copy-row")?.hasAttribute("disabled")).toBe(true)
    expect(queryContextMenuAction("cut-row")?.hasAttribute("disabled")).toBe(true)
    expect(queryContextMenuAction("paste-row")?.hasAttribute("disabled")).toBe(false)
    expect(queryContextMenuAction("delete-selected-rows")?.hasAttribute("disabled")).toBe(true)

    queryContextMenuAction("insert-row-above")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(2)
    expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 1)).toMatchObject({
      rowId: "ph-1",
      owner: "",
    })

    wrapper.unmount()
  })

  it("records mixed real-plus-placeholder row-index deletes as real-row history only", async () => {
    const recordIntentTransaction = vi.fn()
    const historyAdapter: DataGridTableStageHistoryAdapter = {
      captureSnapshot: () => ({ token: "delete-placeholder-range" }),
      recordIntentTransaction,
      canUndo: () => false,
      canRedo: () => false,
      runHistoryAction: async () => null,
    }

    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 2),
        columns: COLUMNS,
        rowIndexMenu: true,
        history: {
          adapter: historyAdapter,
          shortcuts: false,
        },
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 2,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      selection?: {
        setSnapshot?: (snapshot: unknown) => void
      }
      rows: {
        get: (index: number) => { rowId?: string } | undefined
      }
    } | null

    api?.selection?.setSnapshot?.({
      ranges: [{
        startRow: 1,
        endRow: 3,
        startCol: 0,
        endCol: COLUMNS.length - 1,
        anchor: { rowIndex: 1, colIndex: 0, rowId: "r2" },
        focus: { rowIndex: 3, colIndex: 0, rowId: "__datagrid_placeholder__:3" },
        startRowId: "r2",
        endRowId: "__datagrid_placeholder__:3",
      }],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 3, colIndex: 0, rowId: "__datagrid_placeholder__:3" },
    })
    await flushRuntimeTasks()

    const secondRealRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r2"]')
    expect(secondRealRowIndexCell.exists()).toBe(true)

    await secondRealRowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 42 })
    await flushRuntimeTasks()

    queryContextMenuAction("delete-selected-rows")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(1)
    expect(api?.rows.get(0)?.rowId).toBe("r1")
    expect(recordIntentTransaction).toHaveBeenCalledTimes(1)
    expect(recordIntentTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Delete row" }),
      expect.objectContaining({ token: "delete-placeholder-range" }),
    )

    wrapper.unmount()
  })

  it("enables placeholder row-index selection delete when the active range includes real rows", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 2),
        columns: COLUMNS,
        rowIndexMenu: true,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 2,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      selection?: {
        setSnapshot?: (snapshot: unknown) => void
      }
      rows: {
        get: (index: number) => { rowId?: string } | undefined
      }
    } | null

    api?.selection?.setSnapshot?.({
      ranges: [{
        startRow: 1,
        endRow: 3,
        startCol: 0,
        endCol: COLUMNS.length - 1,
        anchor: { rowIndex: 1, colIndex: 0, rowId: "r2" },
        focus: { rowIndex: 3, colIndex: 0, rowId: "__datagrid_placeholder__:3" },
        startRowId: "r2",
        endRowId: "__datagrid_placeholder__:3",
      }],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 3, colIndex: 0, rowId: "__datagrid_placeholder__:3" },
    })
    await flushRuntimeTasks()

    const placeholderRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="__datagrid_placeholder__:3"]')
    expect(placeholderRowIndexCell.exists()).toBe(true)

    await placeholderRowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 72 })
    await flushRuntimeTasks()

    expect(queryContextMenuAction("delete-selected-rows")?.disabled).toBe(false)

    queryContextMenuAction("delete-selected-rows")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(1)
    expect(api?.rows.get(0)?.rowId).toBe("r1")

    wrapper.unmount()
  })

  it("supports Delete on a placeholder row index when the active range includes real rows", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 2),
        columns: COLUMNS,
        rowIndexMenu: true,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 2,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      selection?: {
        setSnapshot?: (snapshot: unknown) => void
      }
      rows: {
        get: (index: number) => { rowId?: string } | undefined
      }
    } | null

    api?.selection?.setSnapshot?.({
      ranges: [{
        startRow: 1,
        endRow: 3,
        startCol: 0,
        endCol: COLUMNS.length - 1,
        anchor: { rowIndex: 1, colIndex: 0, rowId: "r2" },
        focus: { rowIndex: 3, colIndex: 0, rowId: "__datagrid_placeholder__:3" },
        startRowId: "r2",
        endRowId: "__datagrid_placeholder__:3",
      }],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 3, colIndex: 0, rowId: "__datagrid_placeholder__:3" },
    })
    await flushRuntimeTasks()

    const placeholderRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="__datagrid_placeholder__:3"]')
    expect(placeholderRowIndexCell.exists()).toBe(true)

    ;(placeholderRowIndexCell.element as HTMLElement).focus()
    await placeholderRowIndexCell.trigger("keydown", { key: "Delete" })
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(1)
    expect(api?.rows.get(0)?.rowId).toBe("r1")

    wrapper.unmount()
  })

  it("supports Insert and Ctrl+I on a placeholder row index", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 1),
        columns: EDITABLE_COLUMNS,
        rowIndexMenu: true,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 2,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    const firstPlaceholderRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="__datagrid_placeholder__:1"]')
    expect(firstPlaceholderRowIndexCell.exists()).toBe(true)

    await firstPlaceholderRowIndexCell.trigger("click")
    ;(firstPlaceholderRowIndexCell.element as HTMLElement).focus()
    await firstPlaceholderRowIndexCell.trigger("keydown", { key: "i", ctrlKey: true })
    await flushRuntimeTasks()
    await flushAnimationFrame()
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(2)
    expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 1)).toMatchObject({
      rowId: "ph-1",
      owner: "",
    })
    expect(document.activeElement?.classList.contains("datagrid-stage__row-index-cell")).toBe(true)

    const nextPlaceholderRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="__datagrid_placeholder__:2"]')
    expect(nextPlaceholderRowIndexCell.exists()).toBe(true)

    await nextPlaceholderRowIndexCell.trigger("click")
    ;(nextPlaceholderRowIndexCell.element as HTMLElement).focus()
    await nextPlaceholderRowIndexCell.trigger("keydown", { key: "Insert" })
    await flushRuntimeTasks()
    await flushAnimationFrame()
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(3)
    expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 2)).toMatchObject({
      rowId: "ph-2",
      owner: "",
    })

    wrapper.unmount()
  })

  it("opens the placeholder row index menu from the keyboard and keeps unsupported actions disabled", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 1),
        columns: EDITABLE_COLUMNS,
        rowIndexMenu: true,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 1,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    const placeholderRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="__datagrid_placeholder__:1"]')
    expect(placeholderRowIndexCell.exists()).toBe(true)

    await placeholderRowIndexCell.trigger("click")
    await placeholderRowIndexCell.trigger("keydown", { key: "F10", shiftKey: true })
    await flushRuntimeTasks()

    expect(queryContextMenuRoot()).toBeTruthy()
    expect(queryContextMenuAction("insert-row-above")?.disabled).toBe(false)
    expect(queryContextMenuAction("copy-row")?.disabled).toBe(true)
    expect(queryContextMenuAction("cut-row")?.disabled).toBe(true)
    expect(queryContextMenuAction("paste-row")?.disabled).toBe(false)
    expect(queryContextMenuAction("delete-selected-rows")?.disabled).toBe(true)

    queryContextMenuRoot()?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    await flushRuntimeTasks()

    await placeholderRowIndexCell.trigger("click")
    await placeholderRowIndexCell.trigger("keydown", { key: "ContextMenu" })
    await flushRuntimeTasks()

    expect(queryContextMenuRoot()).toBeTruthy()
    expect(queryContextMenuAction("insert-row-above")?.disabled).toBe(false)
    expect(queryContextMenuAction("copy-row")?.disabled).toBe(true)
    expect(queryContextMenuAction("paste-row")?.disabled).toBe(false)

    wrapper.unmount()
  })

  it("pastes a copied row below a placeholder row from rowIndexMenu", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 1),
        columns: COLUMNS,
        rowIndexMenu: true,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 2,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    const realRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    expect(realRowIndexCell.exists()).toBe(true)

    await realRowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 42 })
    await flushRuntimeTasks()

    queryContextMenuAction("copy-row")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    const placeholderRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="__datagrid_placeholder__:1"]')
    expect(placeholderRowIndexCell.exists()).toBe(true)

    await placeholderRowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 56 })
    await flushRuntimeTasks()

    queryContextMenuAction("paste-row")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(3)
    expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 1)).toMatchObject({
      rowId: "ph-1",
      owner: "",
    })
    expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 2)).toMatchObject({
      owner: "NOC",
    })

    wrapper.unmount()
  })

  it("supports Ctrl+V on a placeholder row index after copying a real row", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 1),
        columns: COLUMNS,
        rowIndexMenu: true,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 2,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    const realRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    expect(realRowIndexCell.exists()).toBe(true)

    await realRowIndexCell.trigger("click")
    await realRowIndexCell.trigger("keydown", { key: "c", ctrlKey: true })
    await flushRuntimeTasks()

    const placeholderRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="__datagrid_placeholder__:1"]')
    expect(placeholderRowIndexCell.exists()).toBe(true)

    await placeholderRowIndexCell.trigger("click")
    await placeholderRowIndexCell.trigger("keydown", { key: "v", ctrlKey: true })
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(3)
    expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 1)).toMatchObject({
      rowId: "ph-1",
      owner: "",
    })
    expect(resolveRowAt<{ owner: string }>(wrapper, 2)).toMatchObject({
      owner: "NOC",
    })
    expect(document.activeElement?.classList.contains("datagrid-stage__row-index-cell")).toBe(true)

    wrapper.unmount()
  })

  it("pastes the current row-index copy selection below a placeholder row from rowIndexMenu", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 2),
        columns: COLUMNS,
        rowIndexMenu: true,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 2,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      selection?: {
        setSnapshot?: (snapshot: unknown) => void
      }
    } | null

    api?.selection?.setSnapshot?.({
      ranges: [{
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: COLUMNS.length - 1,
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 1, colIndex: 0, rowId: "r2" },
        startRowId: "r1",
        endRowId: "r2",
      }],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: "r2" },
    })
    await flushRuntimeTasks()

    const secondRealRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r2"]')
    expect(secondRealRowIndexCell.exists()).toBe(true)

    await secondRealRowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 56 })
    await flushRuntimeTasks()

    queryContextMenuAction("copy-row")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    const placeholderRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="__datagrid_placeholder__:3"]')
    expect(placeholderRowIndexCell.exists()).toBe(true)

    await placeholderRowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 72 })
    await flushRuntimeTasks()

    queryContextMenuAction("paste-row")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(6)
    expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 2)).toMatchObject({ rowId: "ph-2", owner: "" })
    expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 3)).toMatchObject({ rowId: "ph-3", owner: "" })
    expect(resolveRowAt<{ rowId: string; owner: string; region: string }>(wrapper, 4)).toMatchObject({ owner: "NOC", region: "eu-west" })
    expect(resolveRowAt<{ rowId: string; owner: string; region: string }>(wrapper, 5)).toMatchObject({ owner: "NOC", region: "us-east" })
    expect(resolveRowAt<{ rowId: string }>(wrapper, 4)?.rowId).not.toBe("r1")
    expect(resolveRowAt<{ rowId: string }>(wrapper, 5)?.rowId).not.toBe("r2")

    wrapper.unmount()
  })

  it("supports Ctrl+C and Ctrl+V for the current row-index selection range into the placeholder tail", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 2),
        columns: COLUMNS,
        rowIndexMenu: true,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 2,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      selection?: {
        setSnapshot?: (snapshot: unknown) => void
      }
    } | null

    api?.selection?.setSnapshot?.({
      ranges: [{
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: COLUMNS.length - 1,
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 1, colIndex: 0, rowId: "r2" },
        startRowId: "r1",
        endRowId: "r2",
      }],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: "r2" },
    })
    await flushRuntimeTasks()

    const secondRealRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r2"]')
    expect(secondRealRowIndexCell.exists()).toBe(true)

    ;(secondRealRowIndexCell.element as HTMLElement).focus()
    await secondRealRowIndexCell.trigger("keydown", { key: "c", ctrlKey: true })
    await flushRuntimeTasks()

    const placeholderRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="__datagrid_placeholder__:3"]')
    expect(placeholderRowIndexCell.exists()).toBe(true)

    ;(placeholderRowIndexCell.element as HTMLElement).focus()
    await placeholderRowIndexCell.trigger("keydown", { key: "v", ctrlKey: true })
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(6)
    expect(resolveRowAt<{ rowId: string; owner: string; region: string }>(wrapper, 4)).toMatchObject({ owner: "NOC", region: "eu-west" })
    expect(resolveRowAt<{ rowId: string; owner: string; region: string }>(wrapper, 5)).toMatchObject({ owner: "NOC", region: "us-east" })

    wrapper.unmount()
  })

  it("supports Ctrl+X and Ctrl+V to move a cut row below a placeholder row index", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 2),
        columns: COLUMNS,
        rowIndexMenu: true,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 2,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    const firstRealRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r1"]')
    expect(firstRealRowIndexCell.exists()).toBe(true)

    await firstRealRowIndexCell.trigger("click")
    await firstRealRowIndexCell.trigger("keydown", { key: "x", ctrlKey: true })
    await flushRuntimeTasks()

    expect(wrapper.find('.grid-body-pane--left .grid-row').classes()).toContain("grid-row--clipboard-pending")

    const placeholderRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="__datagrid_placeholder__:2"]')
    expect(placeholderRowIndexCell.exists()).toBe(true)

    await placeholderRowIndexCell.trigger("click")
    await placeholderRowIndexCell.trigger("keydown", { key: "v", ctrlKey: true })
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(3)
    expect(resolveRowAt<{ rowId: string }>(wrapper, 0)).toMatchObject({ rowId: "r2" })
    expect(resolveRowAt<{ rowId: string }>(wrapper, 1)).toMatchObject({ rowId: "ph-2" })
    expect(resolveRowAt<{ rowId: string }>(wrapper, 2)).toMatchObject({ rowId: "r1" })
    expect(wrapper.find('.grid-body-pane--left .grid-row').classes()).not.toContain("grid-row--clipboard-pending")
    expect(document.activeElement?.classList.contains("datagrid-stage__row-index-cell")).toBe(true)

    wrapper.unmount()
  })

  it("moves the current row-index selection range below a placeholder row index with Ctrl+X and Ctrl+V", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        rowIndexMenu: true,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 2,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    await flushRuntimeTasks()

    const api = resolveVm(wrapper).getApi?.() as {
      selection?: {
        setSnapshot?: (snapshot: unknown) => void
      }
      rows: {
        get: (index: number) => { rowId?: string } | undefined
      }
    } | null

    api?.selection?.setSnapshot?.({
      ranges: [{
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: COLUMNS.length - 1,
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 1, colIndex: 0, rowId: "r2" },
        startRowId: "r1",
        endRowId: "r2",
      }],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: "r2" },
    })
    await flushRuntimeTasks()

    const secondRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="r2"]')
    expect(secondRowIndexCell.exists()).toBe(true)

    ;(secondRowIndexCell.element as HTMLElement).focus()
    await secondRowIndexCell.trigger("keydown", { key: "x", ctrlKey: true })
    await flushRuntimeTasks()

    expect(wrapper.findAll('.grid-body-pane--left .grid-row').at(0)?.classes()).toContain("grid-row--clipboard-pending")
    expect(wrapper.findAll('.grid-body-pane--left .grid-row').at(1)?.classes()).toContain("grid-row--clipboard-pending")

    const placeholderRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="__datagrid_placeholder__:4"]')
    expect(placeholderRowIndexCell.exists()).toBe(true)

    ;(placeholderRowIndexCell.element as HTMLElement).focus()
    await placeholderRowIndexCell.trigger("keydown", { key: "v", ctrlKey: true })
    await flushRuntimeTasks()

    expect(resolveApiRowCount(wrapper)).toBe(5)
    expect([
      api?.rows.get(0)?.rowId,
      api?.rows.get(1)?.rowId,
      api?.rows.get(2)?.rowId,
      api?.rows.get(3)?.rowId,
      api?.rows.get(4)?.rowId,
    ]).toEqual(["r3", "ph-3", "ph-4", "r1", "r2"])

    wrapper.unmount()
  })

  it("pastes multiple clipboard rows below a deeper placeholder row from rowIndexMenu", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS.slice(0, 1),
        columns: COLUMNS,
        rowIndexMenu: true,
        renderMode: "pagination",
        layoutMode: "auto-height",
        placeholderRows: {
          count: 3,
          createRowAt: ({ visualRowIndex }) => ({
            rowId: `ph-${visualRowIndex}`,
            owner: "",
            region: "",
            amount: 0,
          }),
        },
      },
    })

    const originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn<(_: string) => Promise<void>>().mockResolvedValue(undefined),
        readText: vi.fn<() => Promise<string>>().mockResolvedValue(JSON.stringify([
          { rowId: "clip-1", owner: "Alpha", region: "eu-west", amount: 101 },
          { rowId: "clip-2", owner: "Beta", region: "us-east", amount: 202 },
        ])),
      },
    })

    try {
      await flushRuntimeTasks()

      const placeholderRowIndexCell = wrapper.find('.datagrid-stage__row-index-cell[data-row-id="__datagrid_placeholder__:2"]')
      expect(placeholderRowIndexCell.exists()).toBe(true)

      await placeholderRowIndexCell.trigger("contextmenu", { button: 2, clientX: 96, clientY: 72 })
      await flushRuntimeTasks()

      queryContextMenuAction("paste-row")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      await flushRuntimeTasks()

      expect(resolveApiRowCount(wrapper)).toBe(5)
      expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 1)).toMatchObject({
        rowId: "ph-1",
        owner: "",
      })
      expect(resolveRowAt<{ rowId: string; owner: string }>(wrapper, 2)).toMatchObject({
        rowId: "ph-2",
        owner: "",
      })
      expect(resolveRowAt<{ owner: string; region: string; amount: number }>(wrapper, 3)).toMatchObject({
        owner: "Alpha",
        region: "eu-west",
        amount: 101,
      })
      expect(resolveRowAt<{ owner: string; region: string; amount: number }>(wrapper, 4)).toMatchObject({
        owner: "Beta",
        region: "us-east",
        amount: 202,
      })
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard,
      })
    }

    wrapper.unmount()
  })

  it("keeps the fill handle disabled by default", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: EDITABLE_COLUMNS,
      },
    })

    await flushRuntimeTasks()

    resolveVm(wrapper).getApi?.()?.selection?.setSnapshot?.({
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      }],
    })
    await flushRuntimeTasks()

    expect(wrapper.find(".cell-fill-handle").exists()).toBe(false)

    wrapper.unmount()
  })

  it("enables the fill handle declaratively", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: EDITABLE_COLUMNS,
        fillHandle: true,
      },
    })

    await flushRuntimeTasks()

    resolveVm(wrapper).getApi?.()?.selection?.setSnapshot?.({
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      ranges: [{
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        startRowId: "r1",
        endRowId: "r1",
        anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
        focus: { rowIndex: 0, colIndex: 0, rowId: "r1" },
      }],
    })
    await flushRuntimeTasks()

    expect(wrapper.find(".cell-fill-handle").exists()).toBe(true)

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
          { key: "owner", label: "Owner" },
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
