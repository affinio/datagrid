import { describe, expect, it, vi } from "vitest"
import { useDataGridHeaderContextActions } from "../useDataGridHeaderContextActions"

describe("useDataGridHeaderContextActions contract", () => {
  it("executes sort/filter/auto-size actions and closes context menu", () => {
    const applyExplicitSort = vi.fn()
    const openColumnFilter = vi.fn()
    const estimateColumnAutoWidth = vi.fn(() => 321)
    const setColumnWidth = vi.fn()
    const closeContextMenu = vi.fn()
    const setLastAction = vi.fn()

    const api = useDataGridHeaderContextActions({
      isSortableColumn: columnKey => columnKey !== "select",
      applyExplicitSort,
      openColumnFilter,
      estimateColumnAutoWidth,
      setColumnWidth,
      closeContextMenu,
      setLastAction,
    })

    expect(api.runHeaderContextAction("sort-asc", "owner")).toBe(true)
    expect(applyExplicitSort).toHaveBeenCalledWith("owner", "asc")
    expect(setLastAction).toHaveBeenCalledWith("Sorted owner asc")

    expect(api.runHeaderContextAction("sort-desc", "owner")).toBe(true)
    expect(applyExplicitSort).toHaveBeenCalledWith("owner", "desc")

    expect(api.runHeaderContextAction("sort-clear", "owner")).toBe(true)
    expect(applyExplicitSort).toHaveBeenCalledWith("owner", null)

    expect(api.runHeaderContextAction("filter", "owner")).toBe(true)
    expect(openColumnFilter).toHaveBeenCalledWith("owner")

    expect(api.runHeaderContextAction("auto-size", "owner")).toBe(true)
    expect(estimateColumnAutoWidth).toHaveBeenCalledWith("owner")
    expect(setColumnWidth).toHaveBeenCalledWith("owner", 321)

    expect(closeContextMenu).toHaveBeenCalledTimes(5)
  })

  it("rejects non-header actions and non-sortable columns for sort/filter actions", () => {
    const applyExplicitSort = vi.fn()
    const openColumnFilter = vi.fn()
    const estimateColumnAutoWidth = vi.fn(() => 200)
    const setColumnWidth = vi.fn()
    const closeContextMenu = vi.fn()
    const setLastAction = vi.fn()

    const api = useDataGridHeaderContextActions({
      isSortableColumn: columnKey => columnKey !== "select",
      applyExplicitSort,
      openColumnFilter,
      estimateColumnAutoWidth,
      setColumnWidth,
      closeContextMenu,
      setLastAction,
    })

    expect(api.runHeaderContextAction("sort-asc", "select")).toBe(false)
    expect(api.runHeaderContextAction("filter", "select")).toBe(false)
    expect(api.runHeaderContextAction("copy", "owner")).toBe(false)

    expect(applyExplicitSort).not.toHaveBeenCalled()
    expect(openColumnFilter).not.toHaveBeenCalled()
    expect(closeContextMenu).not.toHaveBeenCalled()

    expect(api.runHeaderContextAction("auto-size", "select")).toBe(true)
    expect(setColumnWidth).toHaveBeenCalledWith("select", 200)
  })
})
