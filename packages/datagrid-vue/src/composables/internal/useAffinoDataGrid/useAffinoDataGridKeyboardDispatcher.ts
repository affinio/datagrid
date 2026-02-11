import type { Ref } from "vue"
import type { UseDataGridRuntimeResult } from "../../useDataGridRuntime"

export interface UseAffinoDataGridKeyboardDispatcherOptions<TRow> {
  enabled: Ref<boolean>
  runtime: UseDataGridRuntimeResult<TRow>
  onHistoryRefresh: () => void
  pushFeedback: (event: {
    source: "history"
    action: "undo" | "redo"
    message: string
    ok?: boolean
  }) => void
  copySelection: () => Promise<boolean>
  pasteSelection: () => Promise<boolean>
  cutSelection: () => Promise<boolean>
  clearSelection: () => Promise<boolean>
}

export interface UseAffinoDataGridKeyboardDispatcherResult {
  dispatch: (event: KeyboardEvent) => boolean
}

const isPrimaryModifierPressed = (event: KeyboardEvent): boolean => (
  event.metaKey || event.ctrlKey
)

export function useAffinoDataGridKeyboardDispatcher<TRow>(
  options: UseAffinoDataGridKeyboardDispatcherOptions<TRow>,
): UseAffinoDataGridKeyboardDispatcherResult {
  const runHistoryActionFromKeyboard = (direction: "undo" | "redo"): void => {
    if (!options.runtime.api.hasTransactionSupport()) {
      return
    }
    void (async () => {
      if (direction === "undo") {
        if (!options.runtime.api.canUndoTransaction()) {
          return
        }
        await options.runtime.api.undoTransaction()
        options.pushFeedback({
          source: "history",
          action: "undo",
          message: "Undo",
          ok: true,
        })
      } else {
        if (!options.runtime.api.canRedoTransaction()) {
          return
        }
        await options.runtime.api.redoTransaction()
        options.pushFeedback({
          source: "history",
          action: "redo",
          message: "Redo",
          ok: true,
        })
      }
      options.onHistoryRefresh()
    })()
  }

  const dispatch = (event: KeyboardEvent): boolean => {
    if (!options.enabled.value) {
      return false
    }
    const key = event.key.toLowerCase()
    const primary = isPrimaryModifierPressed(event)

    if (primary && !event.altKey && key === "z") {
      event.preventDefault()
      runHistoryActionFromKeyboard(event.shiftKey ? "redo" : "undo")
      return true
    }
    if (primary && !event.altKey && !event.shiftKey && key === "y") {
      event.preventDefault()
      runHistoryActionFromKeyboard("redo")
      return true
    }
    if (primary && !event.altKey && key === "c") {
      event.preventDefault()
      void options.copySelection()
      return true
    }
    if (primary && !event.altKey && key === "v") {
      event.preventDefault()
      void options.pasteSelection()
      return true
    }
    if (primary && !event.altKey && key === "x") {
      event.preventDefault()
      void options.cutSelection()
      return true
    }
    if (!primary && !event.altKey && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault()
      void options.clearSelection()
      return true
    }
    return false
  }

  return { dispatch }
}
