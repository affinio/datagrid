import { defineComponent, h, nextTick } from "vue"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import { useDataGridContextMenu } from "../useDataGridContextMenu"

async function flushRuntimeTasks() {
  await nextTick()
  await Promise.resolve()
}

describe("useDataGridContextMenu contract", () => {
  it("derives header/cell actions deterministically and supports open/close", async () => {
    let api: ReturnType<typeof useDataGridContextMenu> | null = null

    const Host = defineComponent({
      name: "ContextMenuContractHost",
      setup() {
        api = useDataGridContextMenu({
          isColumnResizable(columnKey) {
            return columnKey === "owner"
          },
        })
        return () => h("div", { ref: api!.contextMenuRef }, [
          ...api!.contextMenuActions.value.map(action =>
            h("button", { "data-datagrid-menu-action": action.id, type: "button" }, action.label),
          ),
        ])
      },
    })

    const wrapper = mount(Host)
    await flushRuntimeTasks()

    expect(api).not.toBeNull()
    expect(api!.contextMenu.value.visible).toBe(false)

    api!.openContextMenu(128, 72, { zone: "header", columnKey: "owner" })
    await flushRuntimeTasks()
    expect(api!.contextMenu.value.visible).toBe(true)
    expect(api!.contextMenuStyle.value.left).toBe("128px")
    expect(api!.contextMenuActions.value.map(action => action.id)).toEqual([
      "sort-asc",
      "sort-desc",
      "sort-clear",
      "filter",
      "auto-size",
    ])

    api!.openContextMenu(128, 72, { zone: "header", columnKey: "select" })
    await flushRuntimeTasks()
    expect(api!.contextMenuActions.value.map(action => action.id)).toEqual([
      "sort-asc",
      "sort-desc",
      "sort-clear",
      "filter",
    ])

    api!.openContextMenu(64, 40, { zone: "cell" })
    await flushRuntimeTasks()
    expect(api!.contextMenuActions.value.map(action => action.id)).toEqual([
      "cut",
      "paste",
      "copy",
      "clear",
    ])

    api!.closeContextMenu()
    expect(api!.contextMenu.value.visible).toBe(false)
    expect(api!.contextMenuActions.value).toEqual([])

    wrapper.unmount()
  })

  it("handles keyboard navigation and escape callback", async () => {
    const onEscape = vi.fn()
    let api: ReturnType<typeof useDataGridContextMenu> | null = null

    const Host = defineComponent({
      name: "ContextMenuKeyboardHost",
      setup() {
        api = useDataGridContextMenu()
        return () => h("div", {
          ref: api!.contextMenuRef,
          tabindex: -1,
          onKeydown(event: KeyboardEvent) {
            api!.onContextMenuKeyDown(event, { onEscape })
          },
        }, api!.contextMenuActions.value.map(action =>
          h("button", { "data-datagrid-menu-action": action.id, type: "button" }, action.label),
        ))
      },
    })

    const wrapper = mount(Host)
    await flushRuntimeTasks()

    api!.openContextMenu(40, 40, { zone: "cell" })
    await flushRuntimeTasks()

    const buttons = wrapper.findAll("button[data-datagrid-menu-action]")
    expect(buttons).toHaveLength(4)
    expect(buttons[0]?.element).toBe(document.activeElement)

    await wrapper.trigger("keydown", { key: "ArrowDown" })
    expect(buttons[1]?.element).toBe(document.activeElement)

    await wrapper.trigger("keydown", { key: "End" })
    expect(buttons[3]?.element).toBe(document.activeElement)

    await wrapper.trigger("keydown", { key: "Escape" })
    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(api!.contextMenu.value.visible).toBe(false)

    wrapper.unmount()
  })
})
