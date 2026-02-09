import { describe, expect, it, vi } from "vitest"
import { useDataGridCellPointerDownRouter } from "../useDataGridCellPointerDownRouter"

function createEvent(init: MouseEventInit = {}): MouseEvent {
  return new MouseEvent("mousedown", { bubbles: true, cancelable: true, ...init })
}

describe("useDataGridCellPointerDownRouter contract", () => {
  it("starts range move when modifier is active and coord is inside range", () => {
    const startRangeMove = vi.fn()
    const router = useDataGridCellPointerDownRouter({
      isSelectionColumn: () => false,
      isRangeMoveModifierActive: () => true,
      isEditorInteractionTarget: () => false,
      hasInlineEditor: () => false,
      commitInlineEdit: vi.fn(() => true),
      resolveCellCoord: () => ({ rowIndex: 4, columnIndex: 3 }),
      resolveSelectionRange: () => ({ startRow: 2, endRow: 6, startColumn: 2, endColumn: 4 }),
      isCoordInsideRange: () => true,
      startRangeMove,
      closeContextMenu: vi.fn(),
      focusViewport: vi.fn(),
      isFillDragging: () => false,
      stopFillSelection: vi.fn(),
      setDragSelecting: vi.fn(),
      setLastDragCoord: vi.fn(),
      setDragPointer: vi.fn(),
      applyCellSelection: vi.fn(),
      startInteractionAutoScroll: vi.fn(),
      setLastAction: vi.fn(),
    })

    const event = createEvent({ button: 0, clientX: 40, clientY: 70 })
    expect(router.dispatchCellPointerDown({ rowId: "R5" }, "owner", event)).toBe(true)
    expect(event.defaultPrevented).toBe(true)
    expect(startRangeMove).toHaveBeenCalledWith(
      { rowIndex: 4, columnIndex: 3 },
      { clientX: 40, clientY: 70 },
    )
  })

  it("starts drag selection flow for regular cell pointer-down", () => {
    const setDragSelecting = vi.fn()
    const setLastDragCoord = vi.fn()
    const setDragPointer = vi.fn()
    const applyCellSelection = vi.fn()
    const startInteractionAutoScroll = vi.fn()
    const setLastAction = vi.fn()
    const stopFillSelection = vi.fn()
    const commitInlineEdit = vi.fn(() => true)

    const router = useDataGridCellPointerDownRouter({
      isSelectionColumn: () => false,
      isRangeMoveModifierActive: () => false,
      isEditorInteractionTarget: () => false,
      hasInlineEditor: () => true,
      commitInlineEdit,
      resolveCellCoord: () => ({ rowIndex: 1, columnIndex: 2 }),
      resolveSelectionRange: () => null,
      isCoordInsideRange: () => false,
      startRangeMove: vi.fn(),
      closeContextMenu: vi.fn(),
      focusViewport: vi.fn(),
      isFillDragging: () => true,
      stopFillSelection,
      setDragSelecting,
      setLastDragCoord,
      setDragPointer,
      applyCellSelection,
      startInteractionAutoScroll,
      setLastAction,
    })

    const event = createEvent({ button: 0, shiftKey: true, clientX: 12, clientY: 19 })
    expect(router.dispatchCellPointerDown({ rowId: "R2" }, "service", event)).toBe(true)
    expect(commitInlineEdit).toHaveBeenCalledTimes(1)
    expect(stopFillSelection).toHaveBeenCalledWith(false)
    expect(setDragSelecting).toHaveBeenCalledWith(true)
    expect(setLastDragCoord).toHaveBeenCalledWith({ rowIndex: 1, columnIndex: 2 })
    expect(setDragPointer).toHaveBeenCalledWith({ clientX: 12, clientY: 19 })
    expect(applyCellSelection).toHaveBeenCalledWith({ rowIndex: 1, columnIndex: 2 }, true, { rowIndex: 1, columnIndex: 2 })
    expect(startInteractionAutoScroll).toHaveBeenCalledTimes(1)
    expect(setLastAction).toHaveBeenCalledWith("Extended selection to R2 · service")
  })

  it("ignores non-cell cases (selection column, editor target, invalid button)", () => {
    const router = useDataGridCellPointerDownRouter({
      isSelectionColumn: (columnKey: string) => columnKey === "select",
      isRangeMoveModifierActive: () => false,
      isEditorInteractionTarget: (target: HTMLElement | null) => !!target?.classList.contains("editor"),
      hasInlineEditor: () => false,
      commitInlineEdit: vi.fn(() => true),
      resolveCellCoord: vi.fn(() => ({ rowIndex: 0, columnIndex: 0 })),
      resolveSelectionRange: () => null,
      isCoordInsideRange: () => false,
      startRangeMove: vi.fn(),
      closeContextMenu: vi.fn(),
      focusViewport: vi.fn(),
      isFillDragging: () => false,
      stopFillSelection: vi.fn(),
      setDragSelecting: vi.fn(),
      setLastDragCoord: vi.fn(),
      setDragPointer: vi.fn(),
      applyCellSelection: vi.fn(),
      startInteractionAutoScroll: vi.fn(),
      setLastAction: vi.fn(),
    })

    const selectEvent = createEvent({ button: 0 })
    expect(router.dispatchCellPointerDown({ rowId: "R1" }, "select", selectEvent)).toBe(false)

    const editorTarget = document.createElement("div")
    editorTarget.classList.add("editor")
    const editorEvent = createEvent({ button: 0 })
    Object.defineProperty(editorEvent, "target", { value: editorTarget })
    expect(router.dispatchCellPointerDown({ rowId: "R1" }, "owner", editorEvent)).toBe(false)

    const secondaryEvent = createEvent({ button: 2 })
    expect(router.dispatchCellPointerDown({ rowId: "R1" }, "owner", secondaryEvent)).toBe(false)
  })
})
