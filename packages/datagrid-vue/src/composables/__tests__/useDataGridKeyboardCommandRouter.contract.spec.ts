import { describe, expect, it, vi } from "vitest"
import { useDataGridKeyboardCommandRouter } from "../useDataGridKeyboardCommandRouter"

function createEvent(key: string, init: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, cancelable: true, ...init })
}

describe("useDataGridKeyboardCommandRouter contract", () => {
  it("routes history and clipboard shortcuts deterministically", () => {
    const runHistoryAction = vi.fn(async () => true)
    const copySelection = vi.fn(async () => true)
    const pasteSelection = vi.fn(async () => true)
    const cutSelection = vi.fn(async () => true)

    const router = useDataGridKeyboardCommandRouter({
      isRangeMoving: () => false,
      isContextMenuVisible: () => false,
      closeContextMenu: vi.fn(),
      focusViewport: vi.fn(),
      openContextMenuFromCurrentCell: vi.fn(),
      runHistoryAction,
      copySelection,
      pasteSelection,
      cutSelection,
      stopRangeMove: vi.fn(),
      setLastAction: vi.fn(),
    })

    const undoEvent = createEvent("z", { ctrlKey: true })
    expect(router.dispatchKeyboardCommands(undoEvent)).toBe(true)
    expect(undoEvent.defaultPrevented).toBe(true)
    expect(runHistoryAction).toHaveBeenCalledWith("undo", "keyboard")

    const redoShiftEvent = createEvent("z", { metaKey: true, shiftKey: true })
    expect(router.dispatchKeyboardCommands(redoShiftEvent)).toBe(true)
    expect(runHistoryAction).toHaveBeenCalledWith("redo", "keyboard")

    const redoEvent = createEvent("y", { ctrlKey: true })
    expect(router.dispatchKeyboardCommands(redoEvent)).toBe(true)
    expect(runHistoryAction).toHaveBeenCalledWith("redo", "keyboard")

    const copyEvent = createEvent("c", { ctrlKey: true })
    expect(router.dispatchKeyboardCommands(copyEvent)).toBe(true)
    expect(copySelection).toHaveBeenCalledWith("keyboard")

    const pasteEvent = createEvent("v", { metaKey: true })
    expect(router.dispatchKeyboardCommands(pasteEvent)).toBe(true)
    expect(pasteSelection).toHaveBeenCalledWith("keyboard")

    const cutEvent = createEvent("x", { ctrlKey: true })
    expect(router.dispatchKeyboardCommands(cutEvent)).toBe(true)
    expect(cutSelection).toHaveBeenCalledWith("keyboard")
  })

  it("handles range-moving and context menu guards with focus/escape semantics", () => {
    const closeContextMenu = vi.fn()
    const focusViewport = vi.fn()
    const stopRangeMove = vi.fn()
    const setLastAction = vi.fn()
    const openContextMenuFromCurrentCell = vi.fn()

    let isRangeMoving = true
    let isContextMenuVisible = false

    const router = useDataGridKeyboardCommandRouter({
      isRangeMoving: () => isRangeMoving,
      isContextMenuVisible: () => isContextMenuVisible,
      closeContextMenu,
      focusViewport,
      openContextMenuFromCurrentCell,
      runHistoryAction: vi.fn(async () => true),
      copySelection: vi.fn(async () => true),
      pasteSelection: vi.fn(async () => true),
      cutSelection: vi.fn(async () => true),
      stopRangeMove,
      setLastAction,
    })

    const escDuringMove = createEvent("Escape")
    expect(router.dispatchKeyboardCommands(escDuringMove)).toBe(true)
    expect(stopRangeMove).toHaveBeenCalledWith(false)
    expect(setLastAction).toHaveBeenCalledWith("Move canceled")

    isRangeMoving = false
    isContextMenuVisible = true
    const escMenu = createEvent("Escape")
    expect(router.dispatchKeyboardCommands(escMenu)).toBe(true)
    expect(closeContextMenu).toHaveBeenCalled()
    expect(focusViewport).toHaveBeenCalled()

    const arrowMenu = createEvent("ArrowDown")
    expect(router.dispatchKeyboardCommands(arrowMenu)).toBe(true)
    expect(arrowMenu.defaultPrevented).toBe(true)

    isContextMenuVisible = false
    const contextMenuKey = createEvent("ContextMenu")
    expect(router.dispatchKeyboardCommands(contextMenuKey)).toBe(true)
    expect(openContextMenuFromCurrentCell).toHaveBeenCalled()
  })
})
