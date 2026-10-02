import { h, nextTick } from "vue"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import { createDataSourceBackedRowModel } from "@affino/datagrid-vue"
import type { DataGridDataSourcePullResult } from "@affino/datagrid-vue"
import DataGrid from "../DataGrid"
import type { DataGridEmptyStateProps } from "../config/dataGridEmptyState"

const columns = [
  { key: "name", label: "Name", width: 180 },
  { key: "amount", label: "Amount", width: 120 },
] as const

const rows = [
  { rowId: "r1", name: "Alpha", amount: 1 },
  { rowId: "r2", name: "Beta", amount: 2 },
] as const

async function flushRuntimeTasks(): Promise<void> {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

describe("DataGrid empty state", () => {
  it("renders the default and custom empty state inside the body", async () => {
    const renderEmptyState = vi.fn((state: DataGridEmptyStateProps) => (
      h("p", { "data-test": "custom-empty" }, state.reason)
    ))
    const wrapper = mount(DataGrid, {
      props: {
        rows: [],
        columns,
        quickFilter: true,
        emptyState: renderEmptyState,
      },
    })

    await flushRuntimeTasks()

    expect(wrapper.find(".datagrid-empty-state").exists()).toBe(true)
    expect(wrapper.find("[data-test='custom-empty']").text()).toBe("no-rows")
    expect(renderEmptyState).toHaveBeenCalledWith({
      reason: "no-rows",
      hasActiveFilters: false,
      rowCount: 0,
    })
    expect(wrapper.find(".grid-header-shell").exists()).toBe(true)
    expect(wrapper.find("[data-datagrid-quick-filter-input='true']").exists()).toBe(true)

    wrapper.unmount()

    const defaultWrapper = mount(DataGrid, {
      props: { rows: [], columns },
    })
    await flushRuntimeTasks()
    expect(defaultWrapper.find(".datagrid-empty-state").text()).toContain("No rows to display.")
    defaultWrapper.unmount()
  })

  it("renders filtered-empty and restores rows after clearing the filter", async () => {
    const wrapper = mount(DataGrid, {
      props: { rows, columns, quickFilter: true },
    })
    await flushRuntimeTasks()

    const input = wrapper.find<HTMLInputElement>("[data-datagrid-quick-filter-input='true']")
    await input.setValue("missing")
    await flushRuntimeTasks()

    expect(wrapper.find(".datagrid-empty-state").text()).toContain("No rows match the current filters.")
    expect(wrapper.find(".grid-header-shell").exists()).toBe(true)

    await input.setValue("")
    await flushRuntimeTasks()

    expect(wrapper.find(".datagrid-empty-state").exists()).toBe(false)
    expect(wrapper.findAll(".grid-row").length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it("does not show empty state during server loading, then shows it for an empty result", async () => {
    let resolvePull: ((result: DataGridDataSourcePullResult<unknown>) => void) | null = null
    const pull = vi.fn(() => new Promise<DataGridDataSourcePullResult<unknown>>(resolve => {
      resolvePull = resolve
    }))
    const rowModel = createDataSourceBackedRowModel({
      dataSource: { pull },
      resolveRowId: row => String((row as { rowId: string }).rowId),
      initialTotal: 0,
    })
    const wrapper = mount(DataGrid, {
      props: { rowModel, columns, quickFilter: true },
    })

    await nextTick()
    expect(wrapper.find(".datagrid-empty-state").exists()).toBe(false)

    resolvePull?.({ rows: [], total: 0 })
    await flushRuntimeTasks()
    expect(wrapper.find(".datagrid-empty-state").exists()).toBe(true)
    expect(wrapper.find("[data-datagrid-quick-filter-input='true']").exists()).toBe(true)

    wrapper.unmount()
    rowModel.dispose()
  })

  it("does not show empty state for server errors", async () => {
    const rowModel = createDataSourceBackedRowModel({
      dataSource: {
        pull: vi.fn(async () => {
          throw new Error("backend unavailable")
        }),
      },
      resolveRowId: row => String((row as { rowId: string }).rowId),
      initialTotal: 0,
    })
    const wrapper = mount(DataGrid, { props: { rowModel, columns } })

    await flushRuntimeTasks()
    expect(wrapper.find(".datagrid-empty-state").exists()).toBe(false)

    wrapper.unmount()
    rowModel.dispose()
  })

  it.each([
    { layoutMode: "auto-height" as const, props: { minRows: 2, maxRows: 4 } },
    { layoutMode: "fill" as const, props: { maxRows: 4 } },
  ])("keeps $layoutMode empty body layout valid", async ({ layoutMode, props }) => {
    const wrapper = mount(DataGrid, {
      props: { rows: [], columns, layoutMode, ...props },
    })
    await flushRuntimeTasks()

    const emptyState = wrapper.find(".datagrid-empty-state")
    expect(emptyState.exists()).toBe(true)
    expect(emptyState.attributes("role")).toBe("status")
    expect(emptyState.attributes("aria-live")).toBe("polite")
    expect(wrapper.find(".grid-header-shell").exists()).toBe(true)
    wrapper.unmount()
  })
})
