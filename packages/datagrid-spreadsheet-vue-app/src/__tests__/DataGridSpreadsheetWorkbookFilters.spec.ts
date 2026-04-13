import { mount } from "@vue/test-utils"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { defineComponent, h, nextTick, ref } from "vue"
import { createDataGridSpreadsheetWorkbookModel, type DataGridSpreadsheetWorkbookModel } from "@affino/datagrid-core"

import DataGridSpreadsheetWorkbookApp from "../DataGridSpreadsheetWorkbookApp.vue"

vi.mock("../DataGridSpreadsheetFormulaEditor.vue", () => {
  return {
    default: defineComponent({
      name: "DataGridSpreadsheetFormulaEditor",
      props: {
        editorRawInput: {
          type: String,
          default: "",
        },
      },
      emits: [
        "blur",
        "cancel",
        "commit",
        "focus",
        "input",
        "keydown",
        "selection-change",
        "reference-enter",
        "reference-leave",
        "autocomplete-hover",
        "autocomplete-select",
      ],
      setup(props, { emit, expose }) {
        const inputRef = ref<HTMLTextAreaElement | null>(null)

        expose({
          blur: () => inputRef.value?.blur(),
          focus: (options?: FocusOptions) => inputRef.value?.focus(options),
          getInputElement: () => inputRef.value,
          getMenuController: () => null,
          setSelectionRange: (start: number, end: number) => inputRef.value?.setSelectionRange(start, end),
        })

        return () => h("textarea", {
          ref: inputRef,
          class: "spreadsheet-formula-input",
          value: props.editorRawInput,
          onInput: (event: Event) => emit("input", event),
          onFocus: () => emit("focus"),
          onBlur: () => emit("blur"),
          onKeydown: (event: KeyboardEvent) => emit("keydown", event),
          onSelect: () => emit("selection-change"),
          onClick: () => emit("selection-change"),
          onKeyup: () => emit("selection-change"),
        })
      },
    }),
  }
})

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

function queryAdvancedFilterRoot(): HTMLElement | null {
  const roots = Array.from(document.body.querySelectorAll<HTMLElement>(".datagrid-advanced-filter"))
  return roots.findLast(root => getComputedStyle(root).display !== "none") ?? null
}

function findGridCell(
  wrapper: ReturnType<typeof mount>,
  rowIndex: number,
  columnIndex: number,
) {
  return wrapper.find(`.spreadsheet-grid-host .grid-cell[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`)
}

function findGridCellByColumnKey(
  wrapper: ReturnType<typeof mount>,
  rowIndex: number,
  columnKey: string,
) {
  return wrapper.find(`.spreadsheet-grid-host .grid-cell[data-row-index="${rowIndex}"][data-column-key="${columnKey}"]`)
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
    ],
  })
  workbook.sync()
  return workbook
}

function createAdvancedFilterWorkbookModel(): DataGridSpreadsheetWorkbookModel {
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
            { key: "orderId", title: "Order" },
            { key: "qty", title: "Qty" },
            { key: "price", title: "Price" },
            { key: "total", title: "Total" },
          ],
          rows: [
            { id: "order-1", cells: { orderId: "SO-1001", qty: 2, price: 300, total: "=[qty]@row * [price]@row" } },
            { id: "order-2", cells: { orderId: "SO-1002", qty: 4, price: 250, total: "=[qty]@row * [price]@row" } },
          ],
        },
      },
    ],
  })
  workbook.sync()
  return workbook
}

