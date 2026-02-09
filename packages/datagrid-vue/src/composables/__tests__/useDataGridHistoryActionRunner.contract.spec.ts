import { describe, expect, it, vi } from "vitest"
import { useDataGridHistoryActionRunner } from "../useDataGridHistoryActionRunner"

describe("useDataGridHistoryActionRunner contract", () => {
  it("returns false when undo/redo stacks are empty", async () => {
    const setLastAction = vi.fn()
    const runner = useDataGridHistoryActionRunner({
      hasInlineEditor: () => false,
      commitInlineEdit: vi.fn(),
      closeContextMenu: vi.fn(),
      canUndo: () => false,
      canRedo: () => false,
      runHistoryAction: vi.fn(),
      setLastAction,
    })

    expect(await runner.runHistoryAction("undo", "keyboard")).toBe(false)
    expect(await runner.runHistoryAction("redo", "keyboard")).toBe(false)
    expect(setLastAction).toHaveBeenNthCalledWith(1, "Nothing to undo")
    expect(setLastAction).toHaveBeenNthCalledWith(2, "Nothing to redo")
  })

  it("commits inline editor, runs action and reports success", async () => {
    const commitInlineEdit = vi.fn()
    const closeContextMenu = vi.fn()
    const setLastAction = vi.fn()
    const runner = useDataGridHistoryActionRunner({
      hasInlineEditor: () => true,
      commitInlineEdit,
      closeContextMenu,
      canUndo: () => true,
      canRedo: () => true,
      runHistoryAction: async direction => (direction === "undo" ? "tx-1" : "tx-2"),
      setLastAction,
    })

    expect(await runner.runHistoryAction("undo", "keyboard")).toBe(true)
    expect(await runner.runHistoryAction("redo", "control")).toBe(true)
    expect(commitInlineEdit).toHaveBeenCalledTimes(2)
    expect(closeContextMenu).toHaveBeenCalledTimes(2)
    expect(setLastAction).toHaveBeenNthCalledWith(1, "Undo tx-1 (keyboard)")
    expect(setLastAction).toHaveBeenNthCalledWith(2, "Redo tx-2 (control)")
  })
})
