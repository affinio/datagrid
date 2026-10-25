import { flushPromises, mount } from "@vue/test-utils"
import { afterEach, describe, expect, it } from "vitest"
import { nextTick } from "vue"
import { exportDataGridXlsx, formatDataGridCellValue, type DataGridApi } from "@affino/datagrid-vue"
import type { DataGridFilterSnapshot, DataGridSortState } from "@affino/datagrid-core"
import VueFormulaGridCard from "./VueFormulaGridCard.vue"

const originalWorker = globalThis.Worker

afterEach(() => {
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: originalWorker })
})

describe("VueFormulaGridCard export workbench", () => {
  it("starts with a filtered and sorted formula view and exposes XLSX export", async () => {
    const wrapper = mount(VueFormulaGridCard, {
      attachTo: document.body,
      global: { stubs: { teleport: true } },
    })

    await flushPromises()
    await nextTick()

    const grid = wrapper.findComponent({ name: "DataGrid" })
    const api = (grid.vm as any).$?.exposed?.getApi?.() as DataGridApi<Record<string, unknown>> | null
    expect(api).toBeTruthy()
    expect(wrapper.find('[data-datagrid-toolbar-action="export-xlsx"]').exists()).toBe(true)
    expect(grid.props("fillHandle")).toBe(true)
    expect(grid.props("layoutMode")).toBe("fill")
    expect(grid.props("xlsxExport")).toMatchObject({ fileName: "formula-export-workbench.xlsx", formulas: "excel" })
    expect(grid.props("groupingPresentation")).toEqual({
      display: "hierarchy-column",
      hierarchyColumn: {
        headerName: "Group / product",
        leafColumnId: "product",
        hideLeafSourceColumn: true,
        showCount: true,
        showGroupFieldLabel: "auto",
      },
    })
    const styleResolver = grid.props("cellStyle") as (_row: unknown, rowIndex: number, column: { key: string }, columnIndex: number) => unknown
    expect(styleResolver({}, 0, { key: "total" }, 0)).toEqual({
      backgroundColor: "#DCFCE7",
      color: "#166534",
      fontWeight: 700,
    })
    expect(styleResolver({}, 0, { key: "marginPct" }, 0)).toEqual({
      backgroundColor: "#DBEAFE",
      color: "#1E40AF",
      fontWeight: 700,
    })
    const columns = grid.props("columns") as Array<{
      key: string
      export?: { style?: unknown }
      presentation?: { format?: { number?: { style?: "decimal" | "currency" | "percent"; maximumFractionDigits?: number } } }
    }>
    for (const key of ["subtotal", "tax", "total", "margin"]) {
      const column = columns.find(entry => entry.key === key)
      expect(column?.presentation?.format?.number?.maximumFractionDigits).toBe(2)
      expect(formatDataGridCellValue(19.777, column)).toBe("19.78")
    }
    const marginPctColumn = columns.find(column => column.key === "marginPct")
    expect(marginPctColumn?.presentation?.format?.number).toMatchObject({
      style: "percent",
      maximumFractionDigits: 2,
    })
    expect(formatDataGridCellValue(0.123456, marginPctColumn)).toBe("12.35%")
    expect(columns.find(column => column.key === "total")?.export?.style).toEqual({
      fillColor: "DCFCE7",
      fontColor: "166534",
      bold: true,
    })
    expect(columns.find(column => column.key === "marginPct")?.export?.style).toEqual({
      fillColor: "DBEAFE",
      fontColor: "1E40AF",
      bold: true,
    })

    let workbookInput: unknown
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      value: class {
        onmessage: ((event: MessageEvent<{ bytes: ArrayBuffer }>) => void) | null = null
        onerror: ((event: ErrorEvent) => void) | null = null
        postMessage(payload: unknown): void {
          workbookInput = payload
          queueMicrotask(() => this.onmessage?.({ data: { bytes: new Uint8Array([1]).buffer } } as MessageEvent<{ bytes: ArrayBuffer }>))
        }
        terminate(): void {}
      },
    })
    await expect(exportDataGridXlsx(api!, { formulas: "excel" })).resolves.toMatchObject({ status: "success" })
    const workbook = workbookInput as { sheets: Array<{ rows: Array<Array<{ type: string; value: unknown } | null>> }> }
    const formulaCells = workbook.sheets[0]?.rows.flat().filter(cell => cell?.type === "formula") ?? []
    expect(formulaCells.length).toBeGreaterThan(0)
    expect(formulaCells.every(cell => typeof cell?.value === "string" && cell.value.startsWith("="))).toBe(true)

    const snapshot = api!.rows.getSnapshot()
    expect(snapshot.groupBy?.fields).toEqual(["segment"])
    expect(snapshot.sortModel).toEqual([{ key: "total", direction: "desc" }] satisfies readonly DataGridSortState[])
    expect(snapshot.filterModel).toMatchObject({
      columnFilters: {
        segment: { kind: "predicate", operator: "contains", value: "Enterprise" },
      },
    } satisfies Partial<DataGridFilterSnapshot>)
    expect(wrapper.find('.grid-header-row [data-column-key="segment"]').exists()).toBe(false)
    expect(wrapper.find('.grid-header-row [data-column-key="__affino_hierarchy__"]').exists()).toBe(true)
    expect(wrapper.find('.grid-header-row [data-column-key="product"]').exists()).toBe(false)
    const groupToggle = wrapper.find(".datagrid-hierarchy-group__toggle")
    expect(groupToggle.exists()).toBe(true)
    expect(groupToggle.attributes("aria-expanded")).toBe("true")
    expect(groupToggle.element.closest('.grid-cell[data-column-key="__affino_hierarchy__"]')).not.toBeNull()
    expect(groupToggle.element.closest(".grid-row")?.textContent).toContain("Enterprise")
    const expandedRowCount = api!.rows.getCount()
    await groupToggle.trigger("click")
    await flushPromises()
    expect(groupToggle.attributes("aria-expanded")).toBe("false")
    expect(api!.rows.getCount()).toBeLessThan(expandedRowCount)
    await groupToggle.trigger("click")
    await flushPromises()
    expect(groupToggle.attributes("aria-expanded")).toBe("true")
    expect(wrapper.findAll(".grid-row").length).toBeGreaterThan(0)
    const highlightResolver = grid.props("cellClass") as (row: unknown, rowIndex: number, column: { key: string }, columnIndex: number) => unknown
    expect(highlightResolver({ kind: "leaf", rowId: "r1", data: {} }, 0, { key: "segment" }, 0)).toEqual({
      "formula-workbench-cell--filtered-segment": true,
    })

    wrapper.unmount()
  })
})