describe("DataGridSpreadsheetWorkbookApp column filters", () => {
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

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: () => {},
    })
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("builds and applies column-menu value filters from computed formula totals", async () => {
    const workbook = createWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
    })

    await flushUiAndTimers()

    await wrapper.find('.grid-cell--header[data-column-key="total"] [data-datagrid-column-menu-button="true"]').trigger("click")
    await flushUiAndTimers()

    const valueRows = Array.from(queryColumnMenuRoot()?.querySelectorAll<HTMLElement>(".datagrid-column-menu__value") ?? [])
    expect(valueRows.map(row => row.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      expect.stringContaining("1560"),
      expect.stringContaining("1680"),
    ])

    const total1680Row = valueRows.find(row => row.textContent?.includes("1680"))
    expect(total1680Row).toBeTruthy()

    const total1680Checkbox = total1680Row?.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(total1680Checkbox).toBeTruthy()
    total1680Checkbox!.checked = false
    total1680Checkbox!.dispatchEvent(new Event("change", { bubbles: true }))

    queryColumnMenuAction("apply-filter")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await flushUiAndTimers()

    expect(findGridCellByColumnKey(wrapper, 0, "total").text()).toContain("1560")
    expect(findGridCellByColumnKey(wrapper, 1, "total").exists()).toBe(false)

    wrapper.unmount()
    workbook.dispose()
  })

  it("commits typed advanced-filter combobox selections before applying formula-column predicates", async () => {
    const workbook = createAdvancedFilterWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
    })

    await flushUiAndTimers()

    await wrapper.find('[data-datagrid-toolbar-action="advanced-filter"]').trigger("click")
    await flushUiAndTimers()

    const popover = queryAdvancedFilterRoot()
    expect(popover).toBeTruthy()

    const comboboxes = popover?.querySelectorAll<HTMLInputElement>('input[role="combobox"]') ?? []
    expect(comboboxes.length).toBeGreaterThanOrEqual(3)

    const columnInput = comboboxes[1]
    expect(columnInput).toBeTruthy()
    columnInput!.focus()
    columnInput!.value = "Total"
    columnInput!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushUiAndTimers()
    columnInput!.blur()
    await flushUiAndTimers()

    const operatorInput = comboboxes[2]
    expect(operatorInput).toBeTruthy()
    operatorInput!.focus()
    operatorInput!.value = "<"
    operatorInput!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushUiAndTimers()
    operatorInput!.blur()
    await flushUiAndTimers()

    const valueInput = popover?.querySelector<HTMLInputElement>('.datagrid-advanced-filter__field--value input[type="text"]')
    expect(valueInput).toBeTruthy()
    valueInput!.value = "700"
    valueInput!.dispatchEvent(new Event("input", { bubbles: true }))

    popover?.querySelector<HTMLElement>(".datagrid-advanced-filter__primary")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushUiAndTimers()

    expect(findGridCellByColumnKey(wrapper, 0, "orderId").text()).toContain("SO-1001")
    expect(findGridCellByColumnKey(wrapper, 0, "total").text()).toContain("600")
    expect(findGridCellByColumnKey(wrapper, 1, "orderId").exists()).toBe(false)

    wrapper.unmount()
    workbook.dispose()
  })

  it("applies greater-than predicates to computed formula totals", async () => {
    const workbook = createAdvancedFilterWorkbookModel()

    const wrapper = mount(DataGridSpreadsheetWorkbookApp, {
      props: {
        workbookModel: workbook,
        title: "Revenue workbook",
      },
      attachTo: document.body,
    })

    await flushUiAndTimers()

    await wrapper.find('[data-datagrid-toolbar-action="advanced-filter"]').trigger("click")
    await flushUiAndTimers()

    const popover = queryAdvancedFilterRoot()
    expect(popover).toBeTruthy()

    const comboboxes = popover?.querySelectorAll<HTMLInputElement>('input[role="combobox"]') ?? []
    expect(comboboxes.length).toBeGreaterThanOrEqual(3)

    const columnInput = comboboxes[1]
    expect(columnInput).toBeTruthy()
    columnInput!.focus()
    columnInput!.value = "Total"
    columnInput!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushUiAndTimers()
    columnInput!.blur()
    await flushUiAndTimers()

    const operatorInput = comboboxes[2]
    expect(operatorInput).toBeTruthy()
    operatorInput!.focus()
    operatorInput!.value = ">"
    operatorInput!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushUiAndTimers()
    operatorInput!.blur()
    await flushUiAndTimers()

    const valueInput = popover?.querySelector<HTMLInputElement>('.datagrid-advanced-filter__field--value input[type="text"]')
    expect(valueInput).toBeTruthy()
    valueInput!.value = "700"
    valueInput!.dispatchEvent(new Event("input", { bubbles: true }))

    popover?.querySelector<HTMLElement>(".datagrid-advanced-filter__primary")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushUiAndTimers()

    expect(findGridCellByColumnKey(wrapper, 0, "orderId").text()).toContain("SO-1002")
    expect(findGridCellByColumnKey(wrapper, 0, "total").text()).toContain("1000")
    expect(findGridCellByColumnKey(wrapper, 1, "orderId").exists()).toBe(false)

    wrapper.unmount()
    workbook.dispose()
  })
})
