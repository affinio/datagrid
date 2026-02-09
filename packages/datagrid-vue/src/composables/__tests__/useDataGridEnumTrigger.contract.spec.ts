import { describe, expect, it, vi } from "vitest"
import { useDataGridEnumTrigger } from "../useDataGridEnumTrigger"

interface Row {
  data: { rowId: string }
}

describe("useDataGridEnumTrigger contract", () => {
  it("shows trigger only for enum active cell when no interaction conflicts", () => {
    const trigger = useDataGridEnumTrigger<Row, { rowIndex: number; columnIndex: number }, { rowId: string }>({
      isEnumColumn: columnKey => columnKey === "severity",
      isInlineEditorOpen: () => false,
      isDragSelecting: () => false,
      isFillDragging: () => false,
      isActiveCell: () => true,
      resolveCellCoord: () => ({ rowIndex: 1, columnIndex: 2 }),
      applyCellSelection: vi.fn(),
      resolveRowData: row => row.data,
      beginInlineEdit: vi.fn(),
    })

    expect(trigger.shouldShowEnumTrigger({ data: { rowId: "r1" } }, "severity")).toBe(true)
    expect(trigger.shouldShowEnumTrigger({ data: { rowId: "r1" } }, "owner")).toBe(false)
  })

  it("handles mouse down and starts select editor", () => {
    const applyCellSelection = vi.fn()
    const beginInlineEdit = vi.fn()
    const trigger = useDataGridEnumTrigger<Row, { rowIndex: number; columnIndex: number }, { rowId: string }>({
      isEnumColumn: () => true,
      isInlineEditorOpen: () => false,
      isDragSelecting: () => false,
      isFillDragging: () => false,
      isActiveCell: () => true,
      resolveCellCoord: () => ({ rowIndex: 3, columnIndex: 4 }),
      applyCellSelection,
      resolveRowData: row => row.data,
      beginInlineEdit,
    })

    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const handled = trigger.onEnumTriggerMouseDown(
      { data: { rowId: "r1" } },
      "severity",
      { preventDefault, stopPropagation } as unknown as MouseEvent,
    )

    expect(handled).toBe(true)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(applyCellSelection).toHaveBeenCalledWith({ rowIndex: 3, columnIndex: 4 }, false)
    expect(beginInlineEdit).toHaveBeenCalledWith({ rowId: "r1" }, "severity", "select", true)
  })
})
