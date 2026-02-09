import { describe, expect, it, vi } from "vitest"
import {
  useDataGridCellNavigation,
  type DataGridNavigationCellCoord,
} from "../useDataGridCellNavigation"

describe("useDataGridCellNavigation contract", () => {
  it("navigates with arrows/page/home/end/tab/enter and applies selection", () => {
    const applied: Array<{ coord: DataGridNavigationCellCoord; extend: boolean; fallback: DataGridNavigationCellCoord | undefined }> = []
    const clearCellSelection = vi.fn()
    const closeContextMenu = vi.fn()
    const setLastAction = vi.fn()

    const router = useDataGridCellNavigation({
      resolveCurrentCellCoord: () => ({ rowIndex: 5, columnIndex: 3 }),
      resolveTabTarget: (current, backwards) => ({
        rowIndex: backwards ? current.rowIndex - 1 : current.rowIndex + 1,
        columnIndex: backwards ? current.columnIndex - 1 : current.columnIndex + 1,
      }),
      normalizeCellCoord: coord => ({ rowIndex: Math.max(0, coord.rowIndex), columnIndex: Math.max(0, coord.columnIndex) }),
      getAdjacentNavigableColumnIndex: (columnIndex, direction) => columnIndex + direction,
      getFirstNavigableColumnIndex: () => 0,
      getLastNavigableColumnIndex: () => 9,
      getLastRowIndex: () => 99,
      resolveStepRows: () => 12,
      closeContextMenu,
      clearCellSelection,
      setLastAction,
      applyCellSelection(nextCoord, extend, fallbackAnchor) {
        applied.push({ coord: nextCoord, extend, fallback: fallbackAnchor })
      },
    })

    expect(router.dispatchNavigation(new KeyboardEvent("keydown", { key: "ArrowUp", cancelable: true }))).toBe(true)
    expect(applied[applied.length - 1]?.coord).toEqual({ rowIndex: 4, columnIndex: 3 })
    expect(applied[applied.length - 1]?.extend).toBe(false)

    expect(router.dispatchNavigation(new KeyboardEvent("keydown", { key: "PageDown", shiftKey: true, cancelable: true }))).toBe(true)
    expect(applied[applied.length - 1]?.coord).toEqual({ rowIndex: 6, columnIndex: 3 })
    expect(applied[applied.length - 1]?.extend).toBe(true)

    expect(router.dispatchNavigation(new KeyboardEvent("keydown", { key: "Home", cancelable: true }))).toBe(true)
    expect(applied[applied.length - 1]?.coord).toEqual({ rowIndex: 5, columnIndex: 0 })

    expect(router.dispatchNavigation(new KeyboardEvent("keydown", { key: "End", metaKey: true, cancelable: true }))).toBe(true)
    expect(applied[applied.length - 1]?.coord).toEqual({ rowIndex: 99, columnIndex: 9 })

    expect(router.dispatchNavigation(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }))).toBe(true)
    expect(applied[applied.length - 1]?.coord).toEqual({ rowIndex: 6, columnIndex: 4 })
    expect(applied[applied.length - 1]?.extend).toBe(false)

    expect(router.dispatchNavigation(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, cancelable: true }))).toBe(true)
    expect(applied[applied.length - 1]?.coord).toEqual({ rowIndex: 4, columnIndex: 3 })
    expect(applied[applied.length - 1]?.extend).toBe(false)
  })

  it("handles escape and no-op conditions", () => {
    const clearCellSelection = vi.fn()
    const closeContextMenu = vi.fn()
    const setLastAction = vi.fn()
    const applyCellSelection = vi.fn()

    const router = useDataGridCellNavigation({
      resolveCurrentCellCoord: () => ({ rowIndex: 1, columnIndex: 1 }),
      resolveTabTarget: () => null,
      normalizeCellCoord: () => null,
      getAdjacentNavigableColumnIndex: (columnIndex, direction) => columnIndex + direction,
      getFirstNavigableColumnIndex: () => 0,
      getLastNavigableColumnIndex: () => 5,
      getLastRowIndex: () => 10,
      resolveStepRows: () => 5,
      closeContextMenu,
      clearCellSelection,
      setLastAction,
      applyCellSelection,
    })

    expect(router.dispatchNavigation(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }))).toBe(true)
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
    expect(clearCellSelection).toHaveBeenCalledTimes(1)
    expect(setLastAction).toHaveBeenCalledWith("Cleared cell selection")
    expect(applyCellSelection).not.toHaveBeenCalled()

    expect(router.dispatchNavigation(new KeyboardEvent("keydown", { key: "A", cancelable: true }))).toBe(false)
  })
})
