import { describe, expect, it, vi } from "vitest"
import { useDataGridContextMenuAnchor } from "../useDataGridContextMenuAnchor"

function createRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect
}

describe("useDataGridContextMenuAnchor contract", () => {
  it("opens context menu from active cell anchor and keeps range zone", () => {
    const openContextMenu = vi.fn()
    const viewport = {
      querySelector: vi.fn(() => ({
        getBoundingClientRect: () => createRect(100, 40, 80, 30),
      })),
      getBoundingClientRect: () => createRect(0, 0, 500, 300),
    } as unknown as HTMLElement

    const anchor = useDataGridContextMenuAnchor({
      resolveCurrentCellCoord: () => ({ rowIndex: 4, columnIndex: 2 }),
      resolveViewportElement: () => viewport,
      resolveRowAtIndex: () => ({ rowId: "R5" }),
      resolveColumnAtIndex: () => ({ key: "service" }),
      resolveSelectionRange: () => ({
        startRow: 4,
        endRow: 6,
        startColumn: 2,
        endColumn: 3,
      }),
      isMultiCellSelection: () => true,
      isCoordInsideRange: () => true,
      openContextMenu,
    })

    expect(anchor.openContextMenuFromCurrentCell()).toBe(true)
    expect(openContextMenu).toHaveBeenCalledWith(
      140,
      66,
      {
        zone: "range",
        columnKey: "service",
        rowId: "R5",
      },
    )
  })

  it("falls back to viewport anchor when cell is not rendered", () => {
    const openContextMenu = vi.fn()
    const viewport = {
      querySelector: vi.fn(() => null),
      getBoundingClientRect: () => createRect(10, 20, 100, 80),
    } as unknown as HTMLElement

    const anchor = useDataGridContextMenuAnchor({
      resolveCurrentCellCoord: () => ({ rowIndex: 1, columnIndex: 1 }),
      resolveViewportElement: () => viewport,
      resolveRowAtIndex: () => ({ rowId: "A-2" }),
      resolveColumnAtIndex: () => ({ key: "owner" }),
      resolveSelectionRange: () => null,
      isMultiCellSelection: () => false,
      isCoordInsideRange: () => false,
      openContextMenu,
    })

    expect(anchor.openContextMenuFromCurrentCell()).toBe(true)
    expect(openContextMenu).toHaveBeenCalledWith(
      40,
      52,
      {
        zone: "cell",
        columnKey: "owner",
        rowId: "A-2",
      },
    )
  })

  it("returns false when active column is disabled for context menu", () => {
    const openContextMenu = vi.fn()
    const anchor = useDataGridContextMenuAnchor({
      resolveCurrentCellCoord: () => ({ rowIndex: 0, columnIndex: 0 }),
      resolveViewportElement: () => ({
        querySelector: () => null,
        getBoundingClientRect: () => createRect(0, 0, 120, 80),
      } as unknown as HTMLElement),
      resolveRowAtIndex: () => ({ rowId: "R1" }),
      resolveColumnAtIndex: () => ({ key: "select" }),
      resolveSelectionRange: () => null,
      isMultiCellSelection: () => false,
      isCoordInsideRange: () => false,
      openContextMenu,
      isColumnContextEnabled: column => column.key !== "select",
    })

    expect(anchor.openContextMenuFromCurrentCell()).toBe(false)
    expect(openContextMenu).not.toHaveBeenCalled()
  })
})
