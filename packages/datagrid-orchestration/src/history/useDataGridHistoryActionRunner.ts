export interface UseDataGridHistoryActionRunnerOptions {
  hasInlineEditor: () => boolean
  commitInlineEdit: () => void
  closeContextMenu: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  runHistoryAction: (direction: "undo" | "redo") => Promise<string | null>
  setLastAction: (message: string) => void
  onError?: (direction: "undo" | "redo", error: unknown) => void
}

export interface UseDataGridHistoryActionRunnerResult {
  runHistoryAction: (
    direction: "undo" | "redo",
    trigger: "keyboard" | "control",
  ) => Promise<boolean>
}

export function useDataGridHistoryActionRunner(
  options: UseDataGridHistoryActionRunnerOptions,
): UseDataGridHistoryActionRunnerResult {
  async function runHistoryAction(
    direction: "undo" | "redo",
    trigger: "keyboard" | "control",
  ): Promise<boolean> {
    if (options.hasInlineEditor()) {
      options.commitInlineEdit()
    }
    options.closeContextMenu()
    if (direction === "undo" && !options.canUndo()) {
      options.setLastAction("Nothing to undo")
      return false
    }
    if (direction === "redo" && !options.canRedo()) {
      options.setLastAction("Nothing to redo")
      return false
    }

    try {
      const committedId = await options.runHistoryAction(direction)
      if (!committedId) {
        options.setLastAction(direction === "undo" ? "Nothing to undo" : "Nothing to redo")
        return false
      }
      options.setLastAction(
        direction === "undo"
          ? `Undo ${committedId} (${trigger})`
          : `Redo ${committedId} (${trigger})`,
      )
      return true
    } catch (error) {
      options.onError?.(direction, error)
      options.setLastAction(direction === "undo" ? "Undo failed" : "Redo failed")
      return false
    }
  }

  return {
    runHistoryAction,
  }
}

