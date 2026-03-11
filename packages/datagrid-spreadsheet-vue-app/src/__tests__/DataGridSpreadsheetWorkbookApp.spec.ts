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
})
