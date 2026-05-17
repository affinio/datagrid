import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useDataGridTableStageColumns } from "../useDataGridTableStageColumns"

describe("useDataGridTableStageColumns", () => {
  function createColumn(key: string, pin: "left" | "right" | "none" = "none") {
    return {
      key,
      pin,
      visible: true,
      width: 120,
      state: { visible: true, pin, width: 120 },
      column: { key, label: key.toUpperCase() },
    } as never
  }

  it("defines the system row-selection checkbox through cellInteraction", () => {
    const isSelected = vi.fn((rowId: string | number) => rowId === "r1")
    const setSelected = vi.fn()

    const service = useDataGridTableStageColumns({
      runtime: {
        api: {
          rowSelection: {
            hasSupport: () => true,
            isSelected,
            setSelected,
          },
        },
      } as never,
      visibleColumns: ref([]),
      showRowSelection: ref(true),
    })

    const column = service.rowSelectionColumn.value

    expect(column?.column.cellInteraction).toMatchObject({
      click: true,
      keyboard: ["enter", "space"],
      role: "checkbox",
      label: "Toggle row selection",
    })

    const checked = column?.column.cellInteraction?.checked
    expect(typeof checked === "function" && checked({
      column: column.column,
      rowId: "r1",
      value: true,
      editable: true,
    } as never)).toBe(true)

    column?.column.cellInteraction?.onInvoke({
      column: column.column,
      rowId: "r1",
      value: true,
      editable: true,
      trigger: "click",
    })

    expect(setSelected).toHaveBeenCalledWith("r1", false)
  })

  it("keeps header and pane column projection in pinned-left, center, pinned-right order", () => {
    const service = useDataGridTableStageColumns({
      runtime: {
        api: {
          rowSelection: {
            hasSupport: () => false,
          },
        },
      } as never,
      visibleColumns: ref([
        createColumn("a", "left"),
        createColumn("b", "left"),
        createColumn("d", "left"),
        createColumn("c"),
        createColumn("e"),
        createColumn("f", "right"),
      ]),
      showRowSelection: ref(true),
    })

    expect(service.orderedVisibleColumns.value.map(column => column.key)).toEqual(["a", "b", "d", "c", "e", "f"])
    expect(service.centerColumns.value.map(column => column.key)).toEqual(["c", "e"])
  })
})
