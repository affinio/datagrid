import { defineComponent, h, nextTick, ref } from "vue"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import { useAffinoDataGridUi } from "../useAffinoDataGridUi"

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

describe("useAffinoDataGridUi contract", () => {
  it("provides junior-oriented ui bindings with shared status updates", async () => {
    const status = ref("Booting")
    const rows = ref<GridRow[]>([
      { rowId: "r1", service: "edge-gateway", owner: "NOC" },
      { rowId: "r2", service: "billing-api", owner: "Payments" },
    ])
    let grid: ReturnType<typeof useAffinoDataGridUi<GridRow>> | null = null

    const Host = defineComponent({
      name: "AffinoDataGridUiHost",
      setup() {
        grid = useAffinoDataGridUi<GridRow>({
          rows,
          columns: COLUMNS,
          status,
          features: {
            selection: true,
            clipboard: {
              enabled: true,
              useSystemClipboard: false,
            },
            editing: true,
          },
        })
        return () => h("div")
      },
    })

    const wrapper = mount(Host)
    await flushTasks()

    expect(grid).not.toBeNull()
    expect(grid!.ui.status.value).toBe("Booting")
    expect(grid!.ui.toolbarActions.value.map(item => item.id)).toEqual([
      "copy",
      "cut",
      "paste",
      "select-all",
      "clear-selection",
    ])
    expect(grid!.ui.resolveHeaderAriaSort("service")).toBe("none")

    grid!.ui.bindToolbarAction("select-all").onClick()
    await flushTasks()
    expect(grid!.features.selection.selectedCount.value).toBe(2)
    expect(grid!.ui.status.value).toContain("Selected")

    grid!.ui.bindHeaderCell("service").onClick()
    await flushTasks()
    expect(grid!.sortState.value).toEqual([{ key: "service", direction: "asc" }])
    expect(grid!.ui.status.value).toBe("Sorted by service")
    expect(grid!.ui.resolveHeaderAriaSort("service")).toBe("ascending")

    expect(rows.value[0]).toBeDefined()
    const firstRow = rows.value[0]!
    grid!.ui.bindDataCell({
      row: firstRow,
      rowIndex: 0,
      columnKey: "owner",
      value: firstRow.owner,
    }).onDblclick()
    expect(grid!.ui.isCellEditing("r1", "owner")).toBe(true)
    grid!.ui.bindInlineEditor({
      rowKey: "r1",
      columnKey: "owner",
    }).onInput({
      target: { value: "qa-owner" },
    } as unknown as Event)
    expect(grid!.features.editing.activeSession.value?.draft).toBe("qa-owner")
    grid!.features.editing.cancelEdit()

    grid!.ui.bindHeaderCell("owner").onContextmenu({
      preventDefault: vi.fn(),
      clientX: 20,
      clientY: 24,
    } as unknown as MouseEvent)
    await flushTasks()
    expect(grid!.contextMenu.state.value.visible).toBe(true)

    grid!.ui.bindContextMenuAction("sort-desc").onClick()
    await flushTasks()
    expect(grid!.sortState.value).toEqual([{ key: "owner", direction: "desc" }])
    expect(grid!.contextMenu.state.value.visible).toBe(false)
    expect(grid!.ui.status.value).toContain("Sorted owner descending")

    wrapper.unmount()
  })
})
