import type {
  DataGridContextMenuActionId,
  DataGridContextMenuZone,
} from "../internal/dataGridContextMenuContracts"

interface DataGridContextMenuPasteOptions {
  mode?: "default" | "values"
}

export interface DataGridContextMenuActionRouterState {
  zone: DataGridContextMenuZone
  columnKey: string | null
  rowId: string | null
}

export interface UseDataGridContextMenuActionRouterOptions {
  resolveContextMenuState: () => DataGridContextMenuActionRouterState
  runHeaderContextAction: (action: DataGridContextMenuActionId, columnKey: string) => boolean
  runRowIndexContextAction: (action: DataGridContextMenuActionId, rowId: string) => Promise<boolean>
  copySelection: (trigger: "context-menu") => Promise<boolean>
  pasteSelection: (trigger: "context-menu", options?: DataGridContextMenuPasteOptions) => Promise<boolean>
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

    if (context.zone === "row-index") {
      if (!context.rowId) {
        options.closeContextMenu()
        return false
      }
      return options.runRowIndexContextAction(action, context.rowId)
    }

    if (action === "copy") {
      return options.copySelection("context-menu")
    }
    if (action === "paste") {
      return options.pasteSelection("context-menu")
    }
    if (action === "paste-values") {
      return options.pasteSelection("context-menu", { mode: "values" })
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
