import { mount } from "@vue/test-utils"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { defineComponent, h, nextTick } from "vue"
import { createDataGridSpreadsheetWorkbookModel, type DataGridSpreadsheetWorkbookModel } from "@affino/datagrid-core"

import DataGridSpreadsheetWorkbookApp from "../DataGridSpreadsheetWorkbookApp.vue"

vi.mock("@affino/popover-vue", async () => {
  const { ref } = await import("vue")
  return {
    usePopoverController: () => ({
      state: ref({ open: false }),
      getTriggerProps: (value: Record<string, unknown> = {}) => value,
      getContentProps: (value: Record<string, unknown> = {}) => value,
      open: () => {},
      close: () => {},
    }),
    useFloatingPopover: () => ({
      contentStyle: ref({}),
      teleportTarget: ref(null),
      contentRef: ref<HTMLElement | null>(null),
      updatePosition: async () => {},
    }),
  }
})

vi.mock("@affino/menu-vue", () => {
  const passthrough = (name: string) => defineComponent({
    name,
    setup(_props, { slots, attrs }) {
      return () => h("div", attrs, slots.default?.())
    },
  })

  const trigger = defineComponent({
    name: "UiMenuTrigger",
    setup(_props, { slots }) {
      return () => slots.default?.({ open: false }) ?? null
    },
  })

  return {
    UiMenu: passthrough("UiMenu"),
    UiMenuContent: passthrough("UiMenuContent"),
    UiMenuItem: passthrough("UiMenuItem"),
    UiMenuLabel: passthrough("UiMenuLabel"),
    UiMenuSeparator: passthrough("UiMenuSeparator"),
    UiMenuTrigger: trigger,
    UiSubMenu: passthrough("UiSubMenu"),
    UiSubMenuContent: passthrough("UiSubMenuContent"),
    UiSubMenuTrigger: passthrough("UiSubMenuTrigger"),
  }
})

vi.mock("@affino/menu-core", () => ({}))

