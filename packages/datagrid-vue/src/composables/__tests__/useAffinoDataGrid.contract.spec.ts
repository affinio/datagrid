import { defineComponent, h, nextTick, ref } from "vue"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import { useAffinoDataGrid } from "../useAffinoDataGrid"

interface GridRow {
  rowId: string
  service: string
  owner: string
}

const COLUMNS = [
  { key: "service", label: "Service", width: 220 },
  { key: "owner", label: "Owner", width: 180 },
] as const

async function flushTasks() {
  await nextTick()
  await Promise.resolve()
}

describe("useAffinoDataGrid contract", () => {
  it("boots runtime and exposes sort + selection sugar", async () => {
    const rows = ref<GridRow[]>([
      { rowId: "r1", service: "edge-gateway", owner: "NOC" },
      { rowId: "r2", service: "billing-api", owner: "Payments" },
    ])

    let grid: ReturnType<typeof useAffinoDataGrid<GridRow>> | null = null

    const Host = defineComponent({
      name: "AffinoDataGridHost",
      setup() {
        grid = useAffinoDataGrid<GridRow>({
          rows,
          columns: COLUMNS,
          initialSortState: [{ key: "service", direction: "asc" }],
          features: {
            selection: true,
          },
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushTasks()

    expect(grid).not.toBeNull()
    expect(grid!.api.lifecycle.state).toBe("started")
    expect(grid!.rowModel.getSnapshot().sortModel).toEqual([{ key: "service", direction: "asc" }])

    grid!.toggleColumnSort("service")
    await flushTasks()
    expect(grid!.rowModel.getSnapshot().sortModel).toEqual([{ key: "service", direction: "desc" }])

    grid!.features.selection.setSelectedByKey("r1", true)
    expect(grid!.features.selection.isSelectedByKey("r1")).toBe(true)
    expect(grid!.features.selection.selectedCount.value).toBe(1)

    rows.value = [{ rowId: "r2", service: "billing-api", owner: "Payments" }]
    await flushTasks()
    expect(grid!.features.selection.isSelectedByKey("r1")).toBe(false)
    expect(grid!.features.selection.selectedCount.value).toBe(0)

    wrapper.unmount()
  })

  it("supports clipboard + editing sugar flow", async () => {
    const onCommit = vi.fn()
    let grid: ReturnType<typeof useAffinoDataGrid<GridRow>> | null = null

    const Host = defineComponent({
      name: "AffinoDataGridClipboardEditingHost",
      setup() {
        grid = useAffinoDataGrid<GridRow>({
          rows: [{ rowId: "r1", service: "edge-gateway", owner: "NOC" }],
          columns: COLUMNS,
          features: {
            clipboard: {
              enabled: true,
              useSystemClipboard: false,
            },
            editing: {
              mode: "cell",
              enum: true,
              onCommit,
            },
          },
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushTasks()

    const copied = await grid!.features.clipboard.copyText("alpha")
    expect(copied).toBe(true)
    expect(grid!.features.clipboard.lastCopiedText.value).toBe("alpha")
    expect(await grid!.features.clipboard.readText()).toBe("alpha")

    expect(grid!.features.editing.beginEdit({
      rowKey: "r1",
      columnKey: "owner",
      draft: "qa-owner",
    })).toBe(true)
    expect(grid!.features.editing.activeSession.value?.columnKey).toBe("owner")
    expect(grid!.features.editing.updateDraft("qa-owner-updated")).toBe(true)

    await expect(grid!.features.editing.commitEdit()).resolves.toBe(true)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(grid!.features.editing.activeSession.value).toBeNull()

    wrapper.unmount()
  })
})
