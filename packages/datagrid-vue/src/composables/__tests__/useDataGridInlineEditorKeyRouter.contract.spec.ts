import { describe, expect, it, vi } from "vitest"
import { useDataGridInlineEditorKeyRouter } from "../useDataGridInlineEditorKeyRouter"

describe("useDataGridInlineEditorKeyRouter contract", () => {
  it("handles Escape and Enter deterministically", () => {
    const cancelInlineEdit = vi.fn()
    const commitInlineEdit = vi.fn(() => true)
    const resolveNextEditableTarget = vi.fn(() => null)
    const focusInlineEditorTarget = vi.fn()

    const router = useDataGridInlineEditorKeyRouter({
      isEditableColumn: () => true,
      cancelInlineEdit,
      commitInlineEdit,
      resolveNextEditableTarget,
      focusInlineEditorTarget,
    })

    const esc = new KeyboardEvent("keydown", { key: "Escape", cancelable: true })
    expect(router.dispatchEditorKeyDown(esc, "r1", "owner")).toBe(true)
    expect(esc.defaultPrevented).toBe(true)
    expect(cancelInlineEdit).toHaveBeenCalledTimes(1)

    const enter = new KeyboardEvent("keydown", { key: "Enter", cancelable: true })
    expect(router.dispatchEditorKeyDown(enter, "r1", "owner")).toBe(true)
    expect(enter.defaultPrevented).toBe(true)
    expect(commitInlineEdit).toHaveBeenCalledTimes(1)
  })

  it("handles Tab/Shift+Tab focus transfer and ignores non-editable columns", () => {
    const commitInlineEdit = vi.fn(() => true)
    const resolveNextEditableTarget = vi.fn((_rowId: string, _columnKey: string, direction: 1 | -1) => (
      direction === 1
        ? { rowId: "r2", columnKey: "owner", rowIndex: 1, columnIndex: 2 }
        : { rowId: "r1", columnKey: "service", rowIndex: 0, columnIndex: 1 }
    ))
    const focusInlineEditorTarget = vi.fn()

    const router = useDataGridInlineEditorKeyRouter({
      isEditableColumn: columnKey => columnKey !== "select",
      cancelInlineEdit: vi.fn(),
      commitInlineEdit,
      resolveNextEditableTarget,
      focusInlineEditorTarget,
    })

    const tab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true })
    expect(router.dispatchEditorKeyDown(tab, "r1", "owner")).toBe(true)
    expect(commitInlineEdit).toHaveBeenCalledTimes(1)
    expect(resolveNextEditableTarget).toHaveBeenCalledWith("r1", "owner", 1)
    expect(focusInlineEditorTarget).toHaveBeenCalledWith({
      rowId: "r2",
      columnKey: "owner",
      rowIndex: 1,
      columnIndex: 2,
    })

    const shiftTab = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true })
    expect(router.dispatchEditorKeyDown(shiftTab, "r2", "owner")).toBe(true)
    expect(resolveNextEditableTarget).toHaveBeenCalledWith("r2", "owner", -1)

    const nonEditable = new KeyboardEvent("keydown", { key: "Enter", cancelable: true })
    expect(router.dispatchEditorKeyDown(nonEditable, "r1", "select")).toBe(false)
  })
})
