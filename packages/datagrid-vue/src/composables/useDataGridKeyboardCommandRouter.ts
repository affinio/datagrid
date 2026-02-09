export interface UseDataGridKeyboardCommandRouterOptions {
  isRangeMoving: () => boolean
  isContextMenuVisible: () => boolean
  closeContextMenu: () => void
  focusViewport: () => void
  openContextMenuFromCurrentCell: () => void
  runHistoryAction: (direction: "undo" | "redo", trigger: "keyboard") => Promise<boolean>
  copySelection: (trigger: "keyboard") => Promise<boolean>
  pasteSelection: (trigger: "keyboard") => Promise<boolean>
  cutSelection: (trigger: "keyboard") => Promise<boolean>
  stopRangeMove: (commit: boolean) => void
  setLastAction: (message: string) => void
}

export interface UseDataGridKeyboardCommandRouterResult {
  dispatchKeyboardCommands: (event: KeyboardEvent) => boolean
}

function isPrimaryModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey
}

function prevent(event: KeyboardEvent) {
  event.preventDefault()
}

function isMenuNavigationKey(event: KeyboardEvent): boolean {
  return (
    event.key.startsWith("Arrow") ||
    event.key === "Home" ||
    event.key === "End" ||
    event.key === "PageUp" ||
    event.key === "PageDown" ||
    event.key === "Tab" ||
    event.key === "Enter" ||
    event.key === " "
  )
}

export function useDataGridKeyboardCommandRouter(
  options: UseDataGridKeyboardCommandRouterOptions,
): UseDataGridKeyboardCommandRouterResult {
  function dispatchKeyboardCommands(event: KeyboardEvent): boolean {
    const key = event.key.toLowerCase()
    const primaryModifierPressed = isPrimaryModifier(event)

    if (primaryModifierPressed && !event.altKey && key === "z") {
      prevent(event)
      if (event.shiftKey) {
        void options.runHistoryAction("redo", "keyboard")
        return true
      }
      void options.runHistoryAction("undo", "keyboard")
      return true
    }

    if (primaryModifierPressed && !event.altKey && !event.shiftKey && key === "y") {
      prevent(event)
      void options.runHistoryAction("redo", "keyboard")
      return true
    }

    if (options.isRangeMoving()) {
      prevent(event)
      if (event.key === "Escape") {
        options.stopRangeMove(false)
        options.setLastAction("Move canceled")
      }
      return true
    }

    if (options.isContextMenuVisible()) {
      if (event.key === "Escape") {
        prevent(event)
        options.closeContextMenu()
        options.focusViewport()
        return true
      }
      if (isMenuNavigationKey(event)) {
        prevent(event)
        return true
      }
      return true
    }

    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      prevent(event)
      options.openContextMenuFromCurrentCell()
      return true
    }

    if (primaryModifierPressed && !event.altKey && key === "c") {
      prevent(event)
      void options.copySelection("keyboard")
      return true
    }
    if (primaryModifierPressed && !event.altKey && key === "v") {
      prevent(event)
      void options.pasteSelection("keyboard")
      return true
    }
    if (primaryModifierPressed && !event.altKey && key === "x") {
      prevent(event)
      void options.cutSelection("keyboard")
      return true
    }

    return false
  }

  return {
    dispatchKeyboardCommands,
  }
}
