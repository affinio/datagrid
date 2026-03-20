import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useDataGridTableStageColumns } from "../useDataGridTableStageColumns"

describe("useDataGridTableStageColumns", () => {
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

    expect(column?.column.cellInteraction?.checked?.({
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
})