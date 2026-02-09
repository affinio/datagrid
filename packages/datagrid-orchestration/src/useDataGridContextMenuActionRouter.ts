import type {
  DataGridContextMenuActionId,
  DataGridContextMenuZone,
} from "./dataGridContextMenuContracts"

export interface DataGridContextMenuActionRouterState {
  zone: DataGridContextMenuZone
  columnKey: string | null
}

export interface UseDataGridContextMenuActionRouterOptions {
  resolveContextMenuState: () => DataGridContextMenuActionRouterState
  runHeaderContextAction: (action: DataGridContextMenuActionId, columnKey: string) => boolean
  copySelection: (trigger: "context-menu") => Promise<boolean>
  pasteSelection: (trigger: "context-menu") => Promise<boolean>
  cutSelection: (trigger: "context-menu") => Promise<boolean>
  clearCurrentSelection: (trigger: "context-menu") => Promise<boolean>
  closeContextMenu: () => void
}

export interface UseDataGridContextMenuActionRouterResult {
  runContextMenuAction: (action: DataGridContextMenuActionId) => Promise<boolean>
}

export function useDataGridContextMenuActionRouter(
  options: UseDataGridContextMenuActionRouterOptions,
): UseDataGridContextMenuActionRouterResult {
  async function runContextMenuAction(action: DataGridContextMenuActionId): Promise<boolean> {
    const context = options.resolveContextMenuState()
    if (context.zone === "header") {
      if (!context.columnKey) {
        options.closeContextMenu()
        return false
      }
      return options.runHeaderContextAction(action, context.columnKey)
    }

    if (action === "copy") {
      return options.copySelection("context-menu")
    }
    if (action === "paste") {
      return options.pasteSelection("context-menu")
    }
    if (action === "cut") {
      return options.cutSelection("context-menu")
    }
    if (action === "clear") {
      return options.clearCurrentSelection("context-menu")
    }

    options.closeContextMenu()
    return false
  }

  return {
    runContextMenuAction,
  }
}
