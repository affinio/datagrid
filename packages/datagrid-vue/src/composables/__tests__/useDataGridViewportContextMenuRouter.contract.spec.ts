import { describe, expect, it, vi } from "vitest"
import { useDataGridViewportContextMenuRouter } from "../useDataGridViewportContextMenuRouter"

function createMouseEvent(type: string): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 120, clientY: 48 })
}

describe("useDataGridViewportContextMenuRouter contract", () => {
  it("opens header context menu when header cell is targeted", () => {
    const openContextMenu = vi.fn()
    const header = document.createElement("div")
    header.className = "datagrid-stage__cell--header"
    header.dataset.columnKey = "latencyMs"
    const wrapper = document.createElement("div")
    wrapper.appendChild(header)

    const router = useDataGridViewportContextMenuRouter({
      isInteractionBlocked: () => false,
      isRangeMoveModifierActive: () => false,
      resolveSelectionRange: () => null,
      resolveCellCoordFromDataset: vi.fn(() => null),
      applyCellSelection: vi.fn(),
      resolveActiveCellCoord: vi.fn(() => null),
      setActiveCellCoord: vi.fn(),
      cellCoordsEqual: vi.fn(() => true),
      isMultiCellSelection: () => false,
      isCoordInsideRange: () => false,
      openContextMenu,
      closeContextMenu: vi.fn(),
    })

    const event = createMouseEvent("contextmenu")
    Object.defineProperty(event, "target", { value: header })

    expect(router.dispatchViewportContextMenu(event)).toBe(true)
    expect(event.defaultPrevented).toBe(true)
    expect(openContextMenu).toHaveBeenCalledWith(120, 48, { zone: "header", columnKey: "latencyMs" })
  })

  it("syncs selection and opens cell/range context menu", () => {
    const openContextMenu = vi.fn()
    const applyCellSelection = vi.fn()
    const setActiveCellCoord = vi.fn()
    const coord = { rowIndex: 2, columnIndex: 3 }
    let currentRange: {
      startRow: number
      endRow: number
      startColumn: number
      endColumn: number
    } | null = {
      startRow: 1,
      endRow: 3,
      startColumn: 2,
      endColumn: 4,
    }

    const cell = document.createElement("div")
    cell.className = "datagrid-stage__cell"
    cell.dataset.rowId = "R3"
    cell.dataset.columnKey = "owner"
    const wrapper = document.createElement("div")
    wrapper.appendChild(cell)

    const router = useDataGridViewportContextMenuRouter({
      isInteractionBlocked: () => false,
      isRangeMoveModifierActive: () => false,
      resolveSelectionRange: () => currentRange,
      resolveCellCoordFromDataset: vi.fn(() => coord),
      applyCellSelection,
      resolveActiveCellCoord: () => ({ rowIndex: 0, columnIndex: 0 }),
      setActiveCellCoord,
      cellCoordsEqual: (a, b) => !!a && !!b && a.rowIndex === b.rowIndex && a.columnIndex === b.columnIndex,
      isMultiCellSelection: () => true,
      isCoordInsideRange: () => true,
      openContextMenu,
      closeContextMenu: vi.fn(),
    })

    const event = createMouseEvent("contextmenu")
    Object.defineProperty(event, "target", { value: cell })

    expect(router.dispatchViewportContextMenu(event)).toBe(true)
    expect(setActiveCellCoord).toHaveBeenCalledWith(coord)
    expect(applyCellSelection).not.toHaveBeenCalled()
    expect(openContextMenu).toHaveBeenCalledWith(120, 48, {
      zone: "range",
      columnKey: "owner",
      rowId: "R3",
    })

    currentRange = null
    const routerOutside = useDataGridViewportContextMenuRouter({
      isInteractionBlocked: () => false,
      isRangeMoveModifierActive: () => false,
      resolveSelectionRange: () => currentRange,
      resolveCellCoordFromDataset: vi.fn(() => coord),
      applyCellSelection,
      resolveActiveCellCoord: () => coord,
      setActiveCellCoord,
      cellCoordsEqual: (a, b) => !!a && !!b && a.rowIndex === b.rowIndex && a.columnIndex === b.columnIndex,
      isMultiCellSelection: () => false,
      isCoordInsideRange: () => false,
      openContextMenu,
      closeContextMenu: vi.fn(),
    })

    const eventOutside = createMouseEvent("contextmenu")
    Object.defineProperty(eventOutside, "target", { value: cell })
    expect(routerOutside.dispatchViewportContextMenu(eventOutside)).toBe(true)
    expect(applyCellSelection).toHaveBeenCalledWith(coord, false, coord, false)
  })

  it("blocks or closes menu in guard paths", () => {
    const closeContextMenu = vi.fn()
    const router = useDataGridViewportContextMenuRouter({
      isInteractionBlocked: () => true,
      isRangeMoveModifierActive: () => false,
      resolveSelectionRange: () => null,
      resolveCellCoordFromDataset: vi.fn(() => null),
      applyCellSelection: vi.fn(),
      resolveActiveCellCoord: vi.fn(() => null),
      setActiveCellCoord: vi.fn(),
      cellCoordsEqual: vi.fn(() => true),
      isMultiCellSelection: () => false,
      isCoordInsideRange: () => false,
      openContextMenu: vi.fn(),
      closeContextMenu,
    })
    const blockedEvent = createMouseEvent("contextmenu")
    Object.defineProperty(blockedEvent, "target", { value: document.createElement("div") })
    expect(router.dispatchViewportContextMenu(blockedEvent)).toBe(true)
    expect(blockedEvent.defaultPrevented).toBe(true)

    const routerClose = useDataGridViewportContextMenuRouter({
      isInteractionBlocked: () => false,
      isRangeMoveModifierActive: () => false,
      resolveSelectionRange: () => null,
      resolveCellCoordFromDataset: vi.fn(() => null),
      applyCellSelection: vi.fn(),
      resolveActiveCellCoord: vi.fn(() => null),
      setActiveCellCoord: vi.fn(),
      cellCoordsEqual: vi.fn(() => true),
      isMultiCellSelection: () => false,
      isCoordInsideRange: () => false,
      openContextMenu: vi.fn(),
      closeContextMenu,
    })
    const emptyTarget = document.createElement("div")
    const closeEvent = createMouseEvent("contextmenu")
    Object.defineProperty(closeEvent, "target", { value: emptyTarget })
    expect(routerClose.dispatchViewportContextMenu(closeEvent)).toBe(true)
    expect(closeContextMenu).toHaveBeenCalled()
  })
})
