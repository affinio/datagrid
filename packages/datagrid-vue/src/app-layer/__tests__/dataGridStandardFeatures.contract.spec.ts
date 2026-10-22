import { mount } from "@vue/test-utils"
import { nextTick } from "vue"
import { describe, expect, it } from "vitest"
import DataGrid from "../DataGrid"

interface FinanceRow {
  id: number
  revenue: number
  cost: number
  grossMargin?: number
}

const rows: readonly FinanceRow[] = [
  { id: 1, revenue: 100, cost: 60 },
]

const columns = [
  { key: "revenue", label: "Revenue" },
  { key: "cost", label: "Cost" },
  { key: "grossMargin", label: "Gross margin", formula: "SAFE_DIVIDE(revenue - cost, revenue, 0)" },
] as const

const plainColumns = [
  { key: "revenue", label: "Revenue" },
  { key: "cost", label: "Cost" },
] as const

async function flushRuntimeTasks(): Promise<void> {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

describe("standard DataGrid app features", () => {
  it("registers the finance formula pack without a separate package or license", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows,
        columns,
        formulaPacks: true,
        clientRowModelOptions: {
          resolveRowId: (row: FinanceRow) => row.id,
        },
      },
    })

    await flushRuntimeTasks()

    const api = (wrapper.vm as unknown as {
      getApi?: () => {
        rows: { get: (index: number) => { data?: FinanceRow } | undefined }
      } | null
    }).getApi?.()
    expect(api?.rows.get(0)?.data?.grossMargin).toBe(0.4)
    wrapper.unmount()
  })

  it("lets application formula functions override a built-in pack function", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows,
        columns,
        formulaPacks: ["finance"],
        formulaFunctions: {
          SAFE_DIVIDE: {
            arity: { min: 2, max: 3 },
            compute: () => 99,
          },
        },
        clientRowModelOptions: {
          resolveRowId: (row: FinanceRow) => row.id,
        },
      },
    })

    await flushRuntimeTasks()
    const api = (wrapper.vm as unknown as {
      getApi?: () => {
        rows: { get: (index: number) => { data?: FinanceRow } | undefined }
      } | null
    }).getApi?.()
    expect(api?.rows.get(0)?.data?.grossMargin).toBe(99)
    wrapper.unmount()
  })

  it("opens the built-in diagnostics inspector from the standard package", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: { rows, columns: plainColumns, diagnostics: true },
    })

    await flushRuntimeTasks()
    document.body.querySelector<HTMLButtonElement>("[data-datagrid-diagnostics-trigger]")?.click()
    await flushRuntimeTasks()

    expect(document.body.querySelector(".datagrid-diagnostics-inspector")).toBeTruthy()
    expect(document.body.textContent).toContain("Performance preset")
    expect(document.body.textContent).not.toContain("License")
    wrapper.unmount()
  })

  it("applies a performance preset without a license check", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows,
        columns: plainColumns,
        performance: "throughput",
        clientRowModelOptions: {
          resolveRowId: (row: FinanceRow) => row.id,
        },
      },
    })

    await flushRuntimeTasks()
    const api = (wrapper.vm as unknown as {
      getApi?: () => { compute: { getMode: () => string | null } } | null
    }).getApi?.()
    expect(api?.compute.getMode()).toBe("worker")
    wrapper.unmount()
  })
})
