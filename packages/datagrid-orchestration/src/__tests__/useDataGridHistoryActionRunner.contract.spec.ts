import { describe, expect, it, vi } from "vitest"
import { useDataGridHistoryActionRunner } from "../history/useDataGridHistoryActionRunner"

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

  it("rejects overlapping history actions before committing editor state", async () => {
    let resolveAction: (value: string | null) => void = () => undefined
    const pendingAction = new Promise<string | null>(resolve => {
      resolveAction = resolve
    })
    const commitInlineEdit = vi.fn()
    const closeContextMenu = vi.fn()
    const runHistoryAction = vi.fn(async () => pendingAction)
    const setLastAction = vi.fn()
    const runner = useDataGridHistoryActionRunner({
      hasInlineEditor: () => true,
      commitInlineEdit,
      closeContextMenu,
      canUndo: () => true,
      canRedo: () => true,
      runHistoryAction,
      setLastAction,
    })

    const undoPromise = runner.runHistoryAction("undo", "keyboard")
    expect(runner.isHistoryActionPending()).toBe(true)
    await expect(runner.runHistoryAction("redo", "control")).resolves.toBe(false)

    expect(runHistoryAction).toHaveBeenCalledTimes(1)
    expect(commitInlineEdit).toHaveBeenCalledTimes(1)
    expect(closeContextMenu).toHaveBeenCalledTimes(1)
    expect(setLastAction).toHaveBeenCalledWith("History action in progress")

    resolveAction("tx-1")
    await expect(undoPromise).resolves.toBe(true)
    expect(runner.isHistoryActionPending()).toBe(false)
    expect(setLastAction).toHaveBeenLastCalledWith("Undo tx-1 (keyboard)")
  })
})
