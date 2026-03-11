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

    await flushUi()
    await flushUi()

    const text = wrapper.text()

    expect(text).toContain("Revenue workbook")
    expect(text).toContain("1680")
    expect(wrapper.find(".cell-fill-handle").exists()).toBe(true)

    wrapper.unmount()
    workbook.dispose()
  })
})