async function flushUi(): Promise<void> {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

async function flushUiAndTimers(): Promise<void> {
  await flushUi()
  await new Promise(resolve => setTimeout(resolve, 0))
  await flushUi()
}

async function selectGridCell(
  wrapper: ReturnType<typeof mount>,
  rowIndex: number,
  columnIndex: number,
): Promise<void> {
  const cell = wrapper.find(`.spreadsheet-grid-host .grid-cell[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`)
  expect(cell.exists()).toBe(true)
  await cell.trigger("mousedown", {
    button: 0,
    clientX: 16,
    clientY: 16,
  })
  window.dispatchEvent(new MouseEvent("mouseup", {
    bubbles: true,
    button: 0,
    clientX: 16,
    clientY: 16,
  }))
  await flushUiAndTimers()
}

async function copySelectedGridCell(
  wrapper: ReturnType<typeof mount>,
  rowIndex: number,
  columnIndex: number,
): Promise<void> {
  const cell = findGridCell(wrapper, rowIndex, columnIndex)
  expect(cell.exists()).toBe(true)
  ;(cell.element as HTMLElement).focus()
  await cell.trigger("keydown", {
    key: "c",
    ctrlKey: true,
  })
  await flushUiAndTimers()
}

function findGridCell(
  wrapper: ReturnType<typeof mount>,
  rowIndex: number,
  columnIndex: number,
) {
  return wrapper.find(`.spreadsheet-grid-host .grid-cell[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`)
}

function createWorkbookModel(): DataGridSpreadsheetWorkbookModel {
  const workbook = createDataGridSpreadsheetWorkbookModel({
    activeSheetId: "orders",
    sheets: [
      {
        id: "orders",
        name: "Orders",
        sheetModelOptions: {
          referenceParserOptions: {
            syntax: "smartsheet",
            smartsheetAbsoluteRowBase: 1,
            allowSheetQualifiedReferences: true,
          },
          columns: [
            { key: "qty", title: "Qty" },
            { key: "price", title: "Price" },
            { key: "total", title: "Total" },
          ],
          rows: [
            { id: "order-1", cells: { qty: 4, price: 420, total: "=[qty]@row * [price]@row" } },
            { id: "order-2", cells: { qty: 2, price: 780, total: "=[qty]@row * [price]@row" } },
          ],
        },
      },
      {
        id: "orders-by-customer",
        name: "Orders by customer",
        kind: "view",
        sourceSheetId: "orders",
        pipeline: [
          {
            type: "group",
            by: [{ key: "total", label: "Total bucket" }],
            aggregations: [{ key: "revenue", field: "total", agg: "sum", label: "Revenue" }],
          },
          {
            type: "sort",
            fields: [{ key: "revenue", direction: "desc" }],
          },
        ],
      },
      {
        id: "summary",
        name: "Summary",
        sheetModelOptions: {
          referenceParserOptions: {
            syntax: "smartsheet",
            smartsheetAbsoluteRowBase: 1,
            allowSheetQualifiedReferences: true,
          },
          columns: [
            { key: "metric", title: "Metric" },
            { key: "value", title: "Value" },
          ],
          rows: [
            { id: "summary-1", cells: { metric: "Orders 1 + 2", value: "=orders![total]1 + orders![total]2" } },
          ],
        },
      },
    ],
  })
  workbook.sync()
  return workbook
}

function readOrdersRowState(workbook: DataGridSpreadsheetWorkbookModel): {
  qtyRawInput: string | null
  totalValue: unknown
} {
  const ordersSheet = workbook.getSheet("orders")
  const qtyCell = ordersSheet?.sheetModel.getCell({
    sheetId: "orders",
    rowId: "order-1",
    rowIndex: 0,
    columnKey: "qty",
  })
  const totalCell = ordersSheet?.sheetModel.getCell({
    sheetId: "orders",
    rowId: "order-1",
    rowIndex: 0,
    columnKey: "total",
  })
  return {
    qtyRawInput: qtyCell?.rawInput ?? null,
    totalValue: totalCell?.displayValue ?? null,
  }
}

function readSummaryMetricState(workbook: DataGridSpreadsheetWorkbookModel): {
  metricRawInput: string | null
  metricDisplayValue: unknown
} {
  const summarySheet = workbook.getSheet("summary")
  const metricCell = summarySheet?.sheetModel.getCell({
    sheetId: "summary",
    rowId: "summary-1",
    rowIndex: 0,
    columnKey: "metric",
  })
  return {
    metricRawInput: metricCell?.rawInput ?? null,
    metricDisplayValue: metricCell?.displayValue ?? null,
  }
}

function readViewRevenueState(workbook: DataGridSpreadsheetWorkbookModel): {
  rowCount: number
  revenueRawInput: string | null
  revenueDisplayValue: unknown
} {
  const viewSheet = workbook.getSheet("orders-by-customer")
  const revenueCell = viewSheet?.sheetModel.getCell({
    sheetId: "orders-by-customer",
    rowId: "group:total=1680",
    rowIndex: 0,
    columnKey: "revenue",
  })
  return {
    rowCount: viewSheet?.sheetModel.getSnapshot().rowCount ?? 0,
    revenueRawInput: revenueCell?.rawInput ?? null,
    revenueDisplayValue: revenueCell?.displayValue ?? null,
  }
}

describe("DataGridSpreadsheetWorkbookApp", () => {
  beforeAll(() => {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: ResizeObserverStub,
    })

    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      writable: true,
      value: () => {},
    })
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("renders workbook values and a fill handle", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const text = wrapper.text()

    expect(text).toContain("Revenue workbook")
    expect(text).toContain("1680")
    expect(wrapper.find(".cell-fill-handle").exists()).toBe(true)

    wrapper.unmount()
    workbook.dispose()
  })

  it("syncs the formula bar on the first grid click after mount", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("4")

    await selectGridCell(wrapper, 0, 1)

    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("420")
    expect(wrapper.text()).toContain("Orders / price / row 1")

    wrapper.unmount()
    workbook.dispose()
  })

  it("copies formula cells as display values when clipboardCopyMode is display", async () => {
    const workbook = createWorkbookModel()
    let clipboardPayload = ""
    const originalClipboard = navigator.clipboard

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(async (payload: string) => {
          clipboardPayload = payload
        }),
        readText: vi.fn(async () => clipboardPayload),
      },
    })

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
        clipboardCopyMode: "display",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    try {
      await flushUiAndTimers()

      const summaryTab = wrapper.findAll("button").find(button => button.text().includes("Summary"))
      expect(summaryTab).toBeDefined()

      await summaryTab!.trigger("click")
      await flushUiAndTimers()
      await selectGridCell(wrapper, 0, 1)
      await copySelectedGridCell(wrapper, 0, 1)

      expect(clipboardPayload).toBe("3240")
    } finally {
      wrapper.unmount()
      workbook.dispose()
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard,
      })
    }
  })

  it("undos and redoes workbook edits from the formula bar", async () => {
    const workbook = createWorkbookModel()

    expect(readOrdersRowState(workbook).totalValue).toBe(1680)

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    await formulaInput.trigger("focus")
    await formulaInput.setValue("9")
    await flushUiAndTimers()

    expect(readOrdersRowState(workbook)).toEqual({
      qtyRawInput: "9",
      totalValue: 3780,
    })
    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("9")

    const buttons = wrapper.findAll("button")
    const undoButton = buttons.find(button => button.text() === "Undo")
    const redoButton = buttons.find(button => button.text() === "Redo")

    expect(undoButton).toBeDefined()
    expect(redoButton).toBeDefined()

    await undoButton!.trigger("click")
    await flushUiAndTimers()

    expect(readOrdersRowState(workbook)).toEqual({
      qtyRawInput: "4",
      totalValue: 1680,
    })
    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("4")

    await redoButton!.trigger("click")
    await flushUiAndTimers()

    expect(readOrdersRowState(workbook)).toEqual({
      qtyRawInput: "9",
      totalValue: 3780,
    })
    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("9")

    wrapper.unmount()
    workbook.dispose()
  })

  it("undos and redoes plain value edits on non-formula cells", async () => {
    const workbook = createWorkbookModel()

    expect(readSummaryMetricState(workbook)).toEqual({
      metricRawInput: "Orders 1 + 2",
      metricDisplayValue: "Orders 1 + 2",
    })

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const summaryTab = wrapper.findAll("button").find(button => button.text().includes("Summary"))
    expect(summaryTab).toBeDefined()

    await summaryTab!.trigger("click")
    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    await formulaInput.trigger("focus")
    await formulaInput.setValue("Updated summary label")
    await flushUiAndTimers()

    expect(readSummaryMetricState(workbook)).toEqual({
      metricRawInput: "Updated summary label",
      metricDisplayValue: "Updated summary label",
    })
    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("Updated summary label")

    const buttons = wrapper.findAll("button")
    const undoButton = buttons.find(button => button.text() === "Undo")
    const redoButton = buttons.find(button => button.text() === "Redo")

    expect(undoButton).toBeDefined()
    expect(redoButton).toBeDefined()

    await undoButton!.trigger("click")
    await flushUiAndTimers()

    expect(readSummaryMetricState(workbook)).toEqual({
      metricRawInput: "Orders 1 + 2",
      metricDisplayValue: "Orders 1 + 2",
    })
    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("Orders 1 + 2")

    await redoButton!.trigger("click")
    await flushUiAndTimers()

    expect(readSummaryMetricState(workbook)).toEqual({
      metricRawInput: "Updated summary label",
      metricDisplayValue: "Updated summary label",
    })
    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("Updated summary label")

    wrapper.unmount()
    workbook.dispose()
  })

  it("undos pending plain value edits from the grid keyboard shortcut", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const summaryTab = wrapper.findAll("button").find(button => button.text().includes("Summary"))
    expect(summaryTab).toBeDefined()

    await summaryTab!.trigger("click")
    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    await formulaInput.trigger("focus")
    await formulaInput.setValue("Keyboard undo label")

    expect(readSummaryMetricState(workbook)).toEqual({
      metricRawInput: "Keyboard undo label",
      metricDisplayValue: "Keyboard undo label",
    })

    await formulaInput.trigger("keydown", { key: "Enter" })
    await flushUi()

    const activeGridCell = wrapper.find('.spreadsheet-grid-host .grid-cell[data-row-index="0"][data-column-index="0"]')
    expect(activeGridCell.exists()).toBe(true)

    await activeGridCell.trigger("keydown", { key: "z", ctrlKey: true })
    await flushUiAndTimers()

    expect(readSummaryMetricState(workbook)).toEqual({
      metricRawInput: "Orders 1 + 2",
      metricDisplayValue: "Orders 1 + 2",
    })

    wrapper.unmount()
    workbook.dispose()
  })

  it("shows compose mode guidance while editing a formula", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const summaryTab = wrapper.findAll("button").find(button => button.text().includes("Summary"))
    expect(summaryTab).toBeDefined()

    await summaryTab!.trigger("click")
    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    await formulaInput.trigger("focus")
    await formulaInput.setValue("=")
    await flushUiAndTimers()

    expect(wrapper.text()).toContain("Pick refs")
    expect(wrapper.text()).toContain("Caret ready for a cell reference")
    expect(wrapper.text()).toContain("Reference compose")
    expect(wrapper.text()).toContain("Cancel")
    expect(wrapper.text()).toContain("Apply")

    wrapper.unmount()
    workbook.dispose()
  })

  it("restores the edited cell selection after inserting a formula reference from the grid", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    await formulaInput.trigger("focus")
    await formulaInput.setValue("=")
    await flushUiAndTimers()

    await selectGridCell(wrapper, 0, 1)

    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("=[price]@row")
    expect(wrapper.text()).toContain("Orders / qty / row 1")

    const editedCell = findGridCell(wrapper, 0, 0)
    const referenceCell = findGridCell(wrapper, 0, 1)

    expect(editedCell.classes()).toContain("spreadsheet-cell--active")
    expect(referenceCell.classes()).not.toContain("spreadsheet-cell--active")
    expect(referenceCell.classes()).toContain("spreadsheet-cell--reference")

    wrapper.unmount()
    workbook.dispose()
  })

  it("lets users drag the active formula reference to another cell", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    await formulaInput.trigger("focus")
    await formulaInput.setValue("=")
    await flushUiAndTimers()

    await selectGridCell(wrapper, 0, 1)

    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("=[price]@row")
    expect(wrapper.find(".spreadsheet-formula-reference-overlay").exists()).toBe(true)

    const dragHandle = wrapper.get(".spreadsheet-formula-reference-handle--top-left")
    await dragHandle.trigger("mousedown", {
      button: 0,
      clientX: 8,
      clientY: 8,
    })

    await findGridCell(wrapper, 1, 2).trigger("mousemove", {
      clientX: 24,
      clientY: 24,
    })
    window.dispatchEvent(new MouseEvent("mouseup", {
      bubbles: true,
      button: 0,
      clientX: 24,
      clientY: 24,
    }))
    await flushUiAndTimers()

    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("=[total]2")
    expect(wrapper.find(".spreadsheet-formula-reference-overlay").exists()).toBe(true)

    wrapper.unmount()
    workbook.dispose()
  })

  it("lets users resize a rectangular formula reference from the overlay handles", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    await formulaInput.trigger("focus")
    await formulaInput.setValue("=SUM([qty]1:[price]2)")
    await flushUiAndTimers()

    expect(wrapper.find(".spreadsheet-formula-reference-overlay").exists()).toBe(true)

    const dragHandle = wrapper.get(".spreadsheet-formula-reference-handle--bottom-right")
    await dragHandle.trigger("mousedown", {
      button: 0,
      clientX: 24,
      clientY: 24,
    })

    await findGridCell(wrapper, 1, 2).trigger("mousemove", {
      clientX: 40,
      clientY: 24,
    })
    window.dispatchEvent(new MouseEvent("mouseup", {
      bubbles: true,
      button: 0,
      clientX: 40,
      clientY: 24,
    }))
    await flushUiAndTimers()

    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("=SUM([qty]1:[total]2)")
    expect(wrapper.find(".spreadsheet-formula-reference-overlay").exists()).toBe(true)

    wrapper.unmount()
    workbook.dispose()
  })

  it("inserts cross-sheet references after switching sheets during formula editing", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const summaryTab = wrapper.findAll("button").find(button => button.text().includes("Summary"))
    expect(summaryTab).toBeDefined()
    await summaryTab!.trigger("click")
    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    await formulaInput.trigger("focus")
    await formulaInput.setValue("=")
    await flushUiAndTimers()

    const ordersTab = wrapper.findAll("button").find(button => button.text().includes("Orders") && !button.text().includes("customer"))
    expect(ordersTab).toBeDefined()
    await ordersTab!.trigger("click")
    await flushUiAndTimers()

    await selectGridCell(wrapper, 0, 2)

    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("=orders![total]1")

    wrapper.unmount()
    workbook.dispose()
  })

  it("lets users drag an existing cross-sheet reference while viewing the target sheet", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const summaryTab = wrapper.findAll("button").find(button => button.text().includes("Summary"))
    expect(summaryTab).toBeDefined()
    await summaryTab!.trigger("click")
    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    await formulaInput.trigger("focus")
    await formulaInput.setValue("=orders![price]1")
    await flushUiAndTimers()

    const ordersTab = wrapper.findAll("button").find(button => button.text().includes("Orders") && !button.text().includes("customer"))
    expect(ordersTab).toBeDefined()
    await ordersTab!.trigger("click")
    await flushUiAndTimers()

    expect(wrapper.find(".spreadsheet-formula-reference-overlay").exists()).toBe(true)

    const dragHandle = wrapper.get(".spreadsheet-formula-reference-handle--top-left")
    await dragHandle.trigger("mousedown", {
      button: 0,
      clientX: 8,
      clientY: 8,
    })

    await findGridCell(wrapper, 1, 2).trigger("mousemove", {
      clientX: 24,
      clientY: 24,
    })
    window.dispatchEvent(new MouseEvent("mouseup", {
      bubbles: true,
      button: 0,
      clientX: 24,
      clientY: 24,
    }))
    await flushUiAndTimers()

    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("=orders![total]2")

    wrapper.unmount()
    workbook.dispose()
  })

  it("highlights the target sheet tab for an active cross-sheet formula reference", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const summaryTab = wrapper.findAll("button").find(button => button.text().includes("Summary"))
    expect(summaryTab).toBeDefined()
    await summaryTab!.trigger("click")
    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    await formulaInput.trigger("focus")
    await formulaInput.setValue("=orders![price]1")
    await flushUiAndTimers()

    const ordersTab = wrapper.findAll(".spreadsheet-tab").find(button => button.text().includes("Orders") && !button.text().includes("customer"))
    expect(ordersTab).toBeDefined()
    expect(ordersTab!.attributes("data-reference-target")).toBe("true")
    expect(ordersTab!.classes()).toContain("spreadsheet-tab--reference-target")

    wrapper.unmount()
    workbook.dispose()
  })

  it("navigates to the target sheet when clicking a cross-sheet reference chip", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const summaryTab = wrapper.findAll("button").find(button => button.text().includes("Summary"))
    expect(summaryTab).toBeDefined()
    await summaryTab!.trigger("click")
    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    await formulaInput.trigger("focus")
    await formulaInput.setValue("=orders![price]1")
    await flushUiAndTimers()

    const referenceChip = wrapper.findAll(".spreadsheet-reference-chip").find(button => button.text().includes("orders![price]1"))
    expect(referenceChip).toBeDefined()
    await referenceChip!.trigger("click")
    await flushUiAndTimers()

    const ordersTab = wrapper.findAll(".spreadsheet-tab").find(button => button.text().includes("Orders") && !button.text().includes("customer"))
    expect(ordersTab).toBeDefined()
    expect(ordersTab!.classes()).toContain("spreadsheet-tab--active")

    expect(wrapper.find(".spreadsheet-formula-reference-overlay").exists()).toBe(true)
    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("=orders![price]1")

    wrapper.unmount()
    workbook.dispose()
  })

  it("reveals the full target range when clicking a cross-sheet range reference chip", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const summaryTab = wrapper.findAll("button").find(button => button.text().includes("Summary"))
    expect(summaryTab).toBeDefined()
    await summaryTab!.trigger("click")
    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    await formulaInput.trigger("focus")
    await formulaInput.setValue("=SUM(orders![qty]1:[price]2)")
    await flushUiAndTimers()

    const referenceChip = wrapper.findAll(".spreadsheet-reference-chip").find(button => button.text().includes("orders![qty]1:[price]2"))
    expect(referenceChip).toBeDefined()
    await referenceChip!.trigger("click")
    await flushUiAndTimers()

    const ordersTab = wrapper.findAll(".spreadsheet-tab").find(button => button.text().includes("Orders") && !button.text().includes("customer"))
    expect(ordersTab).toBeDefined()
    expect(ordersTab!.classes()).toContain("spreadsheet-tab--active")

    expect(findGridCell(wrapper, 0, 0).classes()).toContain("spreadsheet-cell--reference")
    expect(findGridCell(wrapper, 1, 1).classes()).toContain("spreadsheet-cell--reference")
    expect(wrapper.find(".spreadsheet-formula-reference-overlay").exists()).toBe(true)
    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("=SUM(orders![qty]1:[price]2)")

    wrapper.unmount()
    workbook.dispose()
  })

  it("previews the target tab when hovering a cross-sheet reference chip", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const summaryTab = wrapper.findAll("button").find(button => button.text().includes("Summary"))
    expect(summaryTab).toBeDefined()
    await summaryTab!.trigger("click")
    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    await formulaInput.trigger("focus")
    await formulaInput.setValue("=orders![price]1 + [value]@row")
    await flushUiAndTimers()

    const ordersTab = wrapper.findAll(".spreadsheet-tab").find(button => button.text().includes("Orders") && !button.text().includes("customer"))
    expect(ordersTab).toBeDefined()
    expect(ordersTab!.attributes("data-reference-target")).toBe("false")

    const referenceChip = wrapper.findAll(".spreadsheet-reference-chip").find(button => button.text().includes("orders![price]1"))
    expect(referenceChip).toBeDefined()
    await referenceChip!.trigger("mouseenter")
    await flushUiAndTimers()

    expect(ordersTab!.attributes("data-reference-target")).toBe("true")
    expect(ordersTab!.classes()).toContain("spreadsheet-tab--reference-target")

    await referenceChip!.trigger("mouseleave")
    await flushUiAndTimers()

    expect(ordersTab!.attributes("data-reference-target")).toBe("false")

    wrapper.unmount()
    workbook.dispose()
  })

  it("temporarily reveals a cross-sheet target on hover and restores the origin sheet on leave", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const summaryTab = wrapper.findAll("button").find(button => button.text().includes("Summary"))
    expect(summaryTab).toBeDefined()
    await summaryTab!.trigger("click")
    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    await formulaInput.trigger("focus")
    await formulaInput.setValue("=SUM(orders![qty]1:[price]2)")
    await flushUiAndTimers()

    const referenceChip = wrapper.findAll(".spreadsheet-reference-chip").find(button => button.text().includes("orders![qty]1:[price]2"))
    expect(referenceChip).toBeDefined()

    await referenceChip!.trigger("mouseenter")
    await new Promise(resolve => setTimeout(resolve, 150))
    await flushUiAndTimers()

    const ordersTab = wrapper.findAll(".spreadsheet-tab").find(button => button.text().includes("Orders") && !button.text().includes("customer"))
    expect(ordersTab).toBeDefined()
    expect(ordersTab!.classes()).toContain("spreadsheet-tab--active")
    expect(findGridCell(wrapper, 0, 0).classes()).toContain("spreadsheet-cell--reference")
    expect(findGridCell(wrapper, 1, 1).classes()).toContain("spreadsheet-cell--reference")

    await referenceChip!.trigger("mouseleave")
    await flushUiAndTimers()

    const refreshedSummaryTab = wrapper.findAll(".spreadsheet-tab").find(button => button.text().includes("Summary"))
    expect(refreshedSummaryTab).toBeDefined()
    expect(refreshedSummaryTab!.classes()).toContain("spreadsheet-tab--active")
    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("=SUM(orders![qty]1:[price]2)")

    wrapper.unmount()
    workbook.dispose()
  })

  it("cancels formula bar edits and restores the pre-edit cell state", async () => {
    const workbook = createWorkbookModel()

    expect(readSummaryMetricState(workbook)).toEqual({
      metricRawInput: "Orders 1 + 2",
      metricDisplayValue: "Orders 1 + 2",
    })

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const summaryTab = wrapper.findAll("button").find(button => button.text().includes("Summary"))
    expect(summaryTab).toBeDefined()

    await summaryTab!.trigger("click")
    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    await formulaInput.trigger("focus")
    await formulaInput.setValue("Temporary summary label")
    await flushUiAndTimers()

    expect(readSummaryMetricState(workbook)).toEqual({
      metricRawInput: "Temporary summary label",
      metricDisplayValue: "Temporary summary label",
    })

    const cancelButton = wrapper.findAll("button").find(button => button.text() === "Cancel")
    expect(cancelButton).toBeDefined()

    await cancelButton!.trigger("click")
    await flushUiAndTimers()

    expect(readSummaryMetricState(workbook)).toEqual({
      metricRawInput: "Orders 1 + 2",
      metricDisplayValue: "Orders 1 + 2",
    })
    expect((formulaInput.element as HTMLTextAreaElement).value).toBe("Orders 1 + 2")

    wrapper.unmount()
    workbook.dispose()
  })

  it("autocompletes formula functions from the known registry", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    const formulaInputElement = formulaInput.element as HTMLTextAreaElement

    await formulaInput.trigger("focus")
    formulaInputElement.value = "=su"
    formulaInputElement.setSelectionRange(3, 3)
    await formulaInput.trigger("input")
    await flushUiAndTimers()

    expect(wrapper.find('[data-spreadsheet-formula-autocomplete="true"]').exists()).toBe(true)
    expect(wrapper.find('[data-formula-autocomplete-item="SUM"]').exists()).toBe(true)

    await formulaInput.trigger("keydown", { key: "Enter" })
    await flushUiAndTimers()

    expect(formulaInputElement.value).toBe("=SUM()")
    expect(formulaInputElement.selectionStart).toBe(5)
    expect(formulaInputElement.selectionEnd).toBe(5)

    wrapper.unmount()
    workbook.dispose()
  })

  it("keeps derived view sheets read-only while still rendering them in the workbook shell", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const viewTab = wrapper.findAll("button").find(button => button.text().includes("Orders by customer"))
    expect(viewTab).toBeDefined()

    await viewTab!.trigger("click")
    await flushUiAndTimers()

    const formulaInput = wrapper.get(".spreadsheet-formula-input")
    expect((formulaInput.element as HTMLTextAreaElement).readOnly).toBe(true)
    expect(wrapper.find(".cell-fill-handle").exists()).toBe(false)
    expect(readViewRevenueState(workbook)).toEqual({
      rowCount: 2,
      revenueRawInput: "",
      revenueDisplayValue: 1680,
    })

    await formulaInput.setValue("9999")
    await flushUiAndTimers()

    expect(readViewRevenueState(workbook)).toEqual({
      rowCount: 2,
      revenueRawInput: "",
      revenueDisplayValue: 1680,
    })

    wrapper.unmount()
    workbook.dispose()
  })

  it("renders workbook diagnostics for direct refs into unstable derived sheets", async () => {
    const workbook = createDataGridSpreadsheetWorkbookModel({
      activeSheetId: "summary",
      sheets: [
        {
          id: "orders",
          name: "Orders",
          sheetModelOptions: {
            referenceParserOptions: {
              syntax: "smartsheet",
              smartsheetAbsoluteRowBase: 1,
              allowSheetQualifiedReferences: true,
            },
            columns: [
              { key: "customerName", title: "Customer" },
              { key: "quarter", title: "Quarter" },
              { key: "total", title: "Total" },
            ],
            rows: [
              { id: "order-1", cells: { customerName: "Atlas", quarter: "Q1", total: 100 } },
            ],
          },
        },
        {
          id: "orders-pivot",
          name: "Orders pivot",
          kind: "view",
          sourceSheetId: "orders",
          pipeline: [
            {
              type: "pivot",
              spec: {
                rows: ["customerName"],
                columns: ["quarter"],
                values: [{ field: "total", agg: "sum" }],
              },
            },
          ],
        },
        {
          id: "summary",
          name: "Summary",
          sheetModelOptions: {
            referenceParserOptions: {
              syntax: "smartsheet",
              smartsheetAbsoluteRowBase: 1,
              allowSheetQualifiedReferences: true,
            },
            columns: [{ key: "value", title: "Value" }],
            rows: [
              {
                id: "summary-1",
                cells: {
                  value: "=orders-pivot![customerName]1",
                },
              },
            ],
          },
        },
      ],
    })

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUiAndTimers()

    const diagnosticsButton = wrapper.findAll("button").find(button => button.text().includes("Formula diagnostics"))
    expect(diagnosticsButton).toBeDefined()

    await diagnosticsButton!.trigger("click")
    await flushUiAndTimers()

    const text = wrapper.text()

    expect(text).toContain("Workbook issues")
    expect(text).toContain("summary -> orders-pivot")
    expect(text).toContain("Prefer TABLE('orders-pivot', ...)")

    wrapper.unmount()
    workbook.dispose()
  })
})
